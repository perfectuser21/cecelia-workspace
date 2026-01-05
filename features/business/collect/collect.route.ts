// Data collection routes
import { Router, Request, Response, NextFunction } from 'express';
import { collectService } from './collect.service';
import { metricService } from '../metrics';
import { AppError } from '../../../shared/middleware/error.middleware';
import { Platform } from '../../../shared/types';

const router = Router();

// POST /v1/healthcheck - Health check for account login
router.post('/healthcheck', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accountId } = req.body;

    if (!platform || !accountId) {
      throw new AppError('Missing required fields: platform, accountId', 400);
    }

    const result = await collectService.healthCheck({
      platform: platform as Platform,
      accountId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/collect_daily - Collect daily metrics for an account
router.post('/collect_daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accountId, date } = req.body;

    if (!platform || !accountId || !date) {
      throw new AppError('Missing required fields: platform, accountId, date', 400);
    }

    const result = await collectService.collectDaily({
      platform: platform as Platform,
      accountId,
      date,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/store_metrics - Store collected metrics
router.post('/store_metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;

    if (!data.platform || !data.accountId || !data.date) {
      throw new AppError('Missing required fields in metrics data', 400);
    }

    const result = await metricService.storeMetrics(data);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/collect_all - Trigger collection for all active accounts
router.post('/collect_all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.body;

    if (!date) {
      throw new AppError('Missing required field: date', 400);
    }

    const results = await collectService.collectAllAccounts(date);

    res.json({
      ok: true,
      total: results.length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
