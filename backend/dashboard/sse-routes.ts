/**
 * SSE Routes - Server-Sent Events for real-time updates
 */

import { Router, Request, Response } from 'express';
import { eventBus, Event } from './services/event-bus.js';

const router = Router();

/**
 * GET /api/cecelia/stream
 * SSE endpoint for real-time event stream
 */
router.get('/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Disable timeout
  req.socket.setTimeout(0);

  // Send initial connection message
  res.write('data: ' + JSON.stringify({ type: 'connected', message: 'SSE connection established' }) + '\n\n');

  // Subscribe to event bus
  const handleEvent = (event: Event) => {
    try {
      res.write('event: ' + event.type + '\n');
      res.write('data: ' + JSON.stringify(event.data) + '\n\n');
    } catch (error) {
      console.error('SSE: Error sending event:', error);
    }
  };

  const unsubscribe = eventBus.subscribe(handleEvent);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      console.error('SSE: Error sending heartbeat:', error);
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log('SSE: Client disconnected');
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
