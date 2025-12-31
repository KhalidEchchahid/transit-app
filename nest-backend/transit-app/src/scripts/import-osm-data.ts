import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface OSMStation {
  OSMID: number;
  Name: string;
  NameAr: string;
  Lat: number;
  Lon: number;
  LineRefs: string[];
  StopType: string;
}

interface OSMLine {
  OSMID: number;
  Ref: string;
  Name: string;
  Color: string;
  From: string;
  To: string;
  Operator: string;
  RouteType: string;
  StationOrder: number[];
}

interface OSMData {
  fetched_at: string;
  source: string;
  lines: OSMLine[];
  stations: OSMStation[];
}

async function importData() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'transport',
    password: 'transport_dev_pwd',
    database: 'transport',
  });

  try {
    // Read JSON file
    const jsonPath = path.join(__dirname, '../../../../scrapers/osm_casablanca_transit.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const data: OSMData = JSON.parse(rawData);

    console.log('🚃 OSM Transit Data Importer');
    console.log('============================');
    console.log(`📊 Lines: ${data.lines.length}`);
    console.log(`📍 Stations: ${data.stations.length}`);

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Clear existing data (for clean import)
      console.log('\n🧹 Clearing existing data...');
      await client.query('DELETE FROM line_stops');
      await client.query('DELETE FROM lines');
      await client.query('DELETE FROM stops WHERE code LIKE \'osm_%\'');

      // Get operator IDs
      const casatramResult = await client.query("SELECT id FROM operators WHERE code = 'casatram'");
      const casabusResult = await client.query("SELECT id FROM operators WHERE code = 'casabus'");
      const oncfResult = await client.query("SELECT id FROM operators WHERE code = 'oncf'");

      const casatramId = casatramResult.rows[0]?.id || 1;
      const casabusId = casabusResult.rows[0]?.id || 2;
      const oncfId = oncfResult.rows[0]?.id || 3;

      // Import stations
      console.log('\n📍 Importing stations...');
      const stationIdMap = new Map<number, number>(); // OSM ID -> DB ID

      for (const station of data.stations) {
        if (!station.Name || !station.Lat || !station.Lon) {
          continue;
        }

        // Determine operator based on line refs
        let operatorId = casatramId;
        const lineRefs = station.LineRefs?.join(',') || '';
        if (lineRefs.includes('ONCF') || station.StopType === 'station') {
          operatorId = oncfId;
        } else if (lineRefs.match(/^L\d/)) {
          operatorId = casabusId;
        }

        const code = `osm_${station.OSMID}`;
        const stopType = station.StopType || 'stop';

        try {
          const result = await client.query(
            `INSERT INTO stops (code, name_fr, name_ar, location, operator_id, stop_type)
             VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7)
             RETURNING id`,
            [code, station.Name, station.NameAr || null, station.Lon, station.Lat, operatorId, stopType]
          );
          stationIdMap.set(station.OSMID, result.rows[0].id);
        } catch (err) {
          console.log(`  ⚠️ Skipped station ${station.Name}: ${(err as Error).message}`);
        }
      }
      console.log(`  ✅ Imported ${stationIdMap.size} stations`);

      // Import lines (deduplicate by Ref - keep first occurrence for each direction)
      console.log('\n🚌 Importing lines...');
      const processedLines = new Map<string, OSMLine>();
      
      for (const line of data.lines) {
        const key = `${line.Ref}-${line.RouteType}`;
        if (!processedLines.has(key)) {
          processedLines.set(key, line);
        }
      }

      const lineIdMap = new Map<string, number>(); // line code -> DB ID
      let linesImported = 0;

      for (const [key, line] of processedLines) {
        // Determine line type
        let lineType = 'bus';
        let operatorId = casabusId;

        switch (line.RouteType) {
          case 'tram':
            lineType = 'tram';
            operatorId = casatramId;
            break;
          case 'train':
            lineType = 'train';
            operatorId = oncfId;
            break;
          case 'bus':
            if (line.Ref.startsWith('BW')) {
              lineType = 'busway';
              operatorId = casatramId;
            } else {
              lineType = 'bus';
              operatorId = casabusId;
            }
            break;
        }

        try {
          const result = await client.query(
            `INSERT INTO lines (code, name_fr, line_type, color, operator_id, origin_name, destination_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (code, operator_id) DO UPDATE SET name_fr = EXCLUDED.name_fr
             RETURNING id`,
            [line.Ref, line.Name, lineType, line.Color, operatorId, line.From, line.To]
          );
          lineIdMap.set(line.Ref, result.rows[0].id);
          linesImported++;
        } catch (err) {
          console.log(`  ⚠️ Skipped line ${line.Ref}: ${(err as Error).message}`);
        }
      }
      console.log(`  ✅ Imported ${linesImported} lines`);

      // Import line stops (with both directions)
      console.log('\n🔗 Importing line stops...');
      let lineStopsImported = 0;
      const lineDirectionTracker = new Map<string, number>(); // Track which direction was used per line

      for (const line of data.lines) {
        const lineId = lineIdMap.get(line.Ref);
        if (!lineId) continue;

        // Alternate direction: first occurrence = 0, second = 1
        const prevDirection = lineDirectionTracker.get(line.Ref) ?? -1;
        const direction = prevDirection === -1 ? 0 : 1;
        lineDirectionTracker.set(line.Ref, direction);

        for (let seq = 0; seq < line.StationOrder.length; seq++) {
          const osmStopId = line.StationOrder[seq];
          const dbStopId = stationIdMap.get(osmStopId);

          if (dbStopId) {
            try {
              await client.query(
                `INSERT INTO line_stops (line_id, stop_id, direction, stop_sequence)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [lineId, dbStopId, direction, seq]
              );
              lineStopsImported++;
            } catch (err) {
              // Ignore duplicates
            }
          }
        }
      }
      console.log(`  ✅ Imported ${lineStopsImported} line stops`);

      // Generate synthetic schedules (every 10 minutes from 05:30 to 22:30)
      console.log('\n📅 Generating schedules...');
      
      // Clear existing schedules
      await client.query('DELETE FROM schedules');

      // Pre-generate departure times
      const departures: string[] = [];
      for (let hour = 5; hour <= 22; hour++) {
        for (let minute = (hour === 5 ? 30 : 0); minute < 60; minute += 10) {
          if (hour === 22 && minute > 30) break;
          departures.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
        }
      }
      const dayTypes = ['weekday', 'saturday', 'sunday'];

      // Get all first stops for all lines
      const firstStopsResult = await client.query(
        `SELECT line_id, direction, stop_id FROM line_stops WHERE stop_sequence = 0`
      );

      // Batch insert schedules
      const values: string[] = [];
      let paramIndex = 1;
      const params: (number | string)[] = [];

      for (const row of firstStopsResult.rows) {
        for (const dayType of dayTypes) {
          for (const timeStr of departures) {
            values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            params.push(row.line_id, row.stop_id, row.direction, dayType, timeStr);
          }
        }
      }

      if (values.length > 0) {
        // Insert in batches of 1000
        const batchSize = 1000;
        for (let i = 0; i < values.length; i += batchSize) {
          const batchValues = values.slice(i, i + batchSize);
          const batchParams = params.slice(i * 5, (i + batchSize) * 5);
          
          // Renumber parameters for batch
          const renumbered = batchValues.map((v, idx) => {
            const baseIdx = idx * 5;
            return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5})`;
          });

          await client.query(
            `INSERT INTO schedules (line_id, stop_id, direction, day_type, departure_time) VALUES ${renumbered.join(', ')}`,
            batchParams
          );
          console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(values.length / batchSize)}`);
        }
      }

      const schedCount = await client.query('SELECT COUNT(*) FROM schedules');
      console.log(`  ✅ Generated ${schedCount.rows[0].count} schedules`);

      await client.query('COMMIT');
      console.log('\n✅ Import completed successfully!');

      // Print summary
      const stopsCount = await client.query('SELECT COUNT(*) FROM stops');
      const linesCount = await client.query('SELECT COUNT(*) FROM lines');
      const lineStopsCount = await client.query('SELECT COUNT(*) FROM line_stops');

      console.log('\n📊 Database Summary:');
      console.log(`   Stops: ${stopsCount.rows[0].count}`);
      console.log(`   Lines: ${linesCount.rows[0].count}`);
      console.log(`   Line Stops: ${lineStopsCount.rows[0].count}`);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importData();
