import { Router, Request, Response } from 'express';
import { service } from './claude-stats.service';
import logger from '../../../shared/utils/logger';

// Route module init
logger.info('[claude-stats route] Route module loaded');

const router = Router();

// GET /v1/claude-stats - Get usage statistics
router.get('/', async (req: Request, res: Response) => {
  console.error('[claude-stats route] Request received!');
  logger.info(`[claude-stats route] Request received with days=${req.query.days}`);
  try {
    const days = parseInt(req.query.days as string) || 30;
    console.error(`[claude-stats route] Calling service.getStats(${days})`);
    logger.info(`[claude-stats route] Calling service.getStats(${days})`);
    const stats = await service.getStats(Math.min(days, 90)); // Max 90 days
    console.error('[claude-stats route] Got stats, returning response');
    logger.info('[claude-stats route] Got stats, returning response');
    res.json(stats);
  } catch (error) {
    console.error('Error getting Claude stats:', error);
    logger.error('Error getting Claude stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
