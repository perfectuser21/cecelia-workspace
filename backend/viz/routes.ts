/**
 * Visualization Data API Routes
 */

import { Router, Request, Response } from 'express';
import { ingestData, queryData, getStorageStats, cleanupOldData } from './service.js';
import type { IngestRequest, QueryOptions } from './types.js';

const router = Router();

/**
 * POST /api/viz/ingest
 * Ingest a new data point
 */
router.post('/ingest', (req: Request, res: Response) => {
  try {
    const data: IngestRequest = req.body;

    // Validate required fields
    if (!data.source || !data.type || !data.timestamp || !data.payload) {
      return res.status(400).json({
        error: 'Missing required fields: source, type, timestamp, payload',
      });
    }

    // Validate types
    if (typeof data.source !== 'string' || typeof data.type !== 'string') {
      return res.status(400).json({
        error: 'source and type must be strings',
      });
    }

    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      return res.status(400).json({
        error: 'timestamp must be a positive number (Unix ms)',
      });
    }

    if (typeof data.payload !== 'object' || data.payload === null) {
      return res.status(400).json({
        error: 'payload must be an object',
      });
    }

    // Ingest data
    const dataPoint = ingestData(data);

    res.status(200).json(dataPoint);
  } catch (err: any) {
    console.error('Ingest error:', err);
    res.status(500).json({
      error: 'Failed to ingest data',
      message: err.message,
    });
  }
});

/**
 * GET /api/viz/data
 * Query data with optional filters
 */
router.get('/data', (req: Request, res: Response) => {
  try {
    const options: QueryOptions = {
      source: req.query.source as string | undefined,
      type: req.query.type as string | undefined,
      range: req.query.range as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    // Validate limit
    if (options.limit && (isNaN(options.limit) || options.limit < 1)) {
      return res.status(400).json({
        error: 'limit must be a positive integer',
      });
    }

    const results = queryData(options);

    res.status(200).json({
      count: results.length,
      data: results,
    });
  } catch (err: any) {
    console.error('Query error:', err);
    res.status(500).json({
      error: 'Failed to query data',
      message: err.message,
    });
  }
});

/**
 * GET /api/viz/stats
 * Get storage statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = getStorageStats();
    res.status(200).json(stats);
  } catch (err: any) {
    console.error('Stats error:', err);
    res.status(500).json({
      error: 'Failed to get storage stats',
      message: err.message,
    });
  }
});

/**
 * POST /api/viz/cleanup
 * Clean up old data (older than 7 days)
 */
router.post('/cleanup', (req: Request, res: Response) => {
  try {
    const result = cleanupOldData();
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Cleanup error:', err);
    res.status(500).json({
      error: 'Failed to cleanup old data',
      message: err.message,
    });
  }
});

/**
 * GET /api/viz/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'viz-data-api',
    timestamp: new Date().toISOString(),
  });
});

export default router;
