import { Router, Request, Response } from 'express';
import * as workersService from './service.js';

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const departments = await workersService.getAllWorkers();
    return res.json({
      success: true,
      departments,
      total_departments: departments.length,
      total_workers: departments.reduce((sum, d) => sum + d.workers.length, 0),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

router.get('/match/:workflowName', async (req: Request, res: Response) => {
  try {
    const { workflowName } = req.params;
    const worker = await workersService.findWorkerByWorkflow(workflowName);

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'No worker found for workflow: ' + workflowName,
      });
    }

    return res.json({
      success: true,
      workflow_name: workflowName,
      worker,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

router.get('/:id/workflows', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflows = await workersService.getWorkerWorkflows(id);

    if (workflows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Worker ' + id + ' not found or has no workflows',
      });
    }

    return res.json({
      success: true,
      worker_id: id,
      workflows,
      total: workflows.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const worker = await workersService.getWorkerById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker ' + id + ' not found',
      });
    }

    return res.json({
      success: true,
      worker,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export default router;
