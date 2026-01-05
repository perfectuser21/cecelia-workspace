// Account service for business logic
import { accountsRepository } from './accounts.repository';
import { Account, CreateAccountDTO, UpdateAccountDTO, AccountApiResponse } from './accounts.types';
import { Platform } from '../../../shared/types';
import { AppError } from '../../../shared/middleware/error.middleware';
import logger from '../../../shared/utils/logger';

class AccountService {
  async getAllAccounts(activeOnly: boolean = false): Promise<Account[]> {
    return await accountsRepository.findAll(activeOnly);
  }

  async getAccountById(id: number): Promise<Account> {
    const account = await accountsRepository.findById(id);
    if (!account) {
      throw new AppError(`Account not found: ${id}`, 404);
    }
    return account;
  }

  async getAccountByPlatformAndId(
    platform: Platform,
    accountId: string
  ): Promise<Account> {
    const account = await accountsRepository.findByPlatformAndAccountId(platform, accountId);
    if (!account) {
      throw new AppError(`Account not found: ${platform}/${accountId}`, 404);
    }
    return account;
  }

  async getAccountsByPlatform(platform: Platform): Promise<Account[]> {
    return await accountsRepository.findByPlatform(platform);
  }

  async createAccount(data: CreateAccountDTO): Promise<Account> {
    // Check if account already exists
    const existing = await accountsRepository.findByPlatformAndAccountId(
      data.platform,
      data.account_id
    );
    if (existing) {
      throw new AppError(
        `Account already exists: ${data.platform}/${data.account_id}`,
        409
      );
    }

    const account = await accountsRepository.create(data);
    logger.info('Account created', {
      id: account.id,
      platform: account.platform,
      accountId: account.account_id,
    });

    return account;
  }

  async updateAccount(id: number, data: UpdateAccountDTO): Promise<Account> {
    await this.getAccountById(id); // Verify exists
    const updated = await accountsRepository.update(id, data);

    if (!updated) {
      throw new AppError(`Failed to update account: ${id}`, 500);
    }

    logger.info('Account updated', {
      id: updated.id,
      platform: updated.platform,
      accountId: updated.account_id,
    });

    return updated;
  }

  async updateLoginStatus(
    id: number,
    isLoggedIn: boolean,
    storageState?: string
  ): Promise<Account> {
    const updated = await accountsRepository.updateLoginStatus(id, isLoggedIn, storageState);
    if (!updated) {
      throw new AppError(`Failed to update login status: ${id}`, 500);
    }

    logger.info('Account login status updated', {
      id: updated.id,
      platform: updated.platform,
      accountId: updated.account_id,
      isLoggedIn,
    });

    return updated;
  }

  async deleteAccount(id: number): Promise<void> {
    const account = await this.getAccountById(id);
    const deleted = await accountsRepository.delete(id);

    if (!deleted) {
      throw new AppError(`Failed to delete account: ${id}`, 500);
    }

    logger.info('Account deleted', {
      id: account.id,
      platform: account.platform,
      accountId: account.account_id,
    });
  }

  async getAccountStatistics(): Promise<Record<string, number>> {
    return await accountsRepository.countByPlatform();
  }

  formatAccountForApi(account: Account): AccountApiResponse {
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

export const accountsService = new AccountService();
