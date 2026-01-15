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
exports.loadApiModules = loadApiModules;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./shared/utils/logger"));
const auth_middleware_1 = require("./shared/middleware/auth.middleware");
// Feature categories
const FEATURE_CATEGORIES = ['content', 'infra', 'dashboard', 'integration'];
async function loadApiModules(app) {
    const featuresDir = path_1.default.join(__dirname, 'features');
    // Skip if features directory doesn't exist yet
    if (!(0, fs_1.existsSync)(featuresDir)) {
        logger_1.default.info('No features directory found, skipping API module loading');
        return;
    }
    let loadedCount = 0;
    for (const category of FEATURE_CATEGORIES) {
        const categoryDir = path_1.default.join(featuresDir, category);
        if (!(0, fs_1.existsSync)(categoryDir)) {
            continue;
        }
        const featureDirs = (0, fs_1.readdirSync)(categoryDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        for (const featureName of featureDirs) {
            const indexPath = path_1.default.join(categoryDir, featureName, 'index');
            try {
                // Dynamic import the feature module
                const apiModule = await Promise.resolve(`${indexPath}`).then(s => __importStar(require(s)));
                if (!apiModule.router || !apiModule.basePath) {
                    logger_1.default.warn(`Feature ${category}/${featureName} missing router or basePath, skipping`);
                    continue;
                }
                // Apply auth middleware if required
                if (apiModule.requiresAuth) {
                    app.use(apiModule.basePath, auth_middleware_1.authMiddleware, apiModule.router);
                }
                else {
                    app.use(apiModule.basePath, apiModule.router);
                }
                logger_1.default.info(`Loaded feature: ${category}/${featureName}`, {
                    basePath: apiModule.basePath,
                    requiresAuth: apiModule.requiresAuth ?? false,
                });
                loadedCount++;
            }
            catch (error) {
                logger_1.default.error(`Failed to load feature ${category}/${featureName}`, {
                    error: error.message,
                });
            }
        }
    }
    logger_1.default.info(`Total features loaded: ${loadedCount}`);
}
//# sourceMappingURL=bootstrap.js.map