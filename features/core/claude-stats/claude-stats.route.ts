import { Router, Request, Response } from 'express';
import { service } from './claude-stats.service';

const router = Router();

// GET /v1/claude-stats - Get usage statistics
router.get('/', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await service.getStats(Math.min(days, 90)); // Max 90 days
    res.json(stats);
  } catch (error) {
    console.error('Error getting Claude stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
