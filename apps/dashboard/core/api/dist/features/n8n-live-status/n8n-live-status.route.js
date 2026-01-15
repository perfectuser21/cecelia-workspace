"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// N8n Live Status routes
const express_1 = require("express");
const n8n_live_status_service_1 = require("./n8n-live-status.service");
const router = (0, express_1.Router)();
/**
 * GET /v1/n8n-live-status/instances/status
 * Get availability status of all instances
 */
router.get('/instances/status', async (_req, res) => {
    res.json({
        cloud: {
            available: n8n_live_status_service_1.n8nLiveStatusService.isInstanceAvailable('cloud'),
            name: 'Cloud',
        },
        local: {
            available: n8n_live_status_service_1.n8nLiveStatusService.isInstanceAvailable('local'),
            name: 'Local',
        },
    });
});
/**
 * GET /v1/n8n-live-status/instances/:instance/overview
 * Get live status overview for an instance
 */
router.get('/instances/:instance/overview', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_live_status_service_1.n8nLiveStatusService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured`, available: false });
        }
        const overview = await n8n_live_status_service_1.n8nLiveStatusService.getLiveStatusOverview(instance);
        res.json(overview);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/n8n-live-status/instances/:instance/executions/:executionId
 * Get execution detail by ID
 */
router.get('/instances/:instance/executions/:executionId', async (req, res, next) => {
    try {
        const instance = req.params.instance;
        const { executionId } = req.params;
        if (!['cloud', 'local'].includes(instance)) {
            return res.status(400).json({ error: 'Invalid instance' });
        }
        if (!n8n_live_status_service_1.n8nLiveStatusService.isInstanceAvailable(instance)) {
            return res.status(503).json({ error: `N8n ${instance} not configured` });
        }
        const detail = await n8n_live_status_service_1.n8nLiveStatusService.getExecutionDetail(instance, executionId);
        res.json(detail);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=n8n-live-status.route.js.map