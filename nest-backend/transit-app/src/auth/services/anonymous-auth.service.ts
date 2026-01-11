import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  AnonymousUsersService,
  PublicAnonymousUser,
} from './anonymous-users.service';

export interface AnonymousAuthResponse {
  accessToken: string;
  user: PublicAnonymousUser;
  /** Only returned on registration - user must save this! */
  credentials?: {
    uuid: string;
    passkey: string;
  };
}

@Injectable()
export class AnonymousAuthService {
  constructor(
    private readonly anonymousUsersService: AnonymousUsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new anonymous user.
   * Generates a random UUID and passkey.
   * Returns credentials that user MUST save for multi-device access.
   */
  async register(): Promise<AnonymousAuthResponse> {
    // Generate random UUID (public identifier)
    const uuid = crypto.randomUUID();

    // Generate random passkey (32 chars, base64-url safe)
    const passkey = crypto.randomBytes(24).toString('base64url');

    // Hash the passkey for storage
    const passkeyHash = await bcrypt.hash(passkey, 10);

    // Check if UUID already exists (extremely unlikely but be safe)
    const existing = await this.anonymousUsersService.findByUuid(uuid);
    if (existing) {
      throw new ConflictException('UUID collision - please retry');
    }

    // Create the anonymous user
    const user = await this.anonymousUsersService.createAnonymousUser(
      uuid,
      passkeyHash,
    );

    // Generate JWT
    const payload = {
      sub: user.id,
      uuid: user.uuid,
      anonymous: true,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.anonymousUsersService.toPublicUser(user),
      // Return credentials ONLY on registration
      credentials: {
        uuid,
        passkey,
      },
    };
  }

  /**
   * Login with existing UUID + passkey.
   * Used for multi-device access or after app reinstall.
   */
  async login(uuid: string, passkey: string): Promise<AnonymousAuthResponse> {
    const user = await this.anonymousUsersService.findByUuid(uuid);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passkey, user.passkeyHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    await this.anonymousUsersService.updateLastSeen(user.id);

    // Generate JWT
    const payload = {
      sub: user.id,
      uuid: user.uuid,
      anonymous: true,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.anonymousUsersService.toPublicUser(user),
      // Don't return credentials on login - user should already have them
    };
  }

  /**
   * Refresh token for authenticated anonymous user.
   */
  async refresh(userId: number): Promise<AnonymousAuthResponse> {
    const user = await this.anonymousUsersService.updateLastSeen(userId);

    const payload = {
      sub: user.id,
      uuid: user.uuid,
      anonymous: true,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.anonymousUsersService.toPublicUser(user),
    };
  }
}
