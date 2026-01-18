-- Initialize PostgreSQL with required extensions
-- This script runs automatically when the container is first created

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable TimescaleDB extension (already included in timescale/timescaledb-ha image)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions are installed
SELECT 
    extname AS extension_name,
    extversion AS version
FROM pg_extension
WHERE extname IN ('postgis', 'timescaledb', 'uuid-ossp');
