// Metrics query routes
import { Router, Request, Response, NextFunction } from 'express';
import { metricService } from '../metrics';
import { accountsService } from '../accounts';
import { AppError } from '../../shared/middleware/error.middleware';
import { Platform } from '../../shared/types';

const router = Router();

// GET /v1/metrics/dashboard - Get dashboard metrics
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeRange = (req.query.timeRange as 'today' | 'week' | 'month') || 'week';
    const dashboard = await metricService.getDashboardMetrics(timeRange);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// GET /v1/metrics/latest/:accountId - Get latest metrics for account
router.get('/latest/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (isNaN(accountId)) {
      throw new AppError('Invalid account ID', 400);
    }

    const metric = await metricService.getLatestMetric(accountId);

    if (!metric) {
      res.status(404).json({ error: 'No metrics found for account' });
      return;
    }

    res.json(metric);
  } catch (error) {
    next(error);
  }
});

// GET /v1/metrics/account/:accountId - Get metrics for account by date range
router.get('/account/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (isNaN(accountId)) {
      throw new AppError('Invalid account ID', 400);
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      throw new AppError('Missing required query parameters: startDate, endDate', 400);
    }

    const metrics = await metricService.getMetricsByAccount(
      accountId,
      startDate as string,
      endDate as string
    );

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// GET /v1/metrics/date/:date - Get all metrics for a specific date
router.get('/date/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;

    const metrics = await metricService.getMetricsByDate(date);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// GET /v1/metrics/platform/:platform - Get metrics by platform and date range
router.get('/platform/:platform', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('Missing required query parameters: startDate, endDate', 400);
    }

    const metrics = await metricService.getMetricsByPlatform(
      platform as Platform,
      startDate as string,
      endDate as string
    );

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// GET /v1/metrics/range - Get metrics by date range
router.get('/range', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('Missing required query parameters: startDate, endDate', 400);
    }

    const metrics = await metricService.getMetricsByDateRange(
      startDate as string,
      endDate as string
    );

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// POST /v1/report_daily - Generate daily report
router.post('/report_daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.body;

    if (!date) {
      throw new AppError('Missing required field: date', 400);
    }

    const report = await metricService.generateDailyReport(date);

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// GET /v1/reports/date/:date - Get report by date
router.get('/reports/date/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;

    const report = await metricService.getReportByDate(date);

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// GET /v1/reports/recent - Get recent reports
router.get('/reports/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 30;

    const reports = await metricService.getRecentReports(limit);

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

export default router;
