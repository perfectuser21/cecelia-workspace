"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        logger_1.default.warn('Missing authorization header', {
            ip: req.ip,
            path: req.path,
        });
        res.status(401).json({
            error: 'Invalid API key',
        });
        return;
    }
    const token = authHeader.replace('Bearer ', '');
    if (token !== config_1.default.apiKey) {
        logger_1.default.warn('Invalid API key attempt', {
            ip: req.ip,
            path: req.path,
        });
        res.status(401).json({
            error: 'Invalid API key',
        });
        return;
    }
    req.apiKey = token;
    next();
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map