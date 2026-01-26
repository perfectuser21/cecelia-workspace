/**
 * useSSE Hook - Manage SSE (Server-Sent Events) connection
 *
 * Features:
 * - Auto-connect on mount
 * - Auto-reconnect on disconnect
 * - Event dispatching
 * - Connection state management
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEEvent = {
  type: string;
  data: unknown;
  timestamp?: string;
};

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface UseSSEOptions {
  url: string;
  onEvent?: (event: SSEEvent) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useSSE(options: UseSSEOptions) {
  const { url, onEvent, autoReconnect = true, reconnectDelay = 3000 } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    setConnectionState('connecting');
    setError(null);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      console.log('SSE: Connected');
      setConnectionState('connected');
      setError(null);
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      console.error('SSE: Connection error');
      setConnectionState('error');
      setError('Connection failed');

      // Close and cleanup
      eventSource.close();
      eventSourceRef.current = null;

      // Auto-reconnect
      if (autoReconnect && mountedRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            console.log('SSE: Reconnecting...');
            connect();
          }
        }, reconnectDelay);
      }
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);
        const sseEvent: SSEEvent = {
          type: event.type || 'message',
          data,
          timestamp: new Date().toISOString(),
        };

        setLastEvent(sseEvent);
        onEvent?.(sseEvent);
      } catch (error) {
        console.error('SSE: Error parsing event data:', error);
      }
    };

    // Listen to all custom events
    const eventTypes = [
      'task.created',
      'task.started',
      'task.checkpoint',
      'task.completed',
      'task.failed',
      'system.status',
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (event: Event) => {
        if (!mountedRef.current) return;

        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          const sseEvent: SSEEvent = {
            type,
            data,
            timestamp: new Date().toISOString(),
          };

          setLastEvent(sseEvent);
          onEvent?.(sseEvent);
        } catch (error) {
          console.error(`SSE: Error parsing ${type} event:`, error);
        }
      });
    });
  }, [url, onEvent, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState('disconnected');
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState,
    lastEvent,
    error,
    connect,
    disconnect,
  };
}
