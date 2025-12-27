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
