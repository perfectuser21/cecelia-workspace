-- Workflow Execution Tracker
-- 用于追踪 AI 工厂执行过程的可视化

-- 运行记录表
CREATE TABLE IF NOT EXISTS workflow_runs (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(64) UNIQUE NOT NULL,
  bundle VARCHAR(64) NOT NULL,
  workflow VARCHAR(128),
  current_phase VARCHAR(16) NOT NULL DEFAULT 'PREPARE',
  current_substep VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_duration_ms INTEGER,
  prd_summary TEXT,
  state_dir VARCHAR(256),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_run_id ON workflow_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_bundle ON workflow_runs(bundle);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- 事件记录表
CREATE TABLE IF NOT EXISTS workflow_events (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES workflow_runs(run_id) ON DELETE CASCADE,
  phase VARCHAR(16) NOT NULL,
  substep VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  message TEXT,
  duration_ms INTEGER,
  -- V2: 富事件字段
  event_type VARCHAR(32),                -- prd_read, ai_understand, task_start, file_write, etc.
  description TEXT,                      -- 人类可读描述
  details JSONB,                         -- 结构化详情
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_run_id ON workflow_events(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_phase ON workflow_events(phase);
CREATE INDEX IF NOT EXISTS idx_workflow_events_created_at ON workflow_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_events_event_type ON workflow_events(event_type);

-- V2: 添加新字段（如果表已存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_events' AND column_name = 'event_type') THEN
    ALTER TABLE workflow_events ADD COLUMN event_type VARCHAR(32);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_events' AND column_name = 'description') THEN
    ALTER TABLE workflow_events ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_events' AND column_name = 'details') THEN
    ALTER TABLE workflow_events ADD COLUMN details JSONB;
  END IF;
END $$;
