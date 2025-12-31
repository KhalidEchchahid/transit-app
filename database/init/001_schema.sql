-- Morocco Transport Database Schema
-- PostGIS enabled, optimized for viewport queries and multimodal routing

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text search on station names

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Transport operators
CREATE TABLE operators (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name_fr TEXT NOT NULL,
    name_ar TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert known operators
INSERT INTO operators (code, name_fr, name_ar, website) VALUES
    ('casatram', 'Casa Tramway', 'كازا ترامواي', 'https://casatramway.ma'),
    ('casabus', 'Casa Bus (Alsa)', 'كازا باص', 'https://casabus.ma'),
    ('oncf', 'ONCF', 'المكتب الوطني للسكك الحديدية', 'https://oncf.ma'),
    ('grand_taxi', 'Grand Taxi', 'الطاكسي الكبير', NULL);

-- Stops/Stations with spatial indexing
CREATE TABLE stops (
    id SERIAL PRIMARY KEY,
    code TEXT,
    name_fr TEXT NOT NULL,
    name_ar TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    geohash TEXT GENERATED ALWAYS AS (ST_GeoHash(location::geometry, 9)) STORED,
    operator_id INT REFERENCES operators(id),
    stop_type TEXT DEFAULT 'stop' CHECK (stop_type IN ('stop', 'station', 'hub')),
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    parent_station_id INT REFERENCES stops(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transit lines
CREATE TABLE lines (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name_fr TEXT,
    name_ar TEXT,
    line_type TEXT NOT NULL CHECK (line_type IN ('tram', 'busway', 'bus', 'train', 'grand_taxi')),
    color TEXT,
    operator_id INT REFERENCES operators(id),
    origin_name TEXT,
    destination_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(code, operator_id)
);

-- Line routes (ordered stops per direction)
CREATE TABLE line_stops (
    id SERIAL PRIMARY KEY,
    line_id INT REFERENCES lines(id) ON DELETE CASCADE,
    stop_id INT REFERENCES stops(id) ON DELETE CASCADE,
    direction SMALLINT NOT NULL CHECK (direction IN (0, 1)),
    stop_sequence INT NOT NULL,
    travel_time_seconds INT,  -- From previous stop
    distance_meters INT,      -- From previous stop
    UNIQUE(line_id, direction, stop_sequence)
);

-- Route shapes (polylines for map display)
CREATE TABLE line_shapes (
    id SERIAL PRIMARY KEY,
    line_id INT REFERENCES lines(id) ON DELETE CASCADE,
    direction SMALLINT NOT NULL CHECK (direction IN (0, 1)),
    shape GEOGRAPHY(LINESTRING, 4326),
    UNIQUE(line_id, direction)
);

-- Schedules (departure times)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    line_id INT REFERENCES lines(id) ON DELETE CASCADE,
    stop_id INT REFERENCES stops(id) ON DELETE CASCADE,
    direction SMALLINT NOT NULL,
    day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday', 'holiday')),
    departure_time TIME NOT NULL
);

-- Fares
CREATE TABLE fares (
    id SERIAL PRIMARY KEY,
    operator_id INT REFERENCES operators(id),
    line_type TEXT,
    from_zone INT,
    to_zone INT,
    fare_mad DECIMAL(10,2) NOT NULL,
    fare_type TEXT DEFAULT 'single' CHECK (fare_type IN ('single', 'return', 'day_pass', 'monthly')),
    transfer_allowed BOOLEAN DEFAULT FALSE,
    transfer_time_minutes INT,
    notes TEXT
);

-- Insert known fares
INSERT INTO fares (operator_id, line_type, fare_mad, fare_type, transfer_allowed, transfer_time_minutes, notes) VALUES
    ((SELECT id FROM operators WHERE code = 'casatram'), 'tram', 8.00, 'single', TRUE, 60, 'Valid for tram-tram and tram-busway transfers'),
    ((SELECT id FROM operators WHERE code = 'casatram'), 'busway', 8.00, 'single', TRUE, 60, 'Valid for tram-tram and tram-busway transfers'),
    ((SELECT id FROM operators WHERE code = 'casabus'), 'bus', 5.00, 'single', FALSE, NULL, 'Standard city bus fare');

-- Transfer points between stops
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    from_stop_id INT REFERENCES stops(id) ON DELETE CASCADE,
    to_stop_id INT REFERENCES stops(id) ON DELETE CASCADE,
    transfer_type SMALLINT NOT NULL DEFAULT 0,  -- 0=recommended, 1=timed, 2=min_time, 3=not_possible
    min_transfer_time_seconds INT DEFAULT 120,
    walk_distance_meters INT,
    UNIQUE(from_stop_id, to_stop_id)
);

-- =============================================================================
-- CROWDSOURCING TABLES
-- =============================================================================

CREATE TABLE crowdsource_submissions (
    id SERIAL PRIMARY KEY,
    submission_type TEXT NOT NULL CHECK (submission_type IN ('grand_taxi_route', 'stop_correction', 'fare_update')),
    data JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Spatial indexes
CREATE INDEX idx_stops_location ON stops USING GIST(location);
CREATE INDEX idx_stops_geohash ON stops(geohash);
CREATE INDEX idx_line_shapes_shape ON line_shapes USING GIST(shape);

-- Lookup indexes
CREATE INDEX idx_stops_operator ON stops(operator_id);
CREATE INDEX idx_stops_name_trgm ON stops USING GIN(name_fr gin_trgm_ops);
CREATE INDEX idx_lines_operator ON lines(operator_id);
CREATE INDEX idx_lines_type ON lines(line_type);
CREATE INDEX idx_line_stops_line ON line_stops(line_id);
CREATE INDEX idx_line_stops_stop ON line_stops(stop_id);
CREATE INDEX idx_schedules_lookup ON schedules(line_id, stop_id, direction, day_type);
CREATE INDEX idx_schedules_time ON schedules(departure_time);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Find stops within radius of a point
CREATE OR REPLACE FUNCTION find_nearby_stops(
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    radius_m INT DEFAULT 500
)
RETURNS TABLE(
    stop_id INT,
    name_fr TEXT,
    distance_m DOUBLE PRECISION,
    operator_code TEXT,
    stop_type TEXT
) AS $$
    SELECT 
        s.id,
        s.name_fr,
        ST_Distance(s.location, ST_MakePoint(lon, lat)::geography) AS distance_m,
        o.code,
        s.stop_type
    FROM stops s
    LEFT JOIN operators o ON s.operator_id = o.id
    WHERE ST_DWithin(s.location, ST_MakePoint(lon, lat)::geography, radius_m)
    ORDER BY s.location <-> ST_MakePoint(lon, lat)::geography
    LIMIT 50;
$$ LANGUAGE SQL STABLE;

-- Estimate walking time between two points (assuming 1.2 m/s)
CREATE OR REPLACE FUNCTION estimate_walk_time_seconds(
    from_lat DOUBLE PRECISION,
    from_lon DOUBLE PRECISION,
    to_lat DOUBLE PRECISION,
    to_lon DOUBLE PRECISION
)
RETURNS INT AS $$
    SELECT CEIL(
        ST_Distance(
            ST_MakePoint(from_lon, from_lat)::geography,
            ST_MakePoint(to_lon, to_lat)::geography
        ) / 1.2
    )::INT;
$$ LANGUAGE SQL IMMUTABLE;

-- Get stops in viewport with LOD support
CREATE OR REPLACE FUNCTION get_stops_in_viewport(
    min_lon DOUBLE PRECISION,
    min_lat DOUBLE PRECISION,
    max_lon DOUBLE PRECISION,
    max_lat DOUBLE PRECISION,
    zoom_level INT DEFAULT 14
)
RETURNS TABLE(
    stop_id INT,
    name_fr TEXT,
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    stop_type TEXT,
    line_types TEXT[]
) AS $$
    SELECT 
        s.id,
        s.name_fr,
        ST_X(s.location::geometry),
        ST_Y(s.location::geometry),
        s.stop_type,
        ARRAY_AGG(DISTINCT l.line_type) FILTER (WHERE l.line_type IS NOT NULL)
    FROM stops s
    LEFT JOIN line_stops ls ON s.id = ls.stop_id
    LEFT JOIN lines l ON ls.line_id = l.id
    WHERE s.location && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geography
    GROUP BY s.id, s.name_fr, s.location, s.stop_type
    -- At low zoom, only show hubs and stations
    HAVING (zoom_level >= 14) OR (s.stop_type IN ('hub', 'station'))
    LIMIT CASE WHEN zoom_level < 12 THEN 100 ELSE 500 END;
$$ LANGUAGE SQL STABLE;

-- Get next departures from a stop
CREATE OR REPLACE FUNCTION get_next_departures(
    p_stop_id INT,
    p_day_type TEXT DEFAULT 'weekday',
    p_after_time TIME DEFAULT CURRENT_TIME,
    p_limit INT DEFAULT 10
)
RETURNS TABLE(
    line_code TEXT,
    line_type TEXT,
    line_color TEXT,
    direction SMALLINT,
    destination TEXT,
    departure_time TIME,
    minutes_until INT
) AS $$
    SELECT 
        l.code,
        l.line_type,
        l.color,
        sc.direction,
        CASE WHEN sc.direction = 0 THEN l.destination_name ELSE l.origin_name END,
        sc.departure_time,
        EXTRACT(EPOCH FROM (sc.departure_time - p_after_time))::INT / 60
    FROM schedules sc
    JOIN lines l ON sc.line_id = l.id
    WHERE sc.stop_id = p_stop_id
      AND sc.day_type = p_day_type
      AND sc.departure_time >= p_after_time
    ORDER BY sc.departure_time
    LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stops_updated_at
    BEFORE UPDATE ON stops
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Morocco Transport database initialized successfully!';
END $$;
