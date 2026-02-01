/**
 * Intent Recognition API Routes
 * Base path: /api/intent
 */

import { Router, Request, Response } from 'express';
import { parseIntent } from './intent-parser.js';
import type { ParseRequest, ParseResponse } from './types.js';

const router = Router();

/**
 * POST /api/intent/parse
 * Parse natural language text to identify user intent
 */
router.post('/parse', (req: Request, res: Response) => {
  try {
    const { text } = req.body as ParseRequest;

    // Validate input
    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: text field must be a string',
      } as ParseResponse);
    }

    // Get Brain context from query params or headers (if available)
    const brainFocus = {
      project: (req.query.project as string)?.trim() || undefined,
      goal: (req.query.goal as string)?.trim() || undefined,
    };

    // Parse intent
    const result = parseIntent(text, brainFocus);

    return res.json({
      success: true,
      data: result,
    } as ParseResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
    } as ParseResponse);
  }
});

export default router;
