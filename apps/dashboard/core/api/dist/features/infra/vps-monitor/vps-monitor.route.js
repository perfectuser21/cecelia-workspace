"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VPS Monitor routes
const express_1 = require("express");
const vps_monitor_service_1 = require("./vps-monitor.service");
const router = (0, express_1.Router)();
/**
 * GET /v1/vps-monitor/stats
 * Get system statistics (CPU, memory, disk, network)
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await vps_monitor_service_1.vpsMonitorService.getSystemStats();
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/vps-monitor/containers
 * Get Docker containers list and resource usage
 */
router.get('/containers', async (req, res, next) => {
    try {
        const containers = await vps_monitor_service_1.vpsMonitorService.getDockerStats();
        res.json(containers);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/vps-monitor/services
 * Get status of key services
 */
router.get('/services', async (req, res, next) => {
    try {
        const services = await vps_monitor_service_1.vpsMonitorService.getServicesStatus();
        res.json(services);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /v1/vps-monitor/history?hours=24
 * Get metrics history for the last N hours
 */
router.get('/history', async (req, res, next) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        // Validate hours parameter
        if (hours < 1 || hours > 168) { // Max 7 days
            return res.status(400).json({
                error: 'Invalid hours parameter. Must be between 1 and 168 (7 days).',
            });
        }
        const metrics = await vps_monitor_service_1.vpsMonitorService.getMetricsHistory(hours);
        res.json({ metrics });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=vps-monitor.route.js.map