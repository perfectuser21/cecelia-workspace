"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const claude_stats_service_1 = require("./claude-stats.service");
const router = (0, express_1.Router)();
// GET /v1/claude-stats - Get usage statistics
router.get('/', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const stats = await claude_stats_service_1.service.getStats(Math.min(days, 90)); // Max 90 days
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting Claude stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
exports.default = router;
//# sourceMappingURL=claude-stats.route.js.map