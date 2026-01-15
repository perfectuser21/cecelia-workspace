"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectService = exports.CollectService = void 0;
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
const accounts_1 = require("../accounts");
const metrics_1 = require("../metrics");
class CollectService {
    constructor() {
        this.workers = new Map();
    }
    registerWorker(platform, worker) {
        this.workers.set(platform, worker);
        logger_1.default.info(`Worker registered for platform: ${platform}`);
    }
    getWorker(platform) {
        const worker = this.workers.get(platform);
        if (!worker) {
            throw new error_middleware_1.AppError(`No worker available for platform: ${platform}`, 400);
        }
        return worker;
    }
    async healthCheck(request) {
        const { platform, accountId } = request;
        logger_1.default.info('Health check started', { platform, accountId });
        try {
            // Get account
            const account = await accounts_1.accountsService.getAccountByPlatformAndId(platform, accountId);
            // Check if storage state exists
            if (!account.storage_state) {
                await accounts_1.accountsService.updateLoginStatus(account.id, false);
                return {
                    loggedIn: false,
                    reason: 'No storage state found',
                };
            }
            // Get worker and perform health check
            const worker = this.getWorker(platform);
            const isLoggedIn = await worker.healthCheck(accountId, JSON.parse(account.storage_state));
            // Update account status
            await accounts_1.accountsService.updateLoginStatus(account.id, isLoggedIn);
            logger_1.default.info('Health check completed', {
                platform,
                accountId,
                isLoggedIn,
            });
            return {
                loggedIn: isLoggedIn,
                reason: isLoggedIn ? undefined : 'Storage state expired or redirected to login',
            };
        }
        catch (error) {
            logger_1.default.error('Health check failed', {
                platform,
                accountId,
                error: error.message,
            });
            throw new error_middleware_1.AppError(`Health check failed: ${error.message}`, 500);
        }
    }
    async collectDaily(request) {
        const { platform, accountId, date } = request;
        logger_1.default.info('Daily collection started', { platform, accountId, date });
        try {
            // Get account
            const account = await accounts_1.accountsService.getAccountByPlatformAndId(platform, accountId);
            // Verify account is logged in
            if (!account.is_logged_in || !account.storage_state) {
                throw new error_middleware_1.AppError('Account not logged in', 401);
            }
            // Get worker and collect data
            const worker = this.getWorker(platform);
            const metrics = await worker.collectDaily(accountId, date, JSON.parse(account.storage_state));
            // Calculate delta
            const previousMetric = await metrics_1.metricService.getPreviousDayMetric(account.id, date);
            const followersDelta = previousMetric
                ? metrics.followers_total - previousMetric.followers_total
                : 0;
            const response = {
                platform,
                accountId,
                date,
                followers_total: metrics.followers_total,
                followers_delta: followersDelta,
                impressions: metrics.impressions,
                engagements: metrics.engagements,
                posts_published: metrics.posts_published,
                top_post_url: metrics.top_post_url,
                top_post_engagement: metrics.top_post_engagement,
            };
            logger_1.default.info('Daily collection completed', {
                platform,
                accountId,
                date,
                followers: metrics.followers_total,
                delta: followersDelta,
            });
            return response;
        }
        catch (error) {
            logger_1.default.error('Daily collection failed', {
                platform,
                accountId,
                date,
                error: error.message,
            });
            throw new error_middleware_1.AppError(`Collection failed: ${error.message}`, 500);
        }
    }
    async collectAllAccounts(date) {
        const accounts = await accounts_1.accountsService.getAllAccounts(true);
        const results = [];
        const errors = [];
        logger_1.default.info(`Starting collection for ${accounts.length} accounts`, { date });
        for (const account of accounts) {
            try {
                const result = await this.collectDaily({
                    platform: account.platform,
                    accountId: account.account_id,
                    date,
                });
                results.push(result);
            }
            catch (error) {
                logger_1.default.error('Account collection failed', {
                    platform: account.platform,
                    accountId: account.account_id,
                    error: error.message,
                });
                errors.push({
                    account: `${account.platform}/${account.account_id}`,
                    error: error.message,
                });
            }
        }
        logger_1.default.info('Batch collection completed', {
            total: accounts.length,
            successful: results.length,
            failed: errors.length,
        });
        return results;
    }
}
exports.CollectService = CollectService;
exports.collectService = new CollectService();
exports.default = exports.collectService;
//# sourceMappingURL=collect.service.js.map