/**
 * Webhook 验证服务
 */
import type { WebhookTestRequest, WebhookTestResult, WebhookStatusReport } from './webhook-validator.types';
export declare class WebhookValidatorService {
    private readonly WEBHOOK_URL;
    private readonly N8N_PORT;
    private readonly N8N_CONTAINER;
    /**
     * 测试 Webhook 端点
     */
    testWebhook(request: WebhookTestRequest): Promise<WebhookTestResult>;
    /**
     * 检查 n8n 容器状态
     */
    checkN8nContainer(): Promise<{
        running: boolean;
        ports?: string;
        error?: string;
    }>;
    /**
     * 检查端口可达性
     */
    checkPort(port: number): Promise<{
        reachable: boolean;
        error?: string;
    }>;
    /**
     * 生成完整的 Webhook 状态报告
     */
    generateStatusReport(): Promise<WebhookStatusReport>;
    /**
     * 发送测试 Webhook 请求（模拟 cleanup.sh 行为）
     */
    sendTestExecutionCallback(taskId: string, runId: string): Promise<WebhookTestResult>;
    /**
     * 验证重试机制（模拟失败场景）
     */
    testRetryMechanism(): Promise<{
        success: boolean;
        attempts: number;
        results: WebhookTestResult[];
    }>;
}
//# sourceMappingURL=webhook-validator.service.d.ts.map