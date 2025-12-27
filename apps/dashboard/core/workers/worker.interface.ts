/**
 * Worker Interface
 * All platform workers must implement this interface
 */

export interface WorkerHealthCheckResult {
  loggedIn: boolean;
  reason?: string;
}

export interface WorkerCollectResult {
  platform: string;
  accountId: string;
  date: string;
  followers_total: number;
  followers_delta: number;
  impressions: number;
  engagements: number;
  posts_published: number;
  top_post_url?: string;
  top_post_engagement?: number;
  raw_data?: any;
}

export interface IWorker {
  /**
   * Check if the account is logged in
   * @param accountId - The account identifier
   * @returns Promise with login status
   */
  healthCheck(accountId: string): Promise<WorkerHealthCheckResult>;

  /**
   * Collect metrics for a specific date
   * @param accountId - The account identifier
   * @param date - Date in YYYY-MM-DD format
   * @returns Promise with collected metrics
   */
  collect(accountId: string, date: string): Promise<WorkerCollectResult>;
}

/**
 * Base Worker class with common functionality
 */
export abstract class BaseWorker implements IWorker {
  protected platform: string;

  constructor(platform: string) {
    this.platform = platform;
  }

  abstract healthCheck(accountId: string): Promise<WorkerHealthCheckResult>;
  abstract collect(accountId: string, date: string): Promise<WorkerCollectResult>;

  /**
   * Load storageState from database
   * TODO: Implement actual database query
   */
  protected async loadStorageState(accountId: string): Promise<any> {
    // Mock implementation
    console.log(`Loading storageState for ${this.platform}/${accountId}`);
    return null;
  }

  /**
   * Save storageState to database
   * TODO: Implement actual database update
   */
  protected async saveStorageState(accountId: string, storageState: any): Promise<void> {
    console.log(`Saving storageState for ${this.platform}/${accountId}`);
  }

  /**
   * Calculate followers delta by comparing with yesterday's data
   * TODO: Implement actual database query
   */
  protected async calculateFollowersDelta(
    accountId: string,
    currentTotal: number,
    date: string
  ): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 200) - 50;
  }
}
