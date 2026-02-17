/**
 * Analytics Service
 * Handles user behavior tracking, session management, and metrics calculation
 */

import pool from '../task-system/db.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnalyticsEvent,
  AnalyticsSession,
  DailyMetrics,
  TrackEventRequest,
  TrackEventResponse,
  SessionMetrics,
  UserMetrics,
  FeatureAdoption,
  EngagementScore,
  AnalyticsQuery,
  RealtimeMetrics
} from './analytics.types.js';

/**
 * Track a single event
 */
export async function trackEvent(data: TrackEventRequest): Promise<TrackEventResponse> {
  const sessionId = data.session_id || generateSessionId();

  const result = await pool.query(
    `INSERT INTO analytics_events
      (event_type, user_id, session_id, page_path, feature_name, action, metadata, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id`,
    [
      data.event_type,
      data.user_id || null,
      sessionId,
      data.page_path || null,
      data.feature_name || null,
      data.action || null,
      data.metadata || {}
    ]
  );

  // Update or create session
  await upsertSession(sessionId, data.user_id, data.event_type);

  return {
    success: true,
    event_id: result.rows[0].id,
    session_id: sessionId
  };
}

/**
 * Track multiple events in batch
 */
export async function trackEventsBatch(events: TrackEventRequest[]): Promise<{ success: boolean; count: number }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const event of events) {
      await trackEvent(event);
    }

    await client.query('COMMIT');

    return { success: true, count: events.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get events with optional filtering
 */
export async function getEvents(query: AnalyticsQuery): Promise<AnalyticsEvent[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (query.start_date) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(query.start_date);
  }

  if (query.end_date) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(query.end_date);
  }

  if (query.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(query.user_id);
  }

  if (query.event_type) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(query.event_type);
  }

  if (query.feature_name) {
    conditions.push(`feature_name = $${paramIndex++}`);
    params.push(query.feature_name);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit || 100;
  const offset = query.offset || 0;

  const result = await pool.query(
    `SELECT * FROM analytics_events
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return result.rows;
}

/**
 * Get sessions
 */
export async function getSessions(query: AnalyticsQuery): Promise<AnalyticsSession[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (query.start_date) {
    conditions.push(`started_at >= $${paramIndex++}`);
    params.push(query.start_date);
  }

  if (query.end_date) {
    conditions.push(`started_at <= $${paramIndex++}`);
    params.push(query.end_date);
  }

  if (query.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(query.user_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit || 100;
  const offset = query.offset || 0;

  const result = await pool.query(
    `SELECT * FROM analytics_sessions
     ${whereClause}
     ORDER BY started_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return result.rows;
}

/**
 * Get daily metrics
 */
export async function getDailyMetrics(startDate?: string, endDate?: string): Promise<DailyMetrics[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`date >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`date <= $${paramIndex++}`);
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT * FROM analytics_daily_metrics
     ${whereClause}
     ORDER BY date DESC`,
    params
  );

  return result.rows;
}

/**
 * Get session metrics
 */
export async function getSessionMetrics(startDate?: string, endDate?: string): Promise<SessionMetrics> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`started_at >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`started_at <= $${paramIndex++}`);
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE ended_at IS NULL) as active_sessions,
      AVG(duration_seconds) as avg_duration_seconds,
      SUM(page_views) as total_page_views,
      SUM(feature_interactions) as total_feature_interactions
     FROM analytics_sessions
     ${whereClause}`,
    params
  );

  return result.rows[0];
}

/**
 * Get user metrics (DAU, WAU, MAU)
 */
export async function getUserMetrics(): Promise<UserMetrics> {
  const result = await pool.query(
    `SELECT
      COUNT(DISTINCT CASE WHEN DATE(timestamp) = CURRENT_DATE THEN user_id END) as daily_active_users,
      COUNT(DISTINCT CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN user_id END) as weekly_active_users,
      COUNT(DISTINCT CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '30 days' THEN user_id END) as monthly_active_users,
      COUNT(DISTINCT CASE WHEN DATE(created_at) = CURRENT_DATE THEN user_id END) as new_users_today
     FROM analytics_events
     WHERE user_id IS NOT NULL`
  );

  return result.rows[0];
}

/**
 * Get feature adoption metrics
 */
export async function getFeatureAdoption(startDate?: string, endDate?: string): Promise<FeatureAdoption[]> {
  const conditions: string[] = ['feature_name IS NOT NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);
  }

  const result = await pool.query(
    `WITH total_users AS (
      SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE user_id IS NOT NULL
    )
    SELECT
      feature_name,
      COUNT(*) as usage_count,
      COUNT(DISTINCT user_id) as unique_users,
      ROUND((COUNT(DISTINCT user_id)::numeric / (SELECT count FROM total_users)) * 100, 2) as adoption_rate
    FROM analytics_events
    WHERE ${conditions.join(' AND ')}
    GROUP BY feature_name
    ORDER BY usage_count DESC`,
    params
  );

  return result.rows;
}

/**
 * Calculate engagement score
 */
export async function getEngagementScore(userId?: string): Promise<EngagementScore> {
  // Simplified engagement score calculation
  // In production, this would be more sophisticated
  const result = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
      COUNT(*) FILTER (WHERE event_type = 'feature_use') as feature_uses,
      AVG(duration_seconds) as avg_session_duration
     FROM analytics_events e
     LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
     WHERE ($1::text IS NULL OR e.user_id = $1)
       AND e.timestamp >= CURRENT_DATE - INTERVAL '7 days'`,
    [userId || null]
  );

  const row = result.rows[0];

  // Calculate component scores (0-100)
  const pageViewScore = Math.min(100, (row.page_views || 0) * 5);
  const featureUseScore = Math.min(100, (row.feature_uses || 0) * 10);
  const sessionDurationScore = Math.min(100, ((row.avg_session_duration || 0) / 60) * 10);
  const returnVisitScore = 50; // Placeholder - would calculate from session frequency

  // Overall score (weighted average)
  const score = Math.round(
    (pageViewScore * 0.2 + featureUseScore * 0.4 + sessionDurationScore * 0.3 + returnVisitScore * 0.1)
  );

  return {
    score,
    page_view_score: pageViewScore,
    feature_use_score: featureUseScore,
    session_duration_score: sessionDurationScore,
    return_visit_score: returnVisitScore
  };
}

/**
 * Get realtime metrics
 */
export async function getRealtimeMetrics(): Promise<RealtimeMetrics> {
  const result = await pool.query(
    `SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= NOW() - INTERVAL '5 minutes') as active_users_now,
      COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '5 minutes') as events_last_5_min
     FROM analytics_events
     WHERE user_id IS NOT NULL`
  );

  const topPages = await pool.query(
    `SELECT page_path as path, COUNT(*) as views
     FROM analytics_events
     WHERE event_type = 'page_view'
       AND timestamp >= NOW() - INTERVAL '1 hour'
       AND page_path IS NOT NULL
     GROUP BY page_path
     ORDER BY views DESC
     LIMIT 5`
  );

  const topFeatures = await pool.query(
    `SELECT feature_name as name, COUNT(*) as uses
     FROM analytics_events
     WHERE event_type = 'feature_use'
       AND timestamp >= NOW() - INTERVAL '1 hour'
       AND feature_name IS NOT NULL
     GROUP BY feature_name
     ORDER BY uses DESC
     LIMIT 5`
  );

  return {
    timestamp: new Date().toISOString(),
    active_users_now: result.rows[0].active_users_now || 0,
    events_last_5_min: result.rows[0].events_last_5_min || 0,
    top_pages: topPages.rows,
    top_features: topFeatures.rows
  };
}

/**
 * Helper: Generate session ID
 */
function generateSessionId(): string {
  return `sess_${uuidv4()}`;
}

/**
 * Helper: Upsert session
 */
async function upsertSession(sessionId: string, userId?: string, eventType?: string): Promise<void> {
  const client = await pool.connect();

  try {
    // Check if session exists
    const existing = await client.query(
      'SELECT id FROM analytics_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (existing.rows.length === 0) {
      // Create new session
      await client.query(
        `INSERT INTO analytics_sessions
          (session_id, user_id, started_at, page_views, feature_interactions)
        VALUES ($1, $2, NOW(), $3, $4)`,
        [
          sessionId,
          userId || null,
          eventType === 'page_view' ? 1 : 0,
          eventType === 'feature_use' ? 1 : 0
        ]
      );
    } else {
      // Update existing session
      await client.query(
        `UPDATE analytics_sessions
         SET page_views = page_views + $1,
             feature_interactions = feature_interactions + $2,
             updated_at = NOW()
         WHERE session_id = $3`,
        [
          eventType === 'page_view' ? 1 : 0,
          eventType === 'feature_use' ? 1 : 0,
          sessionId
        ]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * End a session (mark as ended)
 */
export async function endSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE analytics_sessions
     SET ended_at = NOW()
     WHERE session_id = $1 AND ended_at IS NULL`,
    [sessionId]
  );
}

/**
 * Aggregate daily metrics (background job)
 */
export async function aggregateDailyMetrics(date: string): Promise<void> {
  const result = await pool.query(
    `WITH metrics AS (
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as total_users,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND timestamp >= $1::date) as active_users,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND created_at >= $1::date) as new_users,
        COUNT(DISTINCT session_id) as total_sessions,
        AVG(duration_seconds) as avg_duration,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as total_page_views,
        COUNT(*) FILTER (WHERE event_type = 'feature_use') as total_feature_uses
      FROM analytics_events e
      LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
      WHERE DATE(e.timestamp) = $1::date
    )
    INSERT INTO analytics_daily_metrics
      (date, total_users, active_users, new_users, total_sessions,
       avg_session_duration_seconds, total_page_views, total_feature_uses, engagement_score)
    SELECT
      $1::date,
      total_users,
      active_users,
      new_users,
      total_sessions,
      avg_duration,
      total_page_views,
      total_feature_uses,
      -- Simple engagement score calculation
      LEAST(100, (total_page_views * 0.3 + total_feature_uses * 0.7) / NULLIF(active_users, 0))
    FROM metrics
    ON CONFLICT (date) DO UPDATE
    SET total_users = EXCLUDED.total_users,
        active_users = EXCLUDED.active_users,
        new_users = EXCLUDED.new_users,
        total_sessions = EXCLUDED.total_sessions,
        avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
        total_page_views = EXCLUDED.total_page_views,
        total_feature_uses = EXCLUDED.total_feature_uses,
        engagement_score = EXCLUDED.engagement_score,
        updated_at = NOW()`,
    [date]
  );
}
