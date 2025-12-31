import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TransportController } from './transport.controller';
import { LineRepository } from './repositories/line.repository';
import { RaptorLoader } from './routing/raptor-loader.service';
import { RaptorService } from './routing/raptor.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TransportController],
  providers: [LineRepository, RaptorLoader, RaptorService],
})
export class TransportModule {}
