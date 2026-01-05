// Workflow Tracker routes
import { Router, Request, Response, NextFunction } from 'express';
import { workflowTrackerService } from './workflow-tracker.service';
import { CreateRunDTO, UpdateRunDTO, EmitEventDTO } from './workflow-tracker.types';

const router = Router();

// ===== Run Routes =====

// GET /v1/workflow-tracker/runs - Get all runs
router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const bundle = req.query.bundle as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await workflowTrackerService.getAllRuns({ status, bundle, limit, offset });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/workflow-tracker/runs - Create a new run
router.post('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: CreateRunDTO = req.body;
    const run = await workflowTrackerService.createRun(data);
    res.status(201).json(run);
  } catch (error) {
    next(error);
  }
});

// GET /v1/workflow-tracker/runs/:run_id - Get run with progress
router.get('/runs/:run_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    const run = await workflowTrackerService.getRunWithProgress(run_id);
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/workflow-tracker/runs/:run_id - Update a run
router.patch('/runs/:run_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    const data: UpdateRunDTO = req.body;
    const run = await workflowTrackerService.updateRun(run_id, data);
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/workflow-tracker/runs/:run_id - Delete a run
router.delete('/runs/:run_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    await workflowTrackerService.deleteRun(run_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===== Event Routes =====

// POST /v1/workflow-tracker/runs/:run_id/events - Emit event (from executor)
router.post('/runs/:run_id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    const data: EmitEventDTO = req.body;
    const event = await workflowTrackerService.emitEvent(run_id, data);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// GET /v1/workflow-tracker/runs/:run_id/events - Get events for a run
router.get('/runs/:run_id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await workflowTrackerService.getEventsByRunId(run_id, { limit, offset });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /v1/workflow-tracker/runs/:run_id/stream - Get formatted event stream (V2)
router.get('/runs/:run_id/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { run_id } = req.params;
    const result = await workflowTrackerService.getEventStream(run_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ===== Stuck Detection =====

// POST /v1/workflow-tracker/detect-stuck - Manual trigger stuck detection
router.post('/detect-stuck', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const thresholdMs = parseInt(req.query.threshold as string) || 300000;
    const count = await workflowTrackerService.detectAndMarkStuck(thresholdMs);
    res.json({ success: true, marked_stuck: count });
  } catch (error) {
    next(error);
  }
});

export default router;
