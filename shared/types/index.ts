// Type Definitions for Social Media Scraper API

export type Platform = 'xhs' | 'weibo' | 'x' | 'douyin' | 'toutiao' | 'shipin';

export interface Account {
  id: number;
  platform: Platform;
  account_id: string;
  display_name: string;
  storage_state?: string;
  is_logged_in: boolean;
  is_active: boolean;
  last_health_check?: Date;
  owner_user_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Metric {
  id: number;
  account_id: number;
  platform: Platform;
  collection_date: string;
  followers_total: number;
  followers_delta: number;
  impressions: number;
  engagements: number;
  posts_published: number;
  created_at: Date;
  updated_at: Date;
}

export interface DailyReport {
  id: number;
  report_date: string;
  total_accounts: number;
  total_followers_delta: number;
  total_impressions: number;
  total_engagements: number;
  by_platform: Record<string, any>;
  notion_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Log {
  id: number;
  user_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CollectDailyRequest {
  platform: Platform;
  accountId: string;
  date: string;
}

export interface CollectDailyResponse {
  platform: Platform;
  accountId: string;
  date: string;
  followers_total: number;
  followers_delta: number;
  impressions: number;
  engagements: number;
  posts_published: number;
  top_post_url?: string;
  top_post_engagement?: number;
}

export interface HealthCheckRequest {
  platform: Platform;
  accountId: string;
}

export interface HealthCheckResponse {
  loggedIn: boolean;
  reason?: string;
}

export interface LoginSession {
  sessionId: string;
  platform: Platform;
  accountId: string;
  status: 'pending' | 'success' | 'expired' | 'failed';
  qrCodeUrl?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ApiError {
  error: string;
  details?: string;
  statusCode?: number;
}

// Request/Response types
export interface StartLoginResponse {
  sessionId: string;
  qrCodeUrl?: string;
  status: 'pending';
}

export interface LoginStatusResponse {
  status: 'pending' | 'success' | 'expired' | 'failed';
  reason?: string;
}

export interface SaveSessionRequest {
  sessionId: string;
  storageState: string;
}

export interface StoreMetricsRequest extends CollectDailyResponse {}

export interface StoreMetricsResponse {
  ok: true;
  id: string;
}

export interface NotifyLoginRequiredRequest {
  platform: Platform;
  accountId: string;
  reason: string;
  loginUrl: string;
}

export interface NotifyLoginRequiredResponse {
  ok: true;
  notified: string[];
}

export interface NotifyTeamDailyRequest {
  date: string;
  summaryText: string;
  notionUrl: string;
}

export interface NotifyTeamDailyResponse {
  ok: true;
  channels: string[];
}

export interface NotifyOpsAlertRequest {
  where: string;
  workflow: string;
  node: string;
  platform: Platform;
  accountId: string;
  error: string;
  meta?: Record<string, any>;
}

export interface NotifyOpsAlertResponse {
  ok: true;
  alertId: string;
}

export interface CreateLogRequest {
  level: 'info' | 'warn' | 'error' | 'debug';
  platform?: Platform;
  accountId?: string;
  message: string;
  meta?: Record<string, any>;
}

export interface CreateLogResponse {
  ok: true;
  logId: string;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  schedule?: string;
  enabled: boolean;
}
