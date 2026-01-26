/**
 * Cecelia Console Page
 * AI chat interface with real-time status monitoring
 */

import { useState, useCallback } from 'react';
import { useSSE, SSEEvent } from '../hooks/useSSE';
import { ChatWindow } from '../components/ChatWindow';
import { StatusPanel } from '../components/StatusPanel';
import { EventFeed } from '../components/EventFeed';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function CeceliaConsole() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // SSE connection
  const { connectionState } = useSSE({
    url: '/api/cecelia/stream',
    onEvent: useCallback((event: SSEEvent) => {
      setEvents((prev) => [...prev, event].slice(-100)); // Keep last 100 events
    }, []),
  });

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);

    try {
      // Send to chat API
      const response = await fetch('/api/cecelia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'No response',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your message.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Cecelia Console</h1>
        <p className="text-sm text-gray-500">AI-powered development assistant</p>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6 space-y-4">
        <div className="flex gap-4 h-[calc(100%-12rem)]">
          {/* Left: Chat Window (60%) */}
          <div className="w-[60%]">
            <ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>

          {/* Right: Status Panel (40%) */}
          <div className="w-[40%]">
            <StatusPanel tasks={[]} connectionState={connectionState} />
          </div>
        </div>

        {/* Bottom: Event Feed */}
        <div className="h-auto">
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}
