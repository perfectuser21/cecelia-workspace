"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsService = void 0;
// Account service for business logic
const accounts_repository_1 = require("./accounts.repository");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
class AccountService {
    async getAllAccounts(activeOnly = false) {
        return await accounts_repository_1.accountsRepository.findAll(activeOnly);
    }
    async getAccountById(id) {
        const account = await accounts_repository_1.accountsRepository.findById(id);
        if (!account) {
            throw new error_middleware_1.AppError(`Account not found: ${id}`, 404);
        }
        return account;
    }
    async getAccountByPlatformAndId(platform, accountId) {
        const account = await accounts_repository_1.accountsRepository.findByPlatformAndAccountId(platform, accountId);
        if (!account) {
            throw new error_middleware_1.AppError(`Account not found: ${platform}/${accountId}`, 404);
        }
        return account;
    }
    async getAccountsByPlatform(platform) {
        return await accounts_repository_1.accountsRepository.findByPlatform(platform);
    }
    async createAccount(data) {
        // Check if account already exists
        const existing = await accounts_repository_1.accountsRepository.findByPlatformAndAccountId(data.platform, data.account_id);
        if (existing) {
            throw new error_middleware_1.AppError(`Account already exists: ${data.platform}/${data.account_id}`, 409);
        }
        const account = await accounts_repository_1.accountsRepository.create(data);
        logger_1.default.info('Account created', {
            id: account.id,
            platform: account.platform,
            accountId: account.account_id,
        });
        return account;
    }
    async updateAccount(id, data) {
        await this.getAccountById(id); // Verify exists
        const updated = await accounts_repository_1.accountsRepository.update(id, data);
        if (!updated) {
            throw new error_middleware_1.AppError(`Failed to update account: ${id}`, 500);
        }
        logger_1.default.info('Account updated', {
            id: updated.id,
            platform: updated.platform,
            accountId: updated.account_id,
        });
        return updated;
    }
    async updateLoginStatus(id, isLoggedIn, storageState) {
        const updated = await accounts_repository_1.accountsRepository.updateLoginStatus(id, isLoggedIn, storageState);
        if (!updated) {
            throw new error_middleware_1.AppError(`Failed to update login status: ${id}`, 500);
        }
        logger_1.default.info('Account login status updated', {
            id: updated.id,
            platform: updated.platform,
            accountId: updated.account_id,
            isLoggedIn,
        });
        return updated;
    }
    async deleteAccount(id) {
        const account = await this.getAccountById(id);
        const deleted = await accounts_repository_1.accountsRepository.delete(id);
        if (!deleted) {
            throw new error_middleware_1.AppError(`Failed to delete account: ${id}`, 500);
        }
        logger_1.default.info('Account deleted', {
            id: account.id,
            platform: account.platform,
            accountId: account.account_id,
        });
    }
    async getAccountStatistics() {
        return await accounts_repository_1.accountsRepository.countByPlatform();
    }
    formatAccountForApi(account) {
        return {
            platform: account.platform,
            accountId: account.account_id,
            displayName: account.display_name,
            isLoggedIn: account.is_logged_in,
            isActive: account.is_active,
            lastHealthCheck: account.last_health_check,
        };
    }
}
exports.accountsService = new AccountService();
//# sourceMappingURL=accounts.service.js.map