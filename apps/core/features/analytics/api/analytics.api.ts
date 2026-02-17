/**
 * Analytics API Client
 * Frontend API for Week 2-3 User Behavior Tracking
 */

import { apiClient } from '../../shared/api/client';

export interface TrackEventRequest {
  event_type: 'page_view' | 'feature_use' | 'custom';
  user_id?: string;
  session_id?: string;
  page_path?: string;
  feature_name?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface DailyMetrics {
  date: string;
  total_users: number;
  active_users: number;
  new_users: number;
  total_sessions: number;
  avg_session_duration_seconds: number;
  total_page_views: number;
  total_feature_uses: number;
  engagement_score: number;
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
  adoption_rate: number;
}

export interface RealtimeMetrics {
  timestamp: string;
  active_users_now: number;
  events_last_5_min: number;
  top_pages: Array<{ path: string; views: number }>;
  top_features: Array<{ name: string; uses: number }>;
}

/**
 * Track an event
 */
export async function trackEvent(data: TrackEventRequest) {
  return apiClient.post('/analytics/track', data);
}

/**
 * Get daily metrics
 */
export async function getDailyMetrics(startDate?: string, endDate?: string): Promise<DailyMetrics[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await apiClient.get(`/analytics/metrics/daily?${params.toString()}`);
  return response.data;
}

/**
 * Get user metrics
 */
export async function getUserMetrics(): Promise<UserMetrics> {
  const response = await apiClient.get('/analytics/metrics/users');
  return response.data;
}

/**
 * Get feature adoption
 */
export async function getFeatureAdoption(startDate?: string, endDate?: string): Promise<FeatureAdoption[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await apiClient.get(`/analytics/features/adoption?${params.toString()}`);
  return response.data;
}

/**
 * Get realtime metrics
 */
export async function getRealtimeMetrics(): Promise<RealtimeMetrics> {
  const response = await apiClient.get('/analytics/metrics/realtime');
  return response.data;
}
