-- Anonymous users table for device-based authentication
CREATE TABLE IF NOT EXISTS anonymous_users (
    id SERIAL PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_anonymous_users_device_id ON anonymous_users(device_id);
