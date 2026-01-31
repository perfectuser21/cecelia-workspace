import { useState, useEffect, useRef, useCallback } from 'react';

interface SeatsSlot {
  slot: number;
  mode: string;
  task_id?: string;
  title?: string;
  started?: string;
  duration?: string;
}

interface SeatsData {
  total: number;
  active: number;
  slots: SeatsSlot[];
}

interface TaskStep {
  id: number;
  name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
}

interface TaskRun {
  id: string;
  project: string;
  feature_branch: string;
  status: string;
  total_checkpoints: number;
  completed_checkpoints: number;
  failed_checkpoints: number;
  current_action?: string;
  current_step?: number;
  steps?: TaskStep[];
  pr_url?: string;
  started_at: string;
  updated_at: string;
  prd_title?: string;
}

interface OverviewData {
  total_runs: number;
  running: number;
  completed: number;
  failed: number;
  recent_runs: TaskRun[];
}

export interface SSEData {
  seats: SeatsData | null;
  overview: OverviewData | null;
  connected: boolean;
  error: string | null;
}

export type { SeatsSlot, SeatsData, TaskRun, TaskStep, OverviewData };

export function useSSE(url: string = '/api/cecelia/stream'): SSEData {
  const [data, setData] = useState<SSEData>({ seats: null, overview: null, connected: false, error: null });
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFallback = useCallback(async () => {
    try {
      const [seatsRes, overviewRes] = await Promise.all([
        fetch('/api/cecelia/seats'),
        fetch('/api/cecelia/overview'),
      ]);
      const seats = await seatsRes.json();
      const overview = await overviewRes.json();
      setData(prev => ({ ...prev, seats, overview, error: null }));
    } catch {
      setData(prev => ({ ...prev, error: 'Polling failed' }));
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    fetchFallback();
    pollingRef.current = setInterval(fetchFallback, 30000);
  }, [fetchFallback]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setData(prev => ({ ...prev, connected: true, error: null }));
      stopPolling();
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          setData(prev => ({ ...prev, error: parsed.error }));
          return;
        }
        setData({
          seats: parsed.seats || null,
          overview: parsed.overview || null,
          connected: true,
          error: null,
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setData(prev => ({ ...prev, connected: false, error: 'SSE disconnected' }));
      startPolling();
      // Reconnect after 3s
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [url, startPolling, stopPolling]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return data;
}
