/**
 * useAnalytics Hook
 * Simplified analytics tracking for Week 2-3 User Behavior
 */

import { useCallback, useEffect, useRef } from 'react';
import { trackEvent, type TrackEventRequest } from '../../analytics/api/analytics.api';

// Generate or retrieve session ID from sessionStorage
function getSessionId(): string {
  const key = 'analytics_session_id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

export function useAnalytics() {
  const sessionId = useRef(getSessionId());

  /**
   * Track a page view
   */
  const trackPageView = useCallback((pagePath: string, metadata?: Record<string, any>) => {
    trackEvent({
      event_type: 'page_view',
      session_id: sessionId.current,
      page_path: pagePath,
      metadata
    }).catch(err => {
      console.warn('Analytics tracking failed:', err);
    });
  }, []);

  /**
   * Track a feature usage
   */
  const trackFeature = useCallback((featureName: string, action?: string, metadata?: Record<string, any>) => {
    trackEvent({
      event_type: 'feature_use',
      session_id: sessionId.current,
      feature_name: featureName,
      action,
      metadata
    }).catch(err => {
      console.warn('Analytics tracking failed:', err);
    });
  }, []);

  /**
   * Track a custom event
   */
  const trackCustomEvent = useCallback((data: Omit<TrackEventRequest, 'session_id'>) => {
    trackEvent({
      ...data,
      session_id: sessionId.current
    }).catch(err => {
      console.warn('Analytics tracking failed:', err);
    });
  }, []);

  // Auto-track page view on mount
  useEffect(() => {
    const path = window.location.pathname;
    trackPageView(path);
  }, [trackPageView]);

  return {
    trackPageView,
    trackFeature,
    trackCustomEvent,
    sessionId: sessionId.current
  };
}
