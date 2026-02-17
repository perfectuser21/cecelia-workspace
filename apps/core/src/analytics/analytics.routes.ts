/**
 * Analytics API Routes
 * Week 2-3 User Behavior Tracking Endpoints
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import * as analyticsService from './analytics.service.js';
import type { TrackEventRequest, AnalyticsQuery } from './analytics.types.js';

const router = Router();

/**
 * POST /api/analytics/track
 * Track a single event
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const eventData: TrackEventRequest = req.body;

    // Validation
    if (!eventData.event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    const result = await analyticsService.trackEvent(eventData);
    res.json(result);
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * POST /api/analytics/batch
 * Track multiple events in batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const events: TrackEventRequest[] = req.body.events;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const result = await analyticsService.trackEventsBatch(events);
    res.json(result);
  } catch (error) {
    console.error('Error tracking batch events:', error);
    res.status(500).json({ error: 'Failed to track batch events' });
  }
});

/**
 * GET /api/analytics/events
 * Query events with optional filters
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const query: AnalyticsQuery = {
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      user_id: req.query.user_id as string,
      event_type: req.query.event_type as any,
      feature_name: req.query.feature_name as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const events = await analyticsService.getEvents(query);
    res.json(events);
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * GET /api/analytics/sessions
 * Query sessions with optional filters
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const query: AnalyticsQuery = {
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      user_id: req.query.user_id as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const sessions = await analyticsService.getSessions(query);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * POST /api/analytics/sessions/:sessionId/end
 * End a session
 */
router.post('/sessions/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await analyticsService.endSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * GET /api/analytics/metrics/daily
 * Get daily aggregated metrics
 */
router.get('/metrics/daily', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const metrics = await analyticsService.getDailyMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting daily metrics:', error);
    res.status(500).json({ error: 'Failed to get daily metrics' });
  }
});

/**
 * GET /api/analytics/metrics/sessions
 * Get session metrics
 */
router.get('/metrics/sessions', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const metrics = await analyticsService.getSessionMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting session metrics:', error);
    res.status(500).json({ error: 'Failed to get session metrics' });
  }
});

/**
 * GET /api/analytics/metrics/users
 * Get user metrics (DAU, WAU, MAU)
 */
router.get('/metrics/users', async (req: Request, res: Response) => {
  try {
    const metrics = await analyticsService.getUserMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting user metrics:', error);
    res.status(500).json({ error: 'Failed to get user metrics' });
  }
});

/**
 * GET /api/analytics/features/adoption
 * Get feature adoption metrics
 */
router.get('/features/adoption', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const adoption = await analyticsService.getFeatureAdoption(startDate, endDate);
    res.json(adoption);
  } catch (error) {
    console.error('Error getting feature adoption:', error);
    res.status(500).json({ error: 'Failed to get feature adoption' });
  }
});

/**
 * GET /api/analytics/engagement/score
 * Get engagement score
 */
router.get('/engagement/score', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const score = await analyticsService.getEngagementScore(userId);
    res.json(score);
  } catch (error) {
    console.error('Error getting engagement score:', error);
    res.status(500).json({ error: 'Failed to get engagement score' });
  }
});

/**
 * GET /api/analytics/metrics/realtime
 * Get realtime metrics
 */
router.get('/metrics/realtime', async (req: Request, res: Response) => {
  try {
    const metrics = await analyticsService.getRealtimeMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting realtime metrics:', error);
    res.status(500).json({ error: 'Failed to get realtime metrics' });
  }
});

/**
 * POST /api/analytics/aggregate/:date
 * Manually trigger daily metrics aggregation
 */
router.post('/aggregate/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    await analyticsService.aggregateDailyMetrics(date);
    res.json({ success: true, date });
  } catch (error) {
    console.error('Error aggregating daily metrics:', error);
    res.status(500).json({ error: 'Failed to aggregate daily metrics' });
  }
});

export default router;
