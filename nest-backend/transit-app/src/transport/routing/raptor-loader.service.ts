import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  RaptorData,
  RaptorRoute,
  RaptorStop,
  RaptorTrip,
  StopID,
  StopTime,
} from './types';

@Injectable()
export class RaptorLoader implements OnModuleInit {
  private readonly logger = new Logger(RaptorLoader.name);
  private data: RaptorData | null = null;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    this.data = await this.loadData();
  }

  getData(): RaptorData {
    if (!this.data) {
      throw new Error('RAPTOR data not loaded');
    }
    return this.data;
  }

  private async loadData(): Promise<RaptorData> {
    this.logger.log('Loading RAPTOR data from database...');
    const start = Date.now();

    const data: RaptorData = {
      stops: [],
      routes: [],
      transfers: new Map(),
      dbIdToStopId: new Map(),
    };

    // 1. Load all stops
    const stopMap = new Map<number, StopID>();

    interface StopRow {
      id: number;
      code: string;
      name: string;
      lon: number;
      lat: number;
    }

    const stopRows = await this.db.query<StopRow>(`
      SELECT id, code, name_fr AS name,
             ST_X(location::geometry) AS lon,
             ST_Y(location::geometry) AS lat
      FROM stops
    `);

    for (const row of stopRows) {
      const stopId: StopID = data.stops.length;
      const stop: RaptorStop = {
        id: stopId,
        dbId: row.id,
        code: row.code,
        lat: row.lat,
        lon: row.lon,
        name: row.name,
      };
      stopMap.set(row.id, stopId);
      data.dbIdToStopId.set(row.id, stopId);
      data.stops.push(stop);
    }
    this.logger.log(`Loaded ${data.stops.length} stops`);

    // 2. Load routes (patterns = line_id + direction)
    interface PatternRow {
      line_id: number;
      direction: number;
    }
    const patterns = await this.db.query<PatternRow>(
      'SELECT DISTINCT line_id, direction FROM line_stops',
    );

    for (const p of patterns) {
      const { line_id: lineId, direction: dirId } = p;

      // Get line info
      interface LineInfoRow {
        code: string;
        line_type: string;
        color: string;
      }
      const lineInfo = await this.db.queryOne<LineInfoRow>(
        "SELECT code, line_type, COALESCE(color, '#000000') AS color FROM lines WHERE id = $1",
        [lineId],
      );
      if (!lineInfo) continue;

      // Get ordered stops for this pattern
      interface PatternStopRow {
        stop_id: number;
      }
      const patternStops = await this.db.query<PatternStopRow>(
        `SELECT stop_id FROM line_stops WHERE line_id = $1 AND direction = $2 ORDER BY stop_sequence`,
        [lineId, dirId],
      );

      const stopIds: StopID[] = [];
      const dbStopIds: number[] = [];
      for (const ps of patternStops) {
        const sid = stopMap.get(ps.stop_id);
        if (sid !== undefined) {
          stopIds.push(sid);
          dbStopIds.push(ps.stop_id);
        }
      }

      if (stopIds.length < 2) continue;

      const route: RaptorRoute = {
        id: data.routes.length,
        stops: stopIds,
        trips: [],
        lineId,
        lineCode: lineInfo.code,
        lineType: lineInfo.line_type,
        lineColor: lineInfo.color,
        price:
          lineInfo.line_type === 'tram' || lineInfo.line_type === 'busway'
            ? 8.0
            : 5.0,
      };

      // Load trips for each day type
      for (const dayType of ['weekday', 'saturday', 'sunday']) {
        interface ScheduleRow {
          departure_time: string;
        }
        const firstStopDbId = dbStopIds[0];
        const schedules = await this.db.query<ScheduleRow>(
          `SELECT departure_time FROM schedules
           WHERE line_id = $1 AND direction = $2 AND stop_id = $3 AND day_type = $4
           ORDER BY departure_time`,
          [lineId, dirId, firstStopDbId, dayType],
        );

        for (const sched of schedules) {
          const startSecs = this.parseTime(sched.departure_time);
          const stopTimes: StopTime[] = [];
          let currentSecs = startSecs;
          for (let i = 0; i < stopIds.length; i++) {
            stopTimes.push({ arrival: currentSecs, departure: currentSecs });
            currentSecs += 180; // 3 minutes between stops (simplified)
          }
          const trip: RaptorTrip = {
            id: route.trips.length,
            stopTimes,
            serviceId: dayType,
          };
          route.trips.push(trip);
        }
      }

      data.routes.push(route);
    }
    this.logger.log(`Loaded ${data.routes.length} routes`);

    // 3. Generate transfers (walking < 300m)
    this.logger.log('Generating transfers...');
    interface TransferRow {
      id1: number;
      id2: number;
      dist: number;
    }
    const transferRows = await this.db.query<TransferRow>(`
      SELECT s1.id AS id1, s2.id AS id2,
             ST_Distance(s1.location::geography, s2.location::geography) AS dist
      FROM stops s1
      JOIN stops s2 ON ST_DWithin(s1.location::geography, s2.location::geography, 300)
      WHERE s1.id != s2.id
    `);

    let transferCount = 0;
    for (const tr of transferRows) {
      const sid1 = stopMap.get(tr.id1);
      const sid2 = stopMap.get(tr.id2);
      if (sid1 !== undefined && sid2 !== undefined) {
        const walkTime = Math.round(tr.dist); // 1 m/s walking speed
        let list = data.transfers.get(sid1);
        if (!list) {
          list = [];
          data.transfers.set(sid1, list);
        }
        list.push({ toStop: sid2, timeSeconds: walkTime });
        transferCount++;
      }
    }
    this.logger.log(`Generated ${transferCount} transfers`);
    this.logger.log(`RAPTOR Data Load complete in ${Date.now() - start}ms`);

    return data;
  }

  private parseTime(timeStr: string): number {
    // timeStr can be "HH:MM:SS" or "HH:MM"
    const parts = timeStr.split(':').map(Number);
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
}
