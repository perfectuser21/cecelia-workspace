-- Migration 004: Create Analytics Tables for User Behavior Tracking
-- Purpose: Track user engagement, feature usage, and activity patterns (Week 2-3 critical period)

-- 1. Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,           -- 'page_view', 'feature_use', 'custom'
  user_id TEXT,                        -- User identifier (optional, can be anonymous)
  session_id TEXT NOT NULL,            -- Session ID for grouping events
  page_path TEXT,                      -- Page path for page_view events
  feature_name TEXT,                   -- Feature name for feature_use events
  action TEXT,                         -- Action type (click, submit, etc.)
  metadata JSONB DEFAULT '{}',         -- Additional event data
  timestamp TIMESTAMPTZ DEFAULT NOW(), -- Event timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_feature ON analytics_events(feature_name) WHERE feature_name IS NOT NULL;

-- 2. Analytics Sessions Table
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  feature_interactions INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_started ON analytics_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON analytics_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_ended ON analytics_sessions(ended_at DESC) WHERE ended_at IS NOT NULL;

-- 3. Analytics Daily Metrics Table (Aggregated data for performance)
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_seconds NUMERIC,
  total_page_views INTEGER DEFAULT 0,
  total_feature_uses INTEGER DEFAULT 0,
  engagement_score NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON analytics_daily_metrics(date DESC);

-- Function to update session end time and duration
CREATE OR REPLACE FUNCTION update_session_end_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate session duration
DROP TRIGGER IF EXISTS trg_update_session_duration ON analytics_sessions;
CREATE TRIGGER trg_update_session_duration
  BEFORE UPDATE ON analytics_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_end_time();

-- Comments for documentation
COMMENT ON TABLE analytics_events IS 'Stores individual user events for tracking behavior and engagement';
COMMENT ON TABLE analytics_sessions IS 'Tracks user sessions with aggregated metrics';
COMMENT ON TABLE analytics_daily_metrics IS 'Pre-aggregated daily metrics for dashboard performance';
COMMENT ON COLUMN analytics_events.event_type IS 'Type of event: page_view, feature_use, or custom';
COMMENT ON COLUMN analytics_sessions.duration_seconds IS 'Automatically calculated when ended_at is set';
COMMENT ON COLUMN analytics_daily_metrics.engagement_score IS 'Calculated engagement score based on activity metrics';
