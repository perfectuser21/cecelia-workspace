// N8n Live Status routes
import { Router, Request, Response, NextFunction } from 'express';
import { n8nLiveStatusService } from './n8n-live-status.service';
import { N8nInstance } from './n8n-live-status.types';

const router = Router();

/**
 * GET /v1/n8n-live-status/instances/status
 * Get availability status of all instances
 */
router.get('/instances/status', async (_req: Request, res: Response) => {
  res.json({
    cloud: {
      available: n8nLiveStatusService.isInstanceAvailable('cloud'),
      name: 'Cloud',
    },
    local: {
      available: n8nLiveStatusService.isInstanceAvailable('local'),
      name: 'Local',
    },
  });
});

/**
 * GET /v1/n8n-live-status/instances/:instance/overview
 * Get live status overview for an instance
 */
router.get('/instances/:instance/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as N8nInstance;
    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nLiveStatusService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured`, available: false });
    }
    const overview = await n8nLiveStatusService.getLiveStatusOverview(instance);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-live-status/instances/:instance/executions/:executionId
 * Get execution detail by ID
 */
router.get('/instances/:instance/executions/:executionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as N8nInstance;
    const { executionId } = req.params;

    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nLiveStatusService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured` });
    }

    const detail = await n8nLiveStatusService.getExecutionDetail(instance, executionId);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

export default router;
