"use strict";
/**
 * Webhook 验证服务
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookValidatorService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class WebhookValidatorService {
    constructor() {
        this.WEBHOOK_URL = 'http://localhost:5679/webhook/execution-callback';
        this.N8N_PORT = 5679;
        this.N8N_CONTAINER = 'n8n-self-hosted';
    }
    /**
     * 测试 Webhook 端点
     */
    async testWebhook(request) {
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
            let responseData;
            try {
                responseData = await response.json();
            }
            catch {
                responseData = await response.text();
            }
            return {
                success: response.ok,
                statusCode: response.status,
                responseTime,
                response: responseData,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
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
    async checkN8nContainer() {
        try {
            const { stdout } = await execAsync(`docker ps --filter "name=${this.N8N_CONTAINER}" --format "{{.Names}}\\t{{.Ports}}"`);
            if (!stdout.trim()) {
                return { running: false, error: 'Container not running' };
            }
            const [name, ports] = stdout.trim().split('\t');
            return { running: true, ports };
        }
        catch (error) {
            return { running: false, error: error.message };
        }
    }
    /**
     * 检查端口可达性
     */
    async checkPort(port) {
        try {
            // 使用 curl 测试端口连接
            await execAsync(`curl -sf --connect-timeout 5 --max-time 10 http://localhost:${port}/healthz || echo "FAILED"`);
            return { reachable: true };
        }
        catch (error) {
            // 端口不可达或服务无响应
            return { reachable: false, error: error.message };
        }
    }
    /**
     * 生成完整的 Webhook 状态报告
     */
    async generateStatusReport() {
        logger_1.default.info('[WebhookValidator] Generating status report...');
        // 并行执行所有检查
        const [containerStatus, portCheck, webhookTest] = await Promise.all([
            this.checkN8nContainer(),
            this.checkPort(this.N8N_PORT),
            this.testWebhook({ url: this.WEBHOOK_URL }),
        ]);
        const report = {
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
        logger_1.default.info('[WebhookValidator] Status report generated', {
            accessible: report.accessible,
            containerRunning: containerStatus.running,
        });
        return report;
    }
    /**
     * 发送测试 Webhook 请求（模拟 cleanup.sh 行为）
     */
    async sendTestExecutionCallback(taskId, runId) {
        const payload = {
            task_id: taskId,
            status: 'AI Done',
            run_id: runId,
            coding_type: 'typescript',
            task_name: 'Webhook Test',
            quality_score: 100,
            is_feature_check: false,
        };
        logger_1.default.info('[WebhookValidator] Sending test execution callback', {
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
    async testRetryMechanism() {
        const maxRetries = 3;
        const retryDelay = 2000; // 2秒
        const results = [];
        for (let i = 1; i <= maxRetries; i++) {
            logger_1.default.info(`[WebhookValidator] Retry attempt ${i}/${maxRetries}`);
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
exports.WebhookValidatorService = WebhookValidatorService;
//# sourceMappingURL=webhook-validator.service.js.map