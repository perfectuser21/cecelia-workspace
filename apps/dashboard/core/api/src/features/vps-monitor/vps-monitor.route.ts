// VPS Monitor routes
import { Router, Request, Response, NextFunction } from 'express';
import { vpsMonitorService } from './vps-monitor.service';

const router = Router();

/**
 * GET /v1/vps-monitor/stats
 * Get system statistics (CPU, memory, disk, network)
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await vpsMonitorService.getSystemStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/vps-monitor/containers
 * Get Docker containers list and resource usage
 */
router.get('/containers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containers = await vpsMonitorService.getDockerStats();
    res.json(containers);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/vps-monitor/services
 * Get status of key services
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await vpsMonitorService.getServicesStatus();
    res.json(services);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/vps-monitor/history?hours=24
 * Get metrics history for the last N hours
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;

    // Validate hours parameter
    if (hours < 1 || hours > 168) { // Max 7 days
      return res.status(400).json({
        error: 'Invalid hours parameter. Must be between 1 and 168 (7 days).',
      });
    }

    const metrics = await vpsMonitorService.getMetricsHistory(hours);
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

export default router;
