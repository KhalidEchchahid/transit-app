import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Line, Stop } from '../models/transport.models';

interface LineRow {
  id: number;
  code: string;
  name: string;
  type: string;
  color: string;
  operator_id: number;
  origin: string;
  destination: string;
  stop_count: number;
}

interface StopRow {
  id: number;
  code: string;
  name: string;
  lon: number;
  lat: number;
  type: string;
  sequence?: number;
}

@Injectable()
export class LineRepository {
  constructor(private readonly db: DatabaseService) {}

  async getAllLines(): Promise<Line[]> {
    const sql = `
      SELECT l.id, l.code, l.name_fr AS name, l.line_type AS type,
             COALESCE(l.color, '#000000') AS color, l.operator_id,
             l.origin_name AS origin, l.destination_name AS destination,
             (SELECT COUNT(*) FROM line_stops WHERE line_id = l.id)::int AS stop_count
      FROM lines l
      ORDER BY
        CASE
          WHEN line_type = 'tram' THEN 1
          WHEN line_type = 'busway' THEN 2
          WHEN line_type = 'train' THEN 3
          ELSE 4
        END,
        l.code ASC
    `;
    const rows = await this.db.query<LineRow>(sql);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      color: r.color,
      operator_id: r.operator_id,
      origin: r.origin,
      destination: r.destination,
      stop_count: r.stop_count,
    }));
  }

  async getLineById(lineId: number): Promise<Line | null> {
    const sql = `
      SELECT id, code, name_fr AS name, line_type AS type,
             COALESCE(color, '#000000') AS color, operator_id,
             origin_name AS origin, destination_name AS destination
      FROM lines WHERE id = $1
    `;
    const row = await this.db.queryOne<LineRow>(sql, [lineId]);
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      color: row.color,
      operator_id: row.operator_id,
      origin: row.origin,
      destination: row.destination,
    };
  }

  async getStopsForLine(lineId: number, direction = 0): Promise<Stop[]> {
    const sql = `
      SELECT s.id, s.code, s.name_fr AS name,
             ST_X(s.location::geometry) AS lon, ST_Y(s.location::geometry) AS lat,
             s.stop_type AS type, ls.stop_sequence AS sequence
      FROM stops s
      JOIN line_stops ls ON s.id = ls.stop_id
      WHERE ls.line_id = $1 AND ls.direction = $2
      ORDER BY ls.stop_sequence ASC
    `;
    const rows = await this.db.query<StopRow>(sql, [lineId, direction]);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      type: r.type,
      sequence: r.sequence,
    }));
  }

  async getStopsInViewport(
    minLat: number,
    minLon: number,
    maxLat: number,
    maxLon: number,
  ): Promise<Stop[]> {
    const sql = `
      SELECT id, code, name_fr AS name,
             ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
             stop_type AS type
      FROM stops
      WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
      LIMIT 200
    `;
    const rows = await this.db.query<StopRow>(sql, [
      minLon,
      minLat,
      maxLon,
      maxLat,
    ]);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      type: r.type,
    }));
  }

  async getStopById(stopId: number): Promise<Stop | null> {
    const sql = `
      SELECT id, code, name_fr AS name,
             ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
             stop_type AS type
      FROM stops WHERE id = $1
    `;
    const row = await this.db.queryOne<StopRow>(sql, [stopId]);
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      type: row.type,
    };
  }

  async getLinesForStop(stopId: number): Promise<Line[]> {
    const sql = `
      SELECT DISTINCT l.id, l.code, l.name_fr AS name, l.line_type AS type,
             COALESCE(l.color, '#000000') AS color, l.operator_id,
             l.origin_name AS origin, l.destination_name AS destination
      FROM lines l
      JOIN line_stops ls ON ls.line_id = l.id
      WHERE ls.stop_id = $1
      ORDER BY l.code ASC
    `;
    const rows = await this.db.query<LineRow>(sql, [stopId]);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      color: r.color,
      operator_id: r.operator_id,
      origin: r.origin,
      destination: r.destination,
    }));
  }
}
