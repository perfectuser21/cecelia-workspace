-- ============================================
-- Social Media Metrics Database Initialization
-- ============================================

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create n8n database if it doesn't exist
SELECT 'CREATE DATABASE n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- Create application schema
CREATE SCHEMA IF NOT EXISTS social_metrics;

-- Set search path
SET search_path TO social_metrics, public;

-- ============================================
-- Tables
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    feishu_user_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    department VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Metrics collection table (for storing social media metrics)
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    collected_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collection jobs table
CREATE TABLE IF NOT EXISTS collection_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    platform VARCHAR(50),
    account_id VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    result JSONB,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API logs table
CREATE TABLE IF NOT EXISTS api_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10),
    path TEXT,
    status_code INTEGER,
    response_time INTEGER,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_feishu_user_id ON users(feishu_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON metrics(platform);
CREATE INDEX IF NOT EXISTS idx_metrics_account_id ON metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_metrics_metric_type ON metrics(metric_type);

-- Collection jobs indexes
CREATE INDEX IF NOT EXISTS idx_collection_jobs_status ON collection_jobs(status);
CREATE INDEX IF NOT EXISTS idx_collection_jobs_created_at ON collection_jobs(created_at);

-- API logs indexes
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);

-- ============================================
-- Functions
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Users update trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Metrics update trigger
DROP TRIGGER IF EXISTS update_metrics_updated_at ON metrics;
CREATE TRIGGER update_metrics_updated_at
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Collection jobs update trigger
DROP TRIGGER IF EXISTS update_collection_jobs_updated_at ON collection_jobs;
CREATE TRIGGER update_collection_jobs_updated_at
    BEFORE UPDATE ON collection_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Cleanup function for expired sessions
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sample data (optional - for development)
-- ============================================

-- Uncomment for development environment
-- INSERT INTO users (feishu_user_id, name, email) VALUES
--     ('dev_user_1', 'Developer User', 'dev@example.com')
-- ON CONFLICT (feishu_user_id) DO NOTHING;

-- ============================================
-- Permissions
-- ============================================

-- Grant permissions on schema
GRANT USAGE ON SCHEMA social_metrics TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA social_metrics TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA social_metrics TO postgres;

-- ============================================
-- Database information
-- ============================================

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Social Media Metrics database initialized successfully';
    RAISE NOTICE 'Schema: social_metrics';
    RAISE NOTICE 'Timestamp: %', CURRENT_TIMESTAMP;
END $$;
