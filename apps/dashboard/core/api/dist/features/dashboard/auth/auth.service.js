"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
// Login service for managing platform login flows
const uuid_1 = require("uuid");
const error_middleware_1 = require("../../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const accounts_1 = require("../accounts");
// In-memory session store (could be Redis in production)
const loginSessions = new Map();
class AuthService {
    constructor() {
        this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    }
    async startLogin(platform, accountId) {
        // Verify account exists
        await accounts_1.accountsService.getAccountByPlatformAndId(platform, accountId);
        const sessionId = `${platform}-${accountId}-${(0, uuid_1.v4)()}`;
        const session = {
            sessionId,
            platform,
            accountId,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
        };
        loginSessions.set(sessionId, session);
        logger_1.default.info('Login session started', {
            sessionId,
            platform,
            accountId,
        });
        // Clean up old sessions
        this.cleanupExpiredSessions();
        return {
            sessionId,
            status: 'pending',
        };
    }
    async getLoginStatus(sessionId) {
        const session = loginSessions.get(sessionId);
        if (!session) {
            return {
                status: 'expired',
                reason: 'Session not found or expired',
            };
        }
        if (new Date() > session.expiresAt) {
            loginSessions.delete(sessionId);
            return {
                status: 'expired',
                reason: 'Session timeout',
            };
        }
        return {
            status: session.status,
        };
    }
    async updateSessionStatus(sessionId, status, reason) {
        const session = loginSessions.get(sessionId);
        if (!session) {
            throw new error_middleware_1.AppError('Session not found', 404);
        }
        session.status = status;
        logger_1.default.info('Login session status updated', {
            sessionId,
            status,
            reason,
        });
    }
    async saveSession(sessionId, storageState) {
        const session = loginSessions.get(sessionId);
        if (!session) {
            throw new error_middleware_1.AppError('Session not found', 404);
        }
        if (session.status !== 'success') {
            throw new error_middleware_1.AppError('Session not in success state', 400);
        }
        // Update account with storage state
        const account = await accounts_1.accountsService.getAccountByPlatformAndId(session.platform, session.accountId);
        await accounts_1.accountsService.updateLoginStatus(account.id, true, storageState);
        // Clean up session
        loginSessions.delete(sessionId);
        logger_1.default.info('Session saved to database', {
            sessionId,
            platform: session.platform,
            accountId: session.accountId,
        });
    }
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [sessionId, session] of loginSessions.entries()) {
            if (now > session.expiresAt) {
                loginSessions.delete(sessionId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.default.debug(`Cleaned up ${cleanedCount} expired login sessions`);
        }
    }
    getActiveSessionCount() {
        return loginSessions.size;
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map