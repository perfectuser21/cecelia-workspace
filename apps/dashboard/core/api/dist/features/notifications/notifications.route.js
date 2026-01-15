"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Notification routes
const express_1 = require("express");
const notifications_service_1 = require("./notifications.service");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// POST /login_required - Notify that login is required
router.post('/login_required', async (req, res, next) => {
    try {
        const { platform, accountId, reason, loginUrl } = req.body;
        if (!platform || !accountId || !reason || !loginUrl) {
            throw new error_middleware_1.AppError('Missing required fields: platform, accountId, reason, loginUrl', 400);
        }
        const result = await notifications_service_1.notificationsService.notifyLoginRequired({
            platform,
            accountId,
            reason,
            loginUrl,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /team_daily - Send daily team notification
router.post('/team_daily', async (req, res, next) => {
    try {
        const { date, summaryText, notionUrl } = req.body;
        if (!date || !summaryText) {
            throw new error_middleware_1.AppError('Missing required fields: date, summaryText', 400);
        }
        const result = await notifications_service_1.notificationsService.notifyTeamDaily({
            date,
            summaryText,
            notionUrl,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /ops_alert - Send operations alert
router.post('/ops_alert', async (req, res, next) => {
    try {
        const { where, workflow, node, platform, accountId, error, meta } = req.body;
        if (!where || !workflow || !node || !platform || !accountId || !error) {
            throw new error_middleware_1.AppError('Missing required fields: where, workflow, node, platform, accountId, error', 400);
        }
        const result = await notifications_service_1.notificationsService.notifyOpsAlert({
            where,
            workflow,
            node,
            platform,
            accountId,
            error,
            meta,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=notifications.route.js.map