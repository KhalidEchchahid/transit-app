import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { PublicUser } from '../users/types/user.types';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(
    dto: SignUpDto,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    if (!dto.email || !dto.password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const normalizedEmail = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      email: normalizedEmail,
      name: dto.name?.trim(),
      passwordHash,
    });

    return this.generateAuthResponse(user);
  }

  async validateUser(
    email: string,
    plainPassword: string,
  ): Promise<PublicUser> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(plainPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.usersService.toPublicUser(user);
  }

  login(user: PublicUser): { accessToken: string; user: PublicUser } {
    return this.generateAuthResponse(user);
  }

  private generateAuthResponse(user: PublicUser) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user };
  }

  async getProfile(userId: number): Promise<PublicUser> {
    const userEntity = await this.usersService.findById(userId);
    return this.usersService.toPublicUser(userEntity);
  }
}
