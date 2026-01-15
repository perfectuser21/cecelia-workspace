"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const instance_config_service_1 = require("./instance-config.service");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const router = (0, express_1.Router)();
// GET /v1/instance-config - Get config for current domain
router.get('/', (req, res) => {
    try {
        // Get Host header (includes port if present)
        const host = req.get('host') || req.get('Host') || '';
        if (!host) {
            logger_1.default.warn('No Host header in request');
        }
        const { config, matchedDomain } = instance_config_service_1.service.getConfigByDomain(host);
        res.json({
            success: true,
            config,
            matched_domain: matchedDomain,
        });
    }
    catch (error) {
        logger_1.default.error('Error getting instance config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get instance config',
        });
    }
});
// GET /v1/instance-config/all - Get all configs (admin/debug)
router.get('/all', (_req, res) => {
    try {
        const configs = instance_config_service_1.service.getAllConfigs();
        res.json({
            success: true,
            configs,
            count: configs.length,
        });
    }
    catch (error) {
        logger_1.default.error('Error getting all instance configs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get instance configs',
        });
    }
});
// GET /v1/instance-config/:instance - Get config by instance name
router.get('/:instance', (req, res) => {
    try {
        const { instance } = req.params;
        const config = instance_config_service_1.service.getConfigByInstance(instance);
        if (!config) {
            res.status(404).json({
                success: false,
                error: `Instance not found: ${instance}`,
            });
            return;
        }
        res.json({
            success: true,
            config,
        });
    }
    catch (error) {
        logger_1.default.error('Error getting instance config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get instance config',
        });
    }
});
// POST /v1/instance-config/reload - Reload configs (development)
router.post('/reload', (_req, res) => {
    try {
        instance_config_service_1.service.reloadConfigs();
        const configs = instance_config_service_1.service.getAllConfigs();
        res.json({
            success: true,
            message: 'Configs reloaded',
            count: configs.length,
        });
    }
    catch (error) {
        logger_1.default.error('Error reloading instance configs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reload configs',
        });
    }
});
exports.default = router;
//# sourceMappingURL=instance-config.route.js.map