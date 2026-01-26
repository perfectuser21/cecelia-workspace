/**
 * Chat Routes - AI chat interface endpoints
 */

import { Router, Request, Response } from 'express';
import { mindService } from './services/mind-service.js';
import { eventBus } from './services/event-bus.js';

const router = Router();

interface ChatRequest {
  message: string;
  context?: {
    project?: string;
    session_id?: string;
  };
}

interface ChatResponse {
  success: boolean;
  intent?: string;
  response?: string;
  data?: unknown;
  error?: string;
}

/**
 * POST /api/cecelia/chat
 * Process user chat message and return AI response
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body as ChatRequest;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string',
      } as ChatResponse);
    }

    // Process message with Mind Service
    const result = await mindService.processMessage(message);

    // Handle different intents
    let responseData: unknown = null;

    switch (result.intent) {
      case 'create_task':
        // TODO: Integrate with task creation API
        responseData = {
          task_id: 'pending',
          feature: result.entities.feature_description,
        };
        eventBus.emit('task.created', {
          message,
          context,
          ...result.entities,
        });
        break;

      case 'check_status':
        // TODO: Get running tasks from database
        responseData = {
          running_tasks: [],
          total: 0,
        };
        break;

      case 'get_task_detail':
        // TODO: Get task detail from database
        responseData = {
          task_id: result.entities.task_id,
          status: 'unknown',
        };
        break;

      case 'system_check':
        responseData = {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          subscribers: eventBus.subscriberCount,
        };
        eventBus.emit('system.status', responseData);
        break;

      case 'general_chat':
        // No special data for general chat
        break;
    }

    return res.json({
      success: true,
      intent: result.intent,
      response: result.response,
      data: responseData,
    } as ChatResponse);
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as ChatResponse);
  }
});

/**
 * GET /api/cecelia/chat/health
 * Check if chat service is available
 */
router.get('/chat/health', (_req: Request, res: Response) => {
  const available = mindService.isAvailable();

  return res.json({
    success: true,
    openai_available: available,
    message: available
      ? 'Chat service is ready'
      : 'Chat service is running with fallback mode (OpenAI unavailable)',
  });
});

export default router;
