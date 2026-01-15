"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Login flow routes
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// POST /:id/start-login - Start login flow
router.post('/:id/start-login', async (req, res, next) => {
    try {
        const { platform, accountId } = req.body;
        if (!platform || !accountId) {
            throw new error_middleware_1.AppError('Missing required fields: platform, accountId', 400);
        }
        const result = await auth_service_1.authService.startLogin(platform, accountId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// GET /:id/login-status - Check login status
router.get('/:id/login-status', async (req, res, next) => {
    try {
        const { sessionId } = req.query;
        if (!sessionId || typeof sessionId !== 'string') {
            throw new error_middleware_1.AppError('Missing required query parameter: sessionId', 400);
        }
        const status = await auth_service_1.authService.getLoginStatus(sessionId);
        res.json(status);
    }
    catch (error) {
        next(error);
    }
});
// POST /:id/save-session - Save session state
router.post('/:id/save-session', async (req, res, next) => {
    try {
        const { sessionId, storageState } = req.body;
        if (!sessionId || !storageState) {
            throw new error_middleware_1.AppError('Missing required fields: sessionId, storageState', 400);
        }
        await auth_service_1.authService.saveSession(sessionId, storageState);
        res.json({ ok: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.route.js.map