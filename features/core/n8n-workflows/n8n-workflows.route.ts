// N8n Workflows routes
import { Router, Request, Response, NextFunction } from 'express';
import { n8nWorkflowsService } from './n8n-workflows.service';

const router = Router();

/**
 * GET /v1/n8n-workflows/overview
 * Get overview with workflows and recent executions
 */
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await n8nWorkflowsService.getOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/workflows
 * Get all workflows
 */
router.get('/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflows = await n8nWorkflowsService.getWorkflows();
    res.json(workflows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/workflows/:id
 * Get single workflow details
 */
router.get('/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflow = await n8nWorkflowsService.getWorkflow(req.params.id);
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/executions
 * Get executions with optional filters
 * Query params: status, limit, workflowId
 */
router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit, workflowId } = req.query;

    const executions = await n8nWorkflowsService.getExecutions({
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      workflowId: workflowId as string,
    });

    res.json(executions);
  } catch (error) {
    next(error);
  }
});

// ==================== 多实例支持路由 ====================

/**
 * GET /v1/n8n-workflows/instances/status
 * Get availability status of all instances
 */
router.get('/instances/status', async (_req: Request, res: Response) => {
  res.json({
    cloud: {
      available: n8nWorkflowsService.isInstanceAvailable('cloud'),
      name: 'Cloud',
    },
    local: {
      available: n8nWorkflowsService.isInstanceAvailable('local'),
      name: 'Local',
    },
  });
});

/**
 * GET /v1/n8n-workflows/instances/:instance/overview
 */
router.get('/instances/:instance/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as 'cloud' | 'local';
    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nWorkflowsService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured`, available: false });
    }
    const overview = await n8nWorkflowsService.getOverviewByInstance(instance);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/instances/:instance/workflows
 */
router.get('/instances/:instance/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as 'cloud' | 'local';
    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nWorkflowsService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured` });
    }
    const workflows = await n8nWorkflowsService.getWorkflowsByInstance(instance);
    res.json(workflows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/instances/:instance/workflows/:id
 */
router.get('/instances/:instance/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as 'cloud' | 'local';
    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nWorkflowsService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured` });
    }
    const workflow = await n8nWorkflowsService.getWorkflowDetail(instance, req.params.id);
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/n8n-workflows/instances/:instance/workflows/:id/executions
 */
router.get('/instances/:instance/workflows/:id/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = req.params.instance as 'cloud' | 'local';
    if (!['cloud', 'local'].includes(instance)) {
      return res.status(400).json({ error: 'Invalid instance' });
    }
    if (!n8nWorkflowsService.isInstanceAvailable(instance)) {
      return res.status(503).json({ error: `N8n ${instance} not configured` });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const executions = await n8nWorkflowsService.getWorkflowExecutions(instance, req.params.id, limit);
    res.json(executions);
  } catch (error) {
    next(error);
  }
});

export default router;
