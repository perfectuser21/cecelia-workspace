"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Workflow Tracker routes
const express_1 = require("express");
const workflow_tracker_service_1 = require("./workflow-tracker.service");
const router = (0, express_1.Router)();
// ===== Run Routes =====
// GET /v1/workflow-tracker/runs - Get all runs
router.get('/runs', async (req, res, next) => {
    try {
        const status = req.query.status;
        const bundle = req.query.bundle;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const result = await workflow_tracker_service_1.workflowTrackerService.getAllRuns({ status, bundle, limit, offset });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/workflow-tracker/runs - Create a new run
router.post('/runs', async (req, res, next) => {
    try {
        const data = req.body;
        const run = await workflow_tracker_service_1.workflowTrackerService.createRun(data);
        res.status(201).json(run);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/workflow-tracker/runs/:run_id - Get run with progress
router.get('/runs/:run_id', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        const run = await workflow_tracker_service_1.workflowTrackerService.getRunWithProgress(run_id);
        res.json(run);
    }
    catch (error) {
        next(error);
    }
});
// PATCH /v1/workflow-tracker/runs/:run_id - Update a run
router.patch('/runs/:run_id', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        const data = req.body;
        const run = await workflow_tracker_service_1.workflowTrackerService.updateRun(run_id, data);
        res.json(run);
    }
    catch (error) {
        next(error);
    }
});
// DELETE /v1/workflow-tracker/runs/:run_id - Delete a run
router.delete('/runs/:run_id', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        await workflow_tracker_service_1.workflowTrackerService.deleteRun(run_id);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// ===== Event Routes =====
// POST /v1/workflow-tracker/runs/:run_id/events - Emit event (from executor)
router.post('/runs/:run_id/events', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        const data = req.body;
        const event = await workflow_tracker_service_1.workflowTrackerService.emitEvent(run_id, data);
        res.status(201).json(event);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/workflow-tracker/runs/:run_id/events - Get events for a run
router.get('/runs/:run_id/events', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const result = await workflow_tracker_service_1.workflowTrackerService.getEventsByRunId(run_id, { limit, offset });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/workflow-tracker/runs/:run_id/stream - Get formatted event stream (V2)
router.get('/runs/:run_id/stream', async (req, res, next) => {
    try {
        const { run_id } = req.params;
        const result = await workflow_tracker_service_1.workflowTrackerService.getEventStream(run_id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ===== Stuck Detection =====
// POST /v1/workflow-tracker/detect-stuck - Manual trigger stuck detection
router.post('/detect-stuck', async (req, res, next) => {
    try {
        const thresholdMs = parseInt(req.query.threshold) || 300000;
        const count = await workflow_tracker_service_1.workflowTrackerService.detectAndMarkStuck(thresholdMs);
        res.json({ success: true, marked_stuck: count });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=workflow-tracker.route.js.map