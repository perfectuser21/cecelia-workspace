"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Logging routes
const express_1 = require("express");
const logs_repository_1 = require("./logs.repository");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// POST / - Create log entry
router.post('/', async (req, res, next) => {
    try {
        const { level, platform, accountId, message, meta } = req.body;
        if (!level || !message) {
            throw new error_middleware_1.AppError('Missing required fields: level, message', 400);
        }
        const log = await logs_repository_1.logsRepository.create({
            action: level,
            resource_type: platform,
            details: {
                platform,
                accountId,
                message,
                ...meta,
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
        });
        res.json({
            ok: true,
            logId: `log_${log.id}`,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /recent - Get recent logs
router.get('/recent', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const logs = await logs_repository_1.logsRepository.findRecent(limit);
        res.json(logs);
    }
    catch (error) {
        next(error);
    }
});
// GET /action/:action - Get logs by action
router.get('/action/:action', async (req, res, next) => {
    try {
        const { action } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;
        const logs = await logs_repository_1.logsRepository.findByAction(action, limit);
        res.json(logs);
    }
    catch (error) {
        next(error);
    }
});
// GET /resource/:type/:id - Get logs by resource
router.get('/resource/:type/:id', async (req, res, next) => {
    try {
        const { type, id } = req.params;
        const resourceId = parseInt(id, 10);
        if (isNaN(resourceId)) {
            throw new error_middleware_1.AppError('Invalid resource ID', 400);
        }
        const limit = parseInt(req.query.limit, 10) || 100;
        const logs = await logs_repository_1.logsRepository.findByResource(type, resourceId, limit);
        res.json(logs);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=logs.route.js.map