import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AnonymousAuthController } from './anonymous-auth.controller';
import { AnonymousAuthService } from './services/anonymous-auth.service';
import { AnonymousUsersService } from './services/anonymous-users.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    DatabaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'transit-secret',
      signOptions: { expiresIn: '7d' }, // Longer expiry for anonymous users
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    AnonymousAuthService,
    AnonymousUsersService,
  ],
  controllers: [AuthController, AnonymousAuthController],
  exports: [AnonymousUsersService],
})
export class AuthModule {}
