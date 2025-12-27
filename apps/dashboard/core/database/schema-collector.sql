-- Social Media Metrics Collection Database Schema

-- Accounts table: Store configured social media accounts
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    storage_state JSONB,
    storage_state_updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, account_id)
);

-- Metrics table: Store daily collected metrics
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    collection_date DATE NOT NULL,
    followers_total INTEGER,
    followers_delta INTEGER,
    impressions BIGINT,
    engagements INTEGER,
    posts_published INTEGER,
    top_post_url TEXT,
    top_post_engagement INTEGER,
    raw_data JSONB,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, account_id, collection_date)
);

-- Daily reports table: Store aggregated daily reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    total_accounts INTEGER,
    total_followers_delta INTEGER,
    total_impressions BIGINT,
    total_engagements INTEGER,
    total_posts INTEGER,
    by_platform JSONB,
    notion_page_id VARCHAR(255),
    notion_url TEXT,
    summary_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs table: Store operational logs
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    platform VARCHAR(50),
    account_id VARCHAR(255),
    message TEXT NOT NULL,
    meta JSONB,
    workflow VARCHAR(100),
    node VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Health checks table: Track login status
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    is_logged_in BOOLEAN NOT NULL,
    reason TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table: Track sent notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- login_required, team_daily, ops_alert
    platform VARCHAR(50),
    account_id VARCHAR(255),
    message TEXT,
    channels JSONB,
    metadata JSONB,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_metrics_platform_account ON metrics(platform, account_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(collection_date);
CREATE INDEX IF NOT EXISTS idx_metrics_platform_date ON metrics(platform, collection_date);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_platform ON logs(platform);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

CREATE INDEX IF NOT EXISTS idx_health_checks_platform_account ON health_checks(platform, account_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked ON health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(sent_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample seed data (optional)
INSERT INTO accounts (platform, account_id, display_name, is_active) VALUES
    ('xhs', 'xhs_main', '小红书-主号', true),
    ('weibo', 'weibo_main', '微博-主号', true),
    ('x', 'x_main', 'X-主号', true)
ON CONFLICT (platform, account_id) DO NOTHING;
