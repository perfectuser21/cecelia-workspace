/**
 * Event Bus - Pub/Sub pattern for real-time event broadcasting
 *
 * Supports SSE (Server-Sent Events) for frontend real-time updates
 */

export type EventType =
  | 'task.created'
  | 'task.started'
  | 'task.checkpoint'
  | 'task.completed'
  | 'task.failed'
  | 'system.status';

export interface Event {
  type: EventType;
  data: unknown;
  timestamp: string;
}

type EventCallback = (event: Event) => void;

class EventBus {
  private subscribers: Set<EventCallback> = new Set();

  /**
   * Emit an event to all subscribers
   */
  emit(type: EventType, data: unknown): void {
    const event: Event = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('EventBus: Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Subscribe to events
   * Returns an unsubscribe function
   */
  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(callback: EventCallback): void {
    this.subscribers.delete(callback);
  }

  /**
   * Get the number of active subscribers
   */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.subscribers.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();
