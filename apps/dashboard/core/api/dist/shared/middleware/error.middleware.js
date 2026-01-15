"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        logger_1.default.error('Application error', {
            message: err.message,
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
            stack: err.stack,
        });
        res.status(err.statusCode).json({
            error: err.message,
        });
        return;
    }
    // Unknown error
    logger_1.default.error('Unexpected error', {
        message: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack,
    });
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map