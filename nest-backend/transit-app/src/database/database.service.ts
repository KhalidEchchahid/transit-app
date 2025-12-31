import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  async onModuleInit() {
    const config: PoolConfig = {
      connectionString:
        process.env.DATABASE_URL ??
        'postgres://transport:transport_dev_pwd@localhost:5433/transport',
      ssl: false,
    };

    this.pool = new Pool(config);

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      this.logger.log('✅ Connected to PostGIS database');
    } catch (error) {
      this.logger.error('Unable to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}
