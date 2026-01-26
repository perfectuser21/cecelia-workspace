/**
 * EventFeed Component
 * Real-time event log display
 */

import { useState, useRef, useEffect } from 'react';
import { SSEEvent } from '../hooks/useSSE';

interface EventFeedProps {
  events: SSEEvent[];
}

export function EventFeed({ events }: EventFeedProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isCollapsed) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isCollapsed]);

  const getEventColor = (type: string) => {
    if (type.includes('completed')) return 'text-green-600';
    if (type.includes('failed') || type.includes('error')) return 'text-red-600';
    if (type.includes('started') || type.includes('created')) return 'text-blue-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div
        className="px-4 py-2 border-b border-gray-200 bg-white rounded-t-lg cursor-pointer hover:bg-gray-50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Event Feed ({events.length})</h3>
          <button className="text-gray-500 hover:text-gray-700">
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Events */}
      {!isCollapsed && (
        <div className="px-4 py-2 max-h-48 overflow-y-auto space-y-2">
          {events.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No events yet</p>
          )}

          {events.map((event, index) => (
            <div key={index} className="text-xs font-mono">
              <span className="text-gray-400">
                [{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'now'}]
              </span>
              <span className={'ml-2 font-semibold ' + getEventColor(event.type)}>{event.type}</span>
              <span className="ml-2 text-gray-600">
                {JSON.stringify(event.data).substring(0, 100)}
              </span>
            </div>
          ))}

          <div ref={eventsEndRef} />
        </div>
      )}
    </div>
  );
}
