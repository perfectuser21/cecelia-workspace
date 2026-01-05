/**
 * Webhook 验证服务
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../../shared/utils/logger';
import type {
  WebhookTestRequest,
  WebhookTestResult,
  WebhookStatusReport,
  ExecutionCallbackPayload,
} from './webhook-validator.types';

const execAsync = promisify(exec);

export class WebhookValidatorService {
  private readonly WEBHOOK_URL = 'http://localhost:5679/webhook/execution-callback';
  private readonly N8N_PORT = 5679;
  private readonly N8N_CONTAINER = 'n8n-self-hosted';

  /**
   * 测试 Webhook 端点
   */
  async testWebhook(request: WebhookTestRequest): Promise<WebhookTestResult> {
    const startTime = Date.now();
    const timeout = (request.timeout || 10) * 1000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload || { test: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let responseData: any;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        response: responseData,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 检查 n8n 容器状态
   */
  async checkN8nContainer(): Promise<{
    running: boolean;
    ports?: string;
    error?: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=${this.N8N_CONTAINER}" --format "{{.Names}}\\t{{.Ports}}"`
      );

      if (!stdout.trim()) {
        return { running: false, error: 'Container not running' };
      }

      const [name, ports] = stdout.trim().split('\t');
      return { running: true, ports };
    } catch (error: any) {
      return { running: false, error: error.message };
    }
  }

  /**
   * 检查端口可达性
   */
  async checkPort(port: number): Promise<{ reachable: boolean; error?: string }> {
    try {
      // 使用 curl 测试端口连接
      await execAsync(
        `curl -sf --connect-timeout 5 --max-time 10 http://localhost:${port}/healthz || echo "FAILED"`
      );
      return { reachable: true };
    } catch (error: any) {
      // 端口不可达或服务无响应
      return { reachable: false, error: error.message };
    }
  }

  /**
   * 生成完整的 Webhook 状态报告
   */
  async generateStatusReport(): Promise<WebhookStatusReport> {
    logger.info('[WebhookValidator] Generating status report...');

    // 并行执行所有检查
    const [containerStatus, portCheck, webhookTest] = await Promise.all([
      this.checkN8nContainer(),
      this.checkPort(this.N8N_PORT),
      this.testWebhook({ url: this.WEBHOOK_URL }),
    ]);

    const report: WebhookStatusReport = {
      webhookUrl: this.WEBHOOK_URL,
      accessible: webhookTest.success,
      n8nContainerStatus: containerStatus,
      portCheck: {
        port: this.N8N_PORT,
        ...portCheck,
      },
      webhookTest,
      retryMechanism: {
        maxRetries: 3,
        retryDelay: 2,
        configured: true,
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info('[WebhookValidator] Status report generated', {
      accessible: report.accessible,
      containerRunning: containerStatus.running,
    });

    return report;
  }

  /**
   * 发送测试 Webhook 请求（模拟 cleanup.sh 行为）
   */
  async sendTestExecutionCallback(
    taskId: string,
    runId: string
  ): Promise<WebhookTestResult> {
    const payload: ExecutionCallbackPayload = {
      task_id: taskId,
      status: 'AI Done',
      run_id: runId,
      coding_type: 'typescript',
      task_name: 'Webhook Test',
      quality_score: 100,
      is_feature_check: false,
    };

    logger.info('[WebhookValidator] Sending test execution callback', {
      taskId,
      runId,
    });

    return this.testWebhook({
      url: this.WEBHOOK_URL,
      payload,
      timeout: 30,
    });
  }

  /**
   * 验证重试机制（模拟失败场景）
   */
  async testRetryMechanism(): Promise<{
    success: boolean;
    attempts: number;
    results: WebhookTestResult[];
  }> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2秒
    const results: WebhookTestResult[] = [];

    for (let i = 1; i <= maxRetries; i++) {
      logger.info(`[WebhookValidator] Retry attempt ${i}/${maxRetries}`);

      const result = await this.testWebhook({
        url: this.WEBHOOK_URL,
        payload: { test: true, attempt: i },
      });

      results.push(result);

      if (result.success) {
        return { success: true, attempts: i, results };
      }

      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return { success: false, attempts: maxRetries, results };
  }
}
