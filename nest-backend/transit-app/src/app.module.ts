import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { TransportModule } from './transport/transport.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, TransportModule, AuthModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
