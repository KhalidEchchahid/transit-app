-- Taxi Crowdsourcing Schema
-- Submissions for new routes, prices, or stops
CREATE TABLE IF NOT EXISTS taxi_routes (
    id SERIAL PRIMARY KEY,
    origin_name TEXT,
    destination_name TEXT,
    origin_geom GEOGRAPHY(POINT, 4326),
    destination_geom GEOGRAPHY(POINT, 4326),
    price_mad NUMERIC(5, 2),
    is_verified BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT NOW()
);

-- Pricing submissions for existing segments
CREATE TABLE IF NOT EXISTS taxi_price_submissions (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES taxi_routes(id),
    price_mad NUMERIC(5, 2),
    observed_at TIMESTAMP DEFAULT NOW(),
    user_id TEXT -- optimal for future auth
);

-- Stop submissions (where taxis gather)
CREATE TABLE IF NOT EXISTS taxi_stops (
    id SERIAL PRIMARY KEY,
    name TEXT,
    location GEOGRAPHY(POINT, 4326),
    is_verified BOOLEAN DEFAULT FALSE
);
