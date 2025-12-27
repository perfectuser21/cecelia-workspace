-- 自媒体数据采集系统数据库结构
-- PostgreSQL

-- 1. 用户表（飞书登录）
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  feishu_user_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(500),
  email VARCHAR(100),
  mobile VARCHAR(50),
  department_ids TEXT[], -- 部门ID数组
  role VARCHAR(50) DEFAULT 'user', -- user, admin
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_feishu_id ON users(feishu_user_id);

-- 2. 社交媒体账号表
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL, -- douyin, xhs, weibo, toutiao, shipin
  account_id VARCHAR(100) NOT NULL, -- 平台内的账号ID
  display_name VARCHAR(200) NOT NULL,
  storage_state TEXT, -- Playwright session (JSON)
  is_logged_in BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_health_check TIMESTAMP,
  owner_user_id INTEGER REFERENCES users(id), -- 账号负责人
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, account_id)
);

CREATE INDEX idx_accounts_platform ON accounts(platform);
CREATE INDEX idx_accounts_owner ON accounts(owner_user_id);

-- 3. 指标数据表（时序数据）
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  collection_date DATE NOT NULL,
  followers_total BIGINT DEFAULT 0,
  followers_delta INTEGER DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  engagements BIGINT DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, collection_date)
);

CREATE INDEX idx_metrics_account ON metrics(account_id);
CREATE INDEX idx_metrics_date ON metrics(collection_date);
CREATE INDEX idx_metrics_platform ON metrics(platform);

-- 4. 日报表
CREATE TABLE IF NOT EXISTS daily_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE UNIQUE NOT NULL,
  total_accounts INTEGER DEFAULT 0,
  total_followers_delta BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_engagements BIGINT DEFAULT 0,
  by_platform JSONB, -- 按平台汇总的数据
  notion_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);

-- 5. 操作日志表
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- login, logout, collect, update_account, etc.
  resource_type VARCHAR(50), -- account, metric, report
  resource_id INTEGER,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_user ON logs(user_id);
CREATE INDEX idx_logs_action ON logs(action);
CREATE INDEX idx_logs_created_at ON logs(created_at);

-- 6. 权限表（用户-账号关联）
CREATE TABLE IF NOT EXISTS user_account_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  permission VARCHAR(50) DEFAULT 'view', -- view, edit, manage
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, account_id)
);

CREATE INDEX idx_permissions_user ON user_account_permissions(user_id);
CREATE INDEX idx_permissions_account ON user_account_permissions(account_id);

-- 初始化数据（示例）
-- 插入测试用户（可选）
-- INSERT INTO users (feishu_user_id, name, email, role) VALUES
--   ('admin_001', '管理员', 'admin@company.com', 'admin');

-- 插入示例账号（可选）
-- INSERT INTO accounts (platform, account_id, display_name, is_active) VALUES
--   ('douyin', 'dy_main', '抖音-主号', true),
--   ('xhs', 'xhs_main', '小红书-主号', true),
--   ('weibo', 'wb_main', '微博-主号', true);

-- 7. 发布任务表
CREATE TABLE IF NOT EXISTS publish_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  media_type VARCHAR(20) NOT NULL, -- 'image' | 'video' | 'text'
  original_files JSONB DEFAULT '[]', -- 原始文件路径数组
  processed_files JSONB DEFAULT '{}', -- 各平台处理后的文件 { platform: [paths] }
  target_platforms TEXT[] NOT NULL, -- ['xhs', 'weibo', 'x', 'website']
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending, processing, completed, failed, partial
  schedule_at TIMESTAMP, -- 定时发布时间，NULL 表示立即发布
  results JSONB DEFAULT '{}', -- 各平台发布结果 { platform: { success, url, error } }
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX idx_publish_tasks_created_by ON publish_tasks(created_by);
CREATE INDEX idx_publish_tasks_created_at ON publish_tasks(created_at);
CREATE INDEX idx_publish_tasks_schedule_at ON publish_tasks(schedule_at);

-- 8. 媒体文件表
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- 视频时长（秒）
  thumbnail_path VARCHAR(1000),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_files_created_by ON media_files(created_by);
CREATE INDEX idx_media_files_created_at ON media_files(created_at);

-- 9. 网站内容表（供 zenithjoyai.com 使用）
CREATE TABLE IF NOT EXISTS website_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(200) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT, -- SEO 描述
  body TEXT, -- Markdown 内容
  content_type VARCHAR(20) NOT NULL, -- 'article' | 'video' | 'post'
  lang VARCHAR(10) DEFAULT 'zh', -- 'zh' | 'en'
  tags TEXT[] DEFAULT '{}',
  reading_time VARCHAR(20), -- '5 分钟'
  faq JSONB DEFAULT '[]', -- FAQ 数据 [{ question, answer }]
  key_takeaways TEXT[] DEFAULT '{}', -- GEO 优化：核心要点
  quotable_insights TEXT[] DEFAULT '{}', -- GEO 优化：可引用金句
  video_url VARCHAR(500), -- 视频链接（如果是视频内容）
  thumbnail_url VARCHAR(500), -- 缩略图
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'published'
  published_at TIMESTAMP, -- 发布时间
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slug, lang) -- 同一 slug 不同语言版本
);

CREATE INDEX idx_website_contents_slug ON website_contents(slug);
CREATE INDEX idx_website_contents_lang ON website_contents(lang);
CREATE INDEX idx_website_contents_type ON website_contents(content_type);
CREATE INDEX idx_website_contents_status ON website_contents(status);
CREATE INDEX idx_website_contents_published_at ON website_contents(published_at);

-- 10. Claude Monitor 会话记录表
CREATE TABLE IF NOT EXISTS claude_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE,
  source VARCHAR(50),           -- terminal/ssh/n8n/headless
  status VARCHAR(20) DEFAULT 'running',  -- running/done/error/canceled
  title TEXT,
  cwd TEXT,
  started_at BIGINT,
  ended_at BIGINT,
  token_input INTEGER DEFAULT 0,
  token_output INTEGER DEFAULT 0,
  model VARCHAR(100),
  parent_run_id UUID REFERENCES claude_runs(id) ON DELETE SET NULL,
  agent_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Claude Monitor 事件记录表
CREATE TABLE IF NOT EXISTS claude_events (
  id SERIAL PRIMARY KEY,
  run_id UUID REFERENCES claude_runs(id) ON DELETE CASCADE,
  type VARCHAR(50),
  tool_name VARCHAR(50),
  payload JSONB,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Claude Monitor 索引
CREATE INDEX IF NOT EXISTS idx_claude_runs_session_id ON claude_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_claude_runs_status ON claude_runs(status);
CREATE INDEX IF NOT EXISTS idx_claude_runs_started_at ON claude_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_runs_parent_run_id ON claude_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_claude_events_run_id ON claude_events(run_id);
CREATE INDEX IF NOT EXISTS idx_claude_events_created_at ON claude_events(created_at DESC);

-- 12. VPS 监控指标历史数据表
CREATE TABLE IF NOT EXISTS vps_metrics (
  id SERIAL PRIMARY KEY,
  cpu_usage REAL,
  memory_usage_percent REAL,
  memory_used BIGINT,
  disk_usage_percent REAL,
  load_1min REAL,
  load_5min REAL,
  load_15min REAL,
  network_rx BIGINT,
  network_tx BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vps_metrics_created_at ON vps_metrics(created_at DESC);
