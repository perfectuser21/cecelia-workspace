"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Metrics query routes
const express_1 = require("express");
const metrics_1 = require("../metrics");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// GET /v1/metrics/dashboard - Get dashboard metrics
router.get('/dashboard', async (req, res, next) => {
    try {
        const timeRange = req.query.timeRange || 'week';
        const dashboard = await metrics_1.metricService.getDashboardMetrics(timeRange);
        res.json(dashboard);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/metrics/latest/:accountId - Get latest metrics for account
router.get('/latest/:accountId', async (req, res, next) => {
    try {
        const accountId = parseInt(req.params.accountId, 10);
        if (isNaN(accountId)) {
            throw new error_middleware_1.AppError('Invalid account ID', 400);
        }
        const metric = await metrics_1.metricService.getLatestMetric(accountId);
        if (!metric) {
            res.status(404).json({ error: 'No metrics found for account' });
            return;
        }
        res.json(metric);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/metrics/account/:accountId - Get metrics for account by date range
router.get('/account/:accountId', async (req, res, next) => {
    try {
        const accountId = parseInt(req.params.accountId, 10);
        if (isNaN(accountId)) {
            throw new error_middleware_1.AppError('Invalid account ID', 400);
        }
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            throw new error_middleware_1.AppError('Missing required query parameters: startDate, endDate', 400);
        }
        const metrics = await metrics_1.metricService.getMetricsByAccount(accountId, startDate, endDate);
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/metrics/date/:date - Get all metrics for a specific date
router.get('/date/:date', async (req, res, next) => {
    try {
        const { date } = req.params;
        const metrics = await metrics_1.metricService.getMetricsByDate(date);
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/metrics/platform/:platform - Get metrics by platform and date range
router.get('/platform/:platform', async (req, res, next) => {
    try {
        const { platform } = req.params;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            throw new error_middleware_1.AppError('Missing required query parameters: startDate, endDate', 400);
        }
        const metrics = await metrics_1.metricService.getMetricsByPlatform(platform, startDate, endDate);
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/metrics/range - Get metrics by date range
router.get('/range', async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            throw new error_middleware_1.AppError('Missing required query parameters: startDate, endDate', 400);
        }
        const metrics = await metrics_1.metricService.getMetricsByDateRange(startDate, endDate);
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/report_daily - Generate daily report
router.post('/report_daily', async (req, res, next) => {
    try {
        const { date } = req.body;
        if (!date) {
            throw new error_middleware_1.AppError('Missing required field: date', 400);
        }
        const report = await metrics_1.metricService.generateDailyReport(date);
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/reports/date/:date - Get report by date
router.get('/reports/date/:date', async (req, res, next) => {
    try {
        const { date } = req.params;
        const report = await metrics_1.metricService.getReportByDate(date);
        if (!report) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/reports/recent - Get recent reports
router.get('/reports/recent', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 30;
        const reports = await metrics_1.metricService.getRecentReports(limit);
        res.json(reports);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=metrics.route.js.map