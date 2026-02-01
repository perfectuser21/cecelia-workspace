/**
 * Intent Recognition Controller
 * HTTP handlers for intent recognition API endpoints
 */

import type { Request, Response } from 'express';
import { recognizeIntent } from './service.js';
import type { IntentRecognitionRequest, IntentRecognitionResponse } from './types.js';

/**
 * POST /api/intent/recognize
 * Recognize intent from natural language input
 */
export async function recognize(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    const request = req.body as IntentRecognitionRequest;

    // Validate request
    if (!request.input || typeof request.input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid "input" field',
      } as IntentRecognitionResponse);
      return;
    }

    // Trim input
    request.input = request.input.trim();

    if (request.input.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Input cannot be empty',
      } as IntentRecognitionResponse);
      return;
    }

    // Validate input length (防止 DoS)
    const MAX_INPUT_LENGTH = 1000;
    if (request.input.length > MAX_INPUT_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Input too long (max ${MAX_INPUT_LENGTH} characters)`,
      } as IntentRecognitionResponse);
      return;
    }

    // Perform intent recognition
    const result = recognizeIntent(request);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Return success response
    res.status(200).json({
      success: true,
      data: result,
      meta: {
        responseTime,
      },
    } as IntentRecognitionResponse & { meta: { responseTime: number } });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log error (in production, use proper logger)
    console.error('[Intent Recognition Error]', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      meta: {
        responseTime,
      },
    } as IntentRecognitionResponse & { meta: { responseTime: number } });
  }
}
