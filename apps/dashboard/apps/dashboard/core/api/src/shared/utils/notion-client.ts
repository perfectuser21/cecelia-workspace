/**
 * Notion API 客户端 - 带重试逻辑 v1.6
 * 
 * 功能：
 * - 指数退避重试策略
 * - 可配置的重试参数
 * - 完整的重试日志记录
 * - 错误分类和处理
 * - 告警机制
 */

import { Client } from '@notionhq/client';
import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

// 重试配置接口
export interface NotionRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
  nonRetryableStatusCodes: number[];
  networkErrors: string[];
  alertThreshold: number;
  logRetryDetails: boolean;
}

// 重试记录接口
export interface RetryRecord {
  attempt: number;
  timestamp: string;
  delay: number;
  error: string;
  statusCode?: number;
  errorCode?: string;
}

// 执行结果接口
export interface ExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  retries: RetryRecord[];
  totalDuration: number;
  finalAttempt: number;
}

// 默认配置
const DEFAULT_CONFIG: NotionRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  nonRetryableStatusCodes: [400, 401, 403, 404],
  networkErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'],
  alertThreshold: 2,
  logRetryDetails: true,
};

/**
 * Notion 客户端（带重试逻辑）
 */
export class NotionClientWithRetry {
  private client: Client;
  private config: NotionRetryConfig;
  private runId?: string;

  constructor(apiKey: string, config?: Partial<NotionRetryConfig>, runId?: string) {
    this.client = new Client({ auth: apiKey });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runId = runId;
  }

  /**
   * 计算退避延迟时间
   */
  private calculateDelay(attempt: number, statusCode?: number): number {
    // 429 错误使用更长的退避时间
    const multiplier = statusCode === 429 ? 2 : 1;
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt) * multiplier,
      this.config.maxDelay
    );
    return delay;
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    // HTTP 状态码错误
    if (error.status) {
      return this.config.retryableStatusCodes.includes(error.status);
    }

    // Axios 错误
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status) {
        return this.config.retryableStatusCodes.includes(axiosError.response.status);
      }
      // 网络错误
      if (axiosError.code && this.config.networkErrors.includes(axiosError.code)) {
        return true;
      }
    }

    // Notion API 错误
    if (error.code) {
      return this.config.networkErrors.includes(error.code);
    }

    return false;
  }

  /**
   * 延迟执行
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 写入告警日志
   */
  private async writeAlert(context: {
    operation: string;
    error: string;
    retries: RetryRecord[];
    totalDuration: number;
  }): Promise<void> {
    if (!this.runId) return;

    const alertPath = `/home/xx/data/runs/${this.runId}/logs/alerts.log`;
    const alertMessage = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      type: 'NOTION_API_RETRY_EXHAUSTED',
      ...context,
    };

    try {
      await fs.mkdir(path.dirname(alertPath), { recursive: true });
      await fs.appendFile(alertPath, JSON.stringify(alertMessage) + '\n');
      logger.error('[NotionClient] Alert triggered', alertMessage);
    } catch (err) {
      logger.error('[NotionClient] Failed to write alert', { error: (err as Error).message });
    }
  }

  /**
   * 通用重试执行器
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const retries: RetryRecord[] = [];
    let lastError: any;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (this.config.logRetryDetails && attempt > 0) {
          logger.info(`[NotionClient] Retry attempt ${attempt}/${this.config.maxRetries}`, {
            operation: operationName,
          });
        }

        const data = await operation();
        const totalDuration = Date.now() - startTime;

        if (this.config.logRetryDetails && attempt > 0) {
          logger.info('[NotionClient] Operation succeeded after retries', {
            operation: operationName,
            attempts: attempt + 1,
            totalDuration,
          });
        }

        return {
          success: true,
          data,
          retries,
          totalDuration,
          finalAttempt: attempt,
        };
      } catch (error: any) {
        lastError = error;
        const statusCode = error.status || error.response?.status;
        const errorCode = error.code;

        // 记录重试信息
        const retryRecord: RetryRecord = {
          attempt,
          timestamp: new Date().toISOString(),
          delay: 0,
          error: error.message || 'Unknown error',
          statusCode,
          errorCode,
        };

        // 判断是否可重试
        if (!this.isRetryableError(error)) {
          logger.warn('[NotionClient] Non-retryable error', {
            operation: operationName,
            statusCode,
            errorCode,
            message: error.message,
          });
          retries.push(retryRecord);
          break;
        }

        // 达到最大重试次数
        if (attempt >= this.config.maxRetries) {
          logger.error('[NotionClient] Max retries exceeded', {
            operation: operationName,
            attempts: attempt + 1,
            statusCode,
            errorCode,
          });
          retries.push(retryRecord);
          break;
        }

        // 计算延迟并等待
        const delay = this.calculateDelay(attempt, statusCode);
        retryRecord.delay = delay;
        retries.push(retryRecord);

        logger.warn('[NotionClient] Retryable error, waiting before retry', {
          operation: operationName,
          attempt: attempt + 1,
          delay,
          statusCode,
          errorCode,
          message: error.message,
        });

        await this.sleep(delay);
      }
    }

    // 重试耗尽，触发告警
    const totalDuration = Date.now() - startTime;
    await this.writeAlert({
      operation: operationName,
      error: lastError?.message || 'Unknown error',
      retries,
      totalDuration,
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retries,
      totalDuration,
      finalAttempt: this.config.maxRetries,
    };
  }

  /**
   * 查询数据库
   */
  async queryDatabase(databaseId: string, query?: any): Promise<ExecutionResult> {
    return this.executeWithRetry(
      () => this.client.databases.query({ database_id: databaseId, ...query }),
      `queryDatabase(${databaseId})`
    );
  }

  /**
   * 获取页面
   */
  async retrievePage(pageId: string): Promise<ExecutionResult> {
    return this.executeWithRetry(
      () => this.client.pages.retrieve({ page_id: pageId }),
      `retrievePage(${pageId})`
    );
  }

  /**
   * 更新页面
   */
  async updatePage(pageId: string, properties: any): Promise<ExecutionResult> {
    return this.executeWithRetry(
      () => this.client.pages.update({ page_id: pageId, properties }),
      `updatePage(${pageId})`
    );
  }

  /**
   * 创建页面
   */
  async createPage(parent: any, properties: any): Promise<ExecutionResult> {
    return this.executeWithRetry(
      () => this.client.pages.create({ parent, properties }),
      'createPage'
    );
  }

  /**
   * 追加块内容
   */
  async appendBlockChildren(blockId: string, children: any[]): Promise<ExecutionResult> {
    return this.executeWithRetry(
      () => this.client.blocks.children.append({ block_id: blockId, children }),
      `appendBlockChildren(${blockId})`
    );
  }

  /**
   * 获取原始客户端（不需要重试的场景）
   */
  getRawClient(): Client {
    return this.client;
  }
}

/**
 * 创建 Notion 客户端
 */
export function createNotionClient(
  apiKey?: string,
  config?: Partial<NotionRetryConfig>,
  runId?: string
): NotionClientWithRetry {
  const key = apiKey || process.env.NOTION_API_KEY;
  if (!key) {
    throw new Error('NOTION_API_KEY is required');
  }
  return new NotionClientWithRetry(key, config, runId);
}

/**
 * 加载重试配置
 */
export async function loadRetryConfig(configPath?: string): Promise<NotionRetryConfig> {
  const defaultPath = '/home/xx/dev/zenithjoy-autopilot/apps/dashboard/config/notion-retry.json';
  const filePath = configPath || defaultPath;

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const config = JSON.parse(content);
    logger.info('[NotionClient] Loaded retry config', { path: filePath });
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    logger.warn('[NotionClient] Failed to load config, using defaults', {
      path: filePath,
      error: (error as Error).message,
    });
    return DEFAULT_CONFIG;
  }
}
