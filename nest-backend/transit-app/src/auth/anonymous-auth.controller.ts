import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import {
  AnonymousAuthService,
  AnonymousAuthResponse,
} from './services/anonymous-auth.service';
import { AnonymousLoginDto } from './dto/anonymous-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/anonymous')
export class AnonymousAuthController {
  constructor(private readonly anonymousAuthService: AnonymousAuthService) {}

  /**
   * Register a new anonymous user.
   * Returns UUID + passkey that user MUST save for account recovery.
   */
  @Post('register')
  async register(): Promise<AnonymousAuthResponse> {
    return this.anonymousAuthService.register();
  }

  /**
   * Login with existing UUID + passkey.
   * Used for multi-device access or after app reinstall.
   */
  @Post('login')
  async login(@Body() dto: AnonymousLoginDto): Promise<AnonymousAuthResponse> {
    return this.anonymousAuthService.login(dto.uuid, dto.passkey);
  }

  /**
   * Refresh token for currently authenticated anonymous user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('refresh')
  async refresh(@Request() req: any): Promise<AnonymousAuthResponse> {
    return this.anonymousAuthService.refresh(req.user.id);
  }
}
