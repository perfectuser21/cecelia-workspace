/**
 * Webhook 验证器类型定义
 */
export interface WebhookTestRequest {
    /** Webhook URL */
    url: string;
    /** 测试负载数据 */
    payload?: Record<string, any>;
    /** 超时时间（秒） */
    timeout?: number;
}
export interface WebhookTestResult {
    /** 测试是否成功 */
    success: boolean;
    /** HTTP 状态码 */
    statusCode?: number;
    /** 响应时间（毫秒） */
    responseTime: number;
    /** 错误信息 */
    error?: string;
    /** 响应数据 */
    response?: any;
    /** 时间戳 */
    timestamp: string;
}
export interface WebhookStatusReport {
    /** Webhook URL */
    webhookUrl: string;
    /** 是否可访问 */
    accessible: boolean;
    /** n8n 容器状态 */
    n8nContainerStatus: {
        running: boolean;
        ports?: string;
        error?: string;
    };
    /** 端口可达性测试 */
    portCheck: {
        port: number;
        reachable: boolean;
        error?: string;
    };
    /** Webhook 测试结果 */
    webhookTest: WebhookTestResult;
    /** 重试机制状态 */
    retryMechanism: {
        maxRetries: number;
        retryDelay: number;
        configured: boolean;
    };
    /** 生成时间 */
    generatedAt: string;
}
export interface ExecutionCallbackPayload {
    /** 任务 ID */
    task_id: string;
    /** 任务状态 */
    status: string;
    /** 运行 ID */
    run_id: string;
    /** 编码类型 */
    coding_type: string;
    /** 任务名称 */
    task_name: string;
    /** 质检分数 */
    quality_score: number;
    /** 是否为功能检查 */
    is_feature_check: boolean;
}
//# sourceMappingURL=webhook-validator.types.d.ts.map