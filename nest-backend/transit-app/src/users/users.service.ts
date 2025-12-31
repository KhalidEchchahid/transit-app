import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PublicUser, User } from './types/user.types';

interface CreateUserParams {
  email: string;
  name?: string;
  passwordHash: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async createUser(params: CreateUserParams): Promise<PublicUser> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const sql = `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, password_hash, name, created_at, updated_at
    `;

    const row = await this.db.queryOne<UserRow>(sql, [
      params.email.toLowerCase(),
      params.passwordHash,
      params.name || null,
    ]);

    if (!row) {
      throw new Error('Failed to create user');
    }

    return this.toPublicUser(this.rowToUser(row));
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT id, email, password_hash, name, created_at, updated_at
      FROM users WHERE email = $1
    `;
    const row = await this.db.queryOne<UserRow>(sql, [email.toLowerCase()]);
    return row ? this.rowToUser(row) : null;
  }

  async findById(id: number): Promise<User> {
    const sql = `
      SELECT id, email, password_hash, name, created_at, updated_at
      FROM users WHERE id = $1
    `;
    const row = await this.db.queryOne<UserRow>(sql, [id]);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return this.rowToUser(row);
  }

  private rowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
