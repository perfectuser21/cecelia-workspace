// Configuration management
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.COLLECTOR_API_KEY || 'dev-api-key-change-me',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'n8n_social_metrics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },

  // Workers
  workers: {
    headless: process.env.WORKERS_HEADLESS !== 'false',
    timeout: parseInt(process.env.WORKERS_TIMEOUT || '120000', 10),
    maxConcurrent: parseInt(process.env.WORKERS_MAX_CONCURRENT || '5', 10),
  },

  // Storage
  storage: {
    sessionPath: process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), 'data/sessions'),
    screenshotPath: process.env.SCREENSHOT_PATH || path.join(process.cwd(), 'data/screenshots'),
  },

  // Notifications
  notifications: {
    feishu: {
      webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    },
  },

  // Notion
  notion: {
    apiKey: process.env.NOTION_API_KEY || '',
    databaseId: process.env.NOTION_DATABASE_ID || '',
    // 任务库配置
    tasksDbId: process.env.NOTION_TASKS_DB_ID || '',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

export default config;
