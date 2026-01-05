// Claude Monitor routes
import { Router, Request, Response, NextFunction } from 'express';
import { claudeMonitorService } from './claude-monitor.service';
import { CreateRunDTO, UpdateRunDTO, CreateEventDTO } from './claude-monitor.types';

const router = Router();

// ===== Run Routes =====

// GET /v1/claude-monitor/runs - Get all runs (main sessions only)
router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await claudeMonitorService.getAllRuns({ status, limit, offset });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/claude-monitor/runs - Create a new run
router.post('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: CreateRunDTO = req.body;
    const run = await claudeMonitorService.createRun(data);
    res.status(201).json(run);
  } catch (error) {
    next(error);
  }
});

// GET /v1/claude-monitor/runs/:id - Get a specific run with full tree
router.get('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const run = await claudeMonitorService.getRunWithChildren(id);
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/claude-monitor/runs/:id - Update a run (supports both id and session_id)
router.patch('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: UpdateRunDTO = req.body;
    const run = await claudeMonitorService.updateRun(id, data);
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/claude-monitor/runs/:id - Delete a run (and its events)
router.delete('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await claudeMonitorService.deleteRun(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /v1/claude-monitor/runs/:id/kill - Kill/Cancel a run
router.post('/runs/:id/kill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await claudeMonitorService.killRun(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /v1/claude-monitor/runs/:id/stats - Get run statistics
router.get('/runs/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const stats = await claudeMonitorService.getRunStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ===== Event Routes =====

// GET /v1/claude-monitor/runs/:id/events - Get events for a run
router.get('/runs/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await claudeMonitorService.getEventsByRunId(id, { limit, offset });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /v1/claude-monitor/runs/:id/events - Create an event for a run
router.post('/runs/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: CreateEventDTO = req.body;
    const event = await claudeMonitorService.createEvent(id, data);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// GET /v1/claude-monitor/runs/:id/events/since/:timestamp - Get recent events since a timestamp
router.get('/runs/:id/events/since/:timestamp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, timestamp } = req.params;
    const since = parseInt(timestamp);

    if (isNaN(since)) {
      res.status(400).json({ error: 'Invalid timestamp' });
      return;
    }

    const result = await claudeMonitorService.getRecentEvents(id, since);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
