"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// N8n Workflows routes
const express_1 = require("express");
const n8n_workflows_service_1 = require("./n8n-workflows.service");
const router = (0, express_1.Router)();
/**
 * GET /v1/n8n-workflows/overview
 * Get overview with workflows and recent executions
 */
router.get('/overview', async (req, res, next) => {
    try {
        const overview = await n8n_workflows_service_1.n8nWorkflowsService.getOverview();
        res.json(overview);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/workflows
 * Get all workflows
 */
router.get('/workflows', async (req, res, next) => {
    try {
        const workflows = await n8n_workflows_service_1.n8nWorkflowsService.getWorkflows();
        res.json(workflows);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/workflows/:id
 * Get single workflow details
 */
router.get('/workflows/:id', async (req, res, next) => {
    try {
        const workflow = await n8n_workflows_service_1.n8nWorkflowsService.getWorkflow(req.params.id);
        res.json(workflow);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/executions
 * Get executions with optional filters
 * Query params: status, limit, workflowId
 */
router.get('/executions', async (req, res, next) => {
    try {
        const { status, limit, workflowId } = req.query;
        const executions = await n8n_workflows_service_1.n8nWorkflowsService.getExecutions({
            status: status,
            limit: limit ? parseInt(limit) : undefined,
            workflowId: workflowId,
        });
        res.json(executions);
    }
    catch (error) {
        next(error);
    }
});
// ==================== 多实例支持路由 ====================
/**
 * GET /v1/n8n-workflows/instances/status
 * Get availability status of all instances
 */
router.get('/instances/status', async (_req, res) => {
    res.json({
        cloud: {
            available: n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable('cloud'),
            name: 'Cloud',
        },
        local: {
            available: n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable('local'),
            name: 'Local',
        },
    });
});
/**
 * GET /v1/n8n-workflows/instances/:instance/overview
 */
router.get('/instances/:instance/overview', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured`, available: false });
        }
        const overview = await n8n_workflows_service_1.n8nWorkflowsService.getOverviewByInstance(instance);
        res.json(overview);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/instances/:instance/workflows
 */
router.get('/instances/:instance/workflows', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured` });
        }
        const workflows = await n8n_workflows_service_1.n8nWorkflowsService.getWorkflowsByInstance(instance);
        res.json(workflows);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/instances/:instance/workflows/:id
 */
router.get('/instances/:instance/workflows/:id', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured` });
        }
        const workflow = await n8n_workflows_service_1.n8nWorkflowsService.getWorkflowDetail(instance, req.params.id);
        res.json(workflow);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-workflows/instances/:instance/workflows/:id/executions
 */
router.get('/instances/:instance/workflows/:id/executions', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_workflows_service_1.n8nWorkflowsService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured` });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const executions = await n8n_workflows_service_1.n8nWorkflowsService.getWorkflowExecutions(instance, req.params.id, limit);
        res.json(executions);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=n8n-workflows.route.js.map