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

export default router;
