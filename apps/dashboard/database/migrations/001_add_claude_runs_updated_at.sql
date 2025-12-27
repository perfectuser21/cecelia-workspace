-- Add updated_at column to claude_runs table
ALTER TABLE claude_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_claude_runs_updated_at ON claude_runs(updated_at DESC);
