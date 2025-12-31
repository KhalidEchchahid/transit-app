import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  getStatus() {
    return { status: 'ok', service: 'morocco_transport_api' };
  }

  @Get('health')
  async getHealth() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch {
      return { status: 'error', db: 'disconnected' };
    }
  }
}
