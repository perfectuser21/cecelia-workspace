// Collection service for orchestrating data collection
import {
  Platform,
  CollectDailyRequest,
  CollectDailyResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from '../../../shared/types';
import { AppError } from '../../../shared/middleware/error.middleware';
import logger from '../../../shared/utils/logger';
import { accountsService } from '../accounts';
import { metricService } from '../metrics';

// Worker interface (inline to avoid cross-package import)
interface WorkerInterface {
  healthCheck(accountId: string, storageState?: string): Promise<boolean>;
  collectDaily(accountId: string, date: string, storageState?: string): Promise<any>;
}

export class CollectService {
  private workers: Map<Platform, WorkerInterface> = new Map();

  registerWorker(platform: Platform, worker: WorkerInterface): void {
    this.workers.set(platform, worker);
    logger.info(`Worker registered for platform: ${platform}`);
  }

  getWorker(platform: Platform): WorkerInterface {
    const worker = this.workers.get(platform);
    if (!worker) {
      throw new AppError(`No worker available for platform: ${platform}`, 400);
    }
    return worker;
  }

  async healthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse> {
    const { platform, accountId } = request;

    logger.info('Health check started', { platform, accountId });

    try {
      // Get account
      const account = await accountsService.getAccountByPlatformAndId(platform, accountId);

      // Check if storage state exists
      if (!account.storage_state) {
        await accountsService.updateLoginStatus(account.id, false);
        return {
          loggedIn: false,
          reason: 'No storage state found',
        };
      }

      // Get worker and perform health check
      const worker = this.getWorker(platform);
      const isLoggedIn = await worker.healthCheck(
        accountId,
        JSON.parse(account.storage_state)
      );

      // Update account status
      await accountsService.updateLoginStatus(account.id, isLoggedIn);

      logger.info('Health check completed', {
        platform,
        accountId,
        isLoggedIn,
      });

      return {
        loggedIn: isLoggedIn,
        reason: isLoggedIn ? undefined : 'Storage state expired or redirected to login',
      };
    } catch (error: any) {
      logger.error('Health check failed', {
        platform,
        accountId,
        error: error.message,
      });

      throw new AppError(`Health check failed: ${error.message}`, 500);
    }
  }

  async collectDaily(request: CollectDailyRequest): Promise<CollectDailyResponse> {
    const { platform, accountId, date } = request;

    logger.info('Daily collection started', { platform, accountId, date });

    try {
      // Get account
      const account = await accountsService.getAccountByPlatformAndId(platform, accountId);

      // Verify account is logged in
      if (!account.is_logged_in || !account.storage_state) {
        throw new AppError('Account not logged in', 401);
      }

      // Get worker and collect data
      const worker = this.getWorker(platform);
      const metrics = await worker.collectDaily(
        accountId,
        date,
        JSON.parse(account.storage_state)
      );

      // Calculate delta
      const previousMetric = await metricService.getPreviousDayMetric(account.id, date);
      const followersDelta = previousMetric
        ? metrics.followers_total - previousMetric.followers_total
        : 0;

      const response: CollectDailyResponse = {
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

      logger.info('Daily collection completed', {
        platform,
        accountId,
        date,
        followers: metrics.followers_total,
        delta: followersDelta,
      });

      return response;
    } catch (error: any) {
      logger.error('Daily collection failed', {
        platform,
        accountId,
        date,
        error: error.message,
      });

      throw new AppError(`Collection failed: ${error.message}`, 500);
    }
  }

  async collectAllAccounts(date: string): Promise<CollectDailyResponse[]> {
    const accounts = await accountsService.getAllAccounts(true);
    const results: CollectDailyResponse[] = [];
    const errors: Array<{ account: string; error: string }> = [];

    logger.info(`Starting collection for ${accounts.length} accounts`, { date });

    for (const account of accounts) {
      try {
        const result = await this.collectDaily({
          platform: account.platform,
          accountId: account.account_id,
          date,
        });
        results.push(result);
      } catch (error: any) {
        logger.error('Account collection failed', {
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

    logger.info('Batch collection completed', {
      total: accounts.length,
      successful: results.length,
      failed: errors.length,
    });

    return results;
  }
}

export const collectService = new CollectService();
export default collectService;
