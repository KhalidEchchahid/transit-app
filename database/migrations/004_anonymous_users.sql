-- Anonymous users table for privacy-first authentication
-- Users are identified by a random UUID + passkey (no PII collected)
-- Supports multi-device access via UUID+passkey restore
CREATE TABLE IF NOT EXISTS anonymous_users (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,          -- Public identifier (shown to user for account recovery)
    passkey_hash TEXT NOT NULL,          -- Hashed passkey (secret, user must save it)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for uuid lookups (login flow)
CREATE INDEX IF NOT EXISTS idx_anonymous_users_uuid ON anonymous_users(uuid);
