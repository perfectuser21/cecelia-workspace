"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.service = void 0;
exports.loadAllConfigs = loadAllConfigs;
exports.getConfigByDomain = getConfigByDomain;
exports.getConfigByInstance = getConfigByInstance;
exports.getAllConfigs = getAllConfigs;
exports.reloadConfigs = reloadConfigs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
// Path to instances directory
const INSTANCES_PATH = process.env.INSTANCES_PATH || '/home/xx/dev/zenithjoy-autopilot/instances';
// Default instance name (fallback when no domain matches)
const DEFAULT_INSTANCE = 'zenithjoy';
// Cache: domain -> instance config
const domainCache = new Map();
// All loaded configs
const instanceConfigs = new Map();
// Load flag
let isLoaded = false;
/**
 * Load all instance configs from YAML files
 */
function loadAllConfigs() {
    if (isLoaded) {
        return;
    }
    try {
        if (!fs.existsSync(INSTANCES_PATH)) {
            logger_1.default.warn(`Instances directory not found: ${INSTANCES_PATH}`);
            return;
        }
        const instanceDirs = fs.readdirSync(INSTANCES_PATH, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('_'))
            .map(dirent => dirent.name);
        for (const instanceName of instanceDirs) {
            const configPath = path.join(INSTANCES_PATH, instanceName, 'config.yml');
            if (!fs.existsSync(configPath)) {
                logger_1.default.debug(`No config.yml found for instance: ${instanceName}`);
                continue;
            }
            try {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const config = yaml.load(configContent);
                if (!config.instance || !config.name) {
                    logger_1.default.warn(`Invalid config for instance ${instanceName}: missing required fields`);
                    continue;
                }
                // Store in instance configs map
                instanceConfigs.set(config.instance, config);
                // Build domain cache
                if (config.domains && Array.isArray(config.domains)) {
                    for (const domain of config.domains) {
                        domainCache.set(domain.toLowerCase(), config);
                    }
                }
                logger_1.default.info(`Loaded instance config: ${config.instance} (${config.name})`, {
                    domains: config.domains,
                    features: Object.keys(config.features || {}).length,
                });
            }
            catch (parseError) {
                logger_1.default.error(`Failed to parse config for instance ${instanceName}:`, parseError.message);
            }
        }
        isLoaded = true;
        logger_1.default.info(`Instance configs loaded: ${instanceConfigs.size} instances, ${domainCache.size} domains`);
    }
    catch (error) {
        logger_1.default.error('Failed to load instance configs:', error.message);
    }
}
/**
 * Get config for a specific domain (from Host header)
 * Strips port from domain if present
 */
function getConfigByDomain(host) {
    // Ensure configs are loaded
    loadAllConfigs();
    // Normalize: lowercase and handle port
    const normalizedHost = host.toLowerCase();
    // Try exact match first (with port)
    let config = domainCache.get(normalizedHost);
    let matchedDomain = normalizedHost;
    // If not found, try without port
    if (!config && normalizedHost.includes(':')) {
        const hostWithoutPort = normalizedHost.split(':')[0];
        config = domainCache.get(hostWithoutPort);
        matchedDomain = hostWithoutPort;
    }
    // Fallback to default instance
    if (!config) {
        config = instanceConfigs.get(DEFAULT_INSTANCE);
        matchedDomain = undefined;
        logger_1.default.debug(`No config found for domain ${host}, using default: ${DEFAULT_INSTANCE}`);
    }
    if (!config) {
        // Return minimal default config if nothing found
        logger_1.default.warn(`No config found, returning empty default`);
        return {
            config: {
                instance: 'unknown',
                name: 'Unknown',
                theme: {
                    logo: '/assets/logos/default.png',
                    favicon: '/assets/favicons/default.ico',
                    primaryColor: '#1890ff',
                    secondaryColor: '#722ed1',
                },
                features: {},
            },
            matchedDomain: undefined,
        };
    }
    // Transform RawInstanceConfig to InstanceConfig (remove domains)
    const instanceConfig = {
        instance: config.instance,
        name: config.name,
        theme: config.theme,
        features: config.features || {},
    };
    return { config: instanceConfig, matchedDomain };
}
/**
 * Get config by instance name directly
 */
function getConfigByInstance(instanceName) {
    loadAllConfigs();
    const config = instanceConfigs.get(instanceName);
    if (!config) {
        return undefined;
    }
    return {
        instance: config.instance,
        name: config.name,
        theme: config.theme,
        features: config.features || {},
    };
}
/**
 * Get all loaded instance configs (for admin/debug)
 */
function getAllConfigs() {
    loadAllConfigs();
    return Array.from(instanceConfigs.values()).map(config => ({
        instance: config.instance,
        name: config.name,
        theme: config.theme,
        features: config.features || {},
    }));
}
/**
 * Reload configs (useful for development)
 */
function reloadConfigs() {
    domainCache.clear();
    instanceConfigs.clear();
    isLoaded = false;
    loadAllConfigs();
}
// Export service object
exports.service = {
    loadAllConfigs,
    getConfigByDomain,
    getConfigByInstance,
    getAllConfigs,
    reloadConfigs,
};
//# sourceMappingURL=instance-config.service.js.map