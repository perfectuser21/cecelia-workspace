/**
 * Analytics Types
 * Week 2-3 User Behavior Tracking
 */

export type EventType = 'page_view' | 'feature_use' | 'custom';

export interface AnalyticsEvent {
  id?: string;
  event_type: EventType;
  user_id?: string;
  session_id: string;
  page_path?: string;
  feature_name?: string;
  action?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  created_at?: Date;
}

export interface AnalyticsSession {
  id?: string;
  session_id: string;
  user_id?: string;
  started_at: Date;
  ended_at?: Date;
  duration_seconds?: number;
  page_views?: number;
  feature_interactions?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface DailyMetrics {
  id?: string;
  date: string; // YYYY-MM-DD
  total_users: number;
  active_users: number;
  new_users: number;
  total_sessions: number;
  avg_session_duration_seconds: number;
  total_page_views: number;
  total_feature_uses: number;
  engagement_score: number;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface TrackEventRequest {
  event_type: EventType;
  user_id?: string;
  session_id?: string; // Optional, will be generated if not provided
  page_path?: string;
  feature_name?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface TrackEventResponse {
  success: boolean;
  event_id: string;
  session_id: string;
}

export interface SessionMetrics {
  total_sessions: number;
  active_sessions: number;
  avg_duration_seconds: number;
  total_page_views: number;
  total_feature_interactions: number;
}

export interface UserMetrics {
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  new_users_today: number;
}

export interface FeatureAdoption {
  feature_name: string;
  usage_count: number;
  unique_users: number;
  adoption_rate: number; // Percentage of total users
}

export interface EngagementScore {
  score: number; // 0-100
  page_view_score: number;
  feature_use_score: number;
  session_duration_score: number;
  return_visit_score: number;
}

export interface AnalyticsQuery {
  start_date?: string; // ISO date
  end_date?: string; // ISO date
  user_id?: string;
  event_type?: EventType;
  feature_name?: string;
  limit?: number;
  offset?: number;
}

export interface RealtimeMetrics {
  timestamp: string;
  active_users_now: number;
  events_last_5_min: number;
  top_pages: Array<{ path: string; views: number }>;
  top_features: Array<{ name: string; uses: number }>;
}
