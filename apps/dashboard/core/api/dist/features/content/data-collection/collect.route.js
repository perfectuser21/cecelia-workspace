"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Data collection routes
const express_1 = require("express");
const collect_service_1 = require("./collect.service");
const metrics_1 = require("../../infra/metrics");
const error_middleware_1 = require("../../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// POST /v1/healthcheck - Health check for account login
router.post('/healthcheck', async (req, res, next) => {
    try {
        const { platform, accountId } = req.body;
        if (!platform || !accountId) {
            throw new error_middleware_1.AppError('Missing required fields: platform, accountId', 400);
        }
        const result = await collect_service_1.collectService.healthCheck({
            platform: platform,
            accountId,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/collect_daily - Collect daily metrics for an account
router.post('/collect_daily', async (req, res, next) => {
    try {
        const { platform, accountId, date } = req.body;
        if (!platform || !accountId || !date) {
            throw new error_middleware_1.AppError('Missing required fields: platform, accountId, date', 400);
        }
        const result = await collect_service_1.collectService.collectDaily({
            platform: platform,
            accountId,
            date,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/store_metrics - Store collected metrics
router.post('/store_metrics', async (req, res, next) => {
    try {
        const data = req.body;
        if (!data.platform || !data.accountId || !data.date) {
            throw new error_middleware_1.AppError('Missing required fields in metrics data', 400);
        }
        const result = await metrics_1.metricService.storeMetrics(data);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/collect_all - Trigger collection for all active accounts
router.post('/collect_all', async (req, res, next) => {
    try {
        const { date } = req.body;
        if (!date) {
            throw new error_middleware_1.AppError('Missing required field: date', 400);
        }
        const results = await collect_service_1.collectService.collectAllAccounts(date);
        res.json({
            ok: true,
            total: results.length,
            results,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=collect.route.js.map