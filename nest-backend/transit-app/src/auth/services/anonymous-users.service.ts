import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AnonymousUser {
  id: number;
  uuid: string;
  passkeyHash: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export type PublicAnonymousUser = Omit<AnonymousUser, 'passkeyHash'>;

interface AnonymousUserRow {
  id: number;
  uuid: string;
  passkey_hash: string;
  created_at: Date;
  last_seen_at: Date;
}

@Injectable()
export class AnonymousUsersService {
  constructor(private readonly db: DatabaseService) {}

  async createAnonymousUser(
    uuid: string,
    passkeyHash: string,
  ): Promise<AnonymousUser> {
    const sql = `
      INSERT INTO anonymous_users (uuid, passkey_hash)
      VALUES ($1, $2)
      RETURNING id, uuid, passkey_hash, created_at, last_seen_at
    `;

    const row = await this.db.queryOne<AnonymousUserRow>(sql, [
      uuid,
      passkeyHash,
    ]);

    if (!row) {
      throw new Error('Failed to create anonymous user');
    }

    return this.rowToUser(row);
  }

  async findByUuid(uuid: string): Promise<AnonymousUser | null> {
    const sql = `
      SELECT id, uuid, passkey_hash, created_at, last_seen_at
      FROM anonymous_users WHERE uuid = $1
    `;
    const row = await this.db.queryOne<AnonymousUserRow>(sql, [uuid]);
    return row ? this.rowToUser(row) : null;
  }

  async findById(id: number): Promise<AnonymousUser | null> {
    const sql = `
      SELECT id, uuid, passkey_hash, created_at, last_seen_at
      FROM anonymous_users WHERE id = $1
    `;
    const row = await this.db.queryOne<AnonymousUserRow>(sql, [id]);
    return row ? this.rowToUser(row) : null;
  }

  async updateLastSeen(id: number): Promise<AnonymousUser> {
    const sql = `
      UPDATE anonymous_users 
      SET last_seen_at = NOW()
      WHERE id = $1
      RETURNING id, uuid, passkey_hash, created_at, last_seen_at
    `;
    const row = await this.db.queryOne<AnonymousUserRow>(sql, [id]);
    if (!row) {
      throw new NotFoundException('Anonymous user not found');
    }
    return this.rowToUser(row);
  }

  private rowToUser(row: AnonymousUserRow): AnonymousUser {
    return {
      id: row.id,
      uuid: row.uuid,
      passkeyHash: row.passkey_hash,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    };
  }

  toPublicUser(user: AnonymousUser): PublicAnonymousUser {
    return {
      id: user.id,
      uuid: user.uuid,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    };
  }
}
