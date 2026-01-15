"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.n8nWorkflowsService = void 0;
// N8n Workflows service - proxies n8n REST API
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const instances = {
    // 本地部署的 n8n（当前使用）
    local: {
        baseUrl: process.env.N8N_LOCAL_URL || 'http://localhost:5679',
        apiKey: process.env.N8N_LOCAL_API_KEY || '',
        name: 'Self-hosted',
    },
    // Cloud 实例（备用，需要时配置）
    cloud: {
        baseUrl: process.env.N8N_CLOUD_URL || '',
        apiKey: process.env.N8N_CLOUD_API_KEY || '',
        name: 'Cloud',
    },
};
// 默认使用 local 实例
const N8N_BASE_URL = instances.local.baseUrl;
const N8N_API_KEY = instances.local.apiKey;
class N8nWorkflowsService {
    /**
     * 检查实例是否可用（已配置 API Key）
     */
    isInstanceAvailable(instance) {
        return !!instances[instance]?.apiKey;
    }
    /**
     * 获取实例配置
     */
    getInstanceConfig(instance) {
        const config = instances[instance];
        if (!config) {
            throw new Error(`Unknown instance: ${instance}`);
        }
        return config;
    }
    /**
     * 通用 fetch 方法（支持多实例）
     */
    async fetchN8nInstance(instance, endpoint) {
        const config = this.getInstanceConfig(instance);
        const url = `${config.baseUrl}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-N8N-API-KEY': config.apiKey,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`N8n API error: ${response.status} - ${errorText}`);
            }
            return await response.json();
        }
        catch (error) {
            logger_1.default.error('Failed to fetch from n8n API', { instance, endpoint, error });
            throw error;
        }
    }
    async fetchN8n(endpoint) {
        const url = `${N8N_BASE_URL}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-N8N-API-KEY': N8N_API_KEY,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`N8n API error: ${response.status} - ${errorText}`);
            }
            return await response.json();
        }
        catch (error) {
            logger_1.default.error('Failed to fetch from n8n API', { endpoint, error });
            throw error;
        }
    }
    /**
     * Calculate run stats for a single workflow
     */
    calculateWorkflowRunStats(workflowId, executions) {
        // 过滤该工作流的执行记录
        const workflowExecutions = executions.filter(e => e.workflowId === workflowId);
        // 当前正在运行的数量
        const runningCount = workflowExecutions.filter(e => e.status === 'running' || e.status === 'waiting').length;
        // 最近一次执行
        const sortedExecutions = [...workflowExecutions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        const lastExecution = sortedExecutions[0];
        // 近期统计（取最近 20 条已完成的）
        const completedExecutions = sortedExecutions
            .filter(e => e.finished)
            .slice(0, 20);
        const successCount = completedExecutions.filter(e => e.status === 'success').length;
        const errorCount = completedExecutions.filter(e => e.status === 'error' || e.status === 'crashed').length;
        const total = completedExecutions.length;
        return {
            runningCount,
            lastExecution: lastExecution ? {
                id: lastExecution.id,
                status: lastExecution.status,
                startedAt: lastExecution.startedAt,
                stoppedAt: lastExecution.stoppedAt,
            } : undefined,
            recentStats: {
                total,
                success: successCount,
                error: errorCount,
                successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
            },
        };
    }
    /**
     * Get all workflows with run statistics
     */
    async getWorkflows() {
        try {
            // 并行获取工作流和执行记录
            const [workflowsResponse, executionsResponse] = await Promise.all([
                this.fetchN8n('/api/v1/workflows'),
                this.fetchN8n('/api/v1/executions?limit=200'),
            ]);
            const workflows = workflowsResponse.data || [];
            const executions = executionsResponse.data || [];
            // 为每个工作流计算运行统计
            const workflowsWithStats = workflows.map(workflow => ({
                ...workflow,
                runStats: this.calculateWorkflowRunStats(workflow.id, executions),
            }));
            const activeWorkflows = workflows.filter(w => w.active).length;
            const inactiveWorkflows = workflows.length - activeWorkflows;
            return {
                totalWorkflows: workflows.length,
                activeWorkflows,
                inactiveWorkflows,
                workflows: workflowsWithStats,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get workflows', { error });
            throw error;
        }
    }
    /**
     * Get single workflow details
     */
    async getWorkflow(id) {
        try {
            const response = await this.fetchN8n(`/api/v1/workflows/${id}`);
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get workflow', { id, error });
            throw error;
        }
    }
    /**
     * Get executions with optional filters
     */
    async getExecutions(params) {
        try {
            const queryParams = new URLSearchParams();
            if (params?.status)
                queryParams.append('status', params.status);
            if (params?.limit)
                queryParams.append('limit', params.limit.toString());
            if (params?.workflowId)
                queryParams.append('workflowId', params.workflowId);
            const queryString = queryParams.toString();
            const endpoint = `/api/v1/executions${queryString ? `?${queryString}` : ''}`;
            const response = await this.fetchN8n(endpoint);
            const executions = response.data || [];
            // Also fetch workflows to map names
            let workflowMap = new Map();
            try {
                const workflowsResponse = await this.fetchN8n('/api/v1/workflows');
                workflowMap = new Map((workflowsResponse.data || []).map(w => [w.id, w.name]));
            }
            catch {
                // Ignore errors in workflow name mapping
            }
            // Add workflow names to executions
            const executionsWithNames = executions.map(e => ({
                ...e,
                workflowName: workflowMap.get(e.workflowId) || e.workflowId,
            }));
            const successCount = executions.filter(e => e.status === 'success').length;
            const errorCount = executions.filter(e => e.status === 'error' || e.status === 'crashed').length;
            const runningCount = executions.filter(e => e.status === 'running' || e.status === 'waiting').length;
            const total = executions.length;
            return {
                total,
                success: successCount,
                error: errorCount,
                running: runningCount,
                successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
                executions: executionsWithNames,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get executions', { params, error });
            throw error;
        }
    }
    /**
     * Get overview with workflows and recent executions
     */
    async getOverview() {
        try {
            const [workflows, recentExecutions] = await Promise.all([
                this.getWorkflows(),
                this.getExecutions({ limit: 50 }),
            ]);
            return {
                workflows,
                recentExecutions,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get n8n overview', { error });
            throw error;
        }
    }
    // ==================== 多实例方法 ====================
    /**
     * 获取指定实例的工作流列表（带统计）
     */
    async getWorkflowsByInstance(instance) {
        try {
            const [workflowsResponse, executionsResponse] = await Promise.all([
                this.fetchN8nInstance(instance, '/api/v1/workflows'),
                this.fetchN8nInstance(instance, '/api/v1/executions?limit=200'),
            ]);
            const workflows = workflowsResponse.data || [];
            const executions = executionsResponse.data || [];
            const workflowsWithStats = workflows.map(workflow => ({
                ...workflow,
                runStats: this.calculateWorkflowRunStats(workflow.id, executions),
            }));
            const activeWorkflows = workflows.filter(w => w.active).length;
            const inactiveWorkflows = workflows.length - activeWorkflows;
            return {
                totalWorkflows: workflows.length,
                activeWorkflows,
                inactiveWorkflows,
                workflows: workflowsWithStats,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get workflows by instance', { instance, error });
            throw error;
        }
    }
    /**
     * 获取指定实例的概览
     */
    async getOverviewByInstance(instance) {
        try {
            const [workflows, executionsResponse] = await Promise.all([
                this.getWorkflowsByInstance(instance),
                this.fetchN8nInstance(instance, '/api/v1/executions?limit=50'),
            ]);
            const executions = executionsResponse.data || [];
            // 获取工作流名称映射
            const workflowMap = new Map(workflows.workflows.map(w => [w.id, w.name]));
            const executionsWithNames = executions.map(e => ({
                ...e,
                workflowName: workflowMap.get(e.workflowId) || e.workflowId,
            }));
            const successCount = executions.filter(e => e.status === 'success').length;
            const errorCount = executions.filter(e => e.status === 'error' || e.status === 'crashed').length;
            const runningCount = executions.filter(e => e.status === 'running' || e.status === 'waiting').length;
            const total = executions.length;
            return {
                workflows,
                recentExecutions: {
                    total,
                    success: successCount,
                    error: errorCount,
                    running: runningCount,
                    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
                    executions: executionsWithNames,
                    timestamp: Date.now(),
                },
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get overview by instance', { instance, error });
            throw error;
        }
    }
    /**
     * 获取单个工作流详情
     */
    async getWorkflowDetail(instance, id) {
        try {
            const response = await this.fetchN8nInstance(instance, `/api/v1/workflows/${id}`);
            // n8n API 直接返回工作流对象（不是 {data: ...} 格式）
            const workflow = response;
            // 解析节点信息
            const nodes = workflow.nodes || [];
            const nodeCount = nodes.length;
            // 判断触发类型
            let triggerType = 'other';
            let triggerInfo;
            const triggerNode = nodes.find(n => n.type.includes('trigger') ||
                n.type.includes('Trigger') ||
                n.type === 'n8n-nodes-base.scheduleTrigger' ||
                n.type === 'n8n-nodes-base.webhook');
            if (triggerNode) {
                if (triggerNode.type.includes('schedule') || triggerNode.type.includes('Schedule')) {
                    triggerType = 'schedule';
                    triggerInfo = triggerNode.name;
                }
                else if (triggerNode.type.includes('webhook') || triggerNode.type.includes('Webhook')) {
                    triggerType = 'webhook';
                    triggerInfo = triggerNode.name;
                }
                else if (triggerNode.type.includes('manual') || triggerNode.type.includes('Manual')) {
                    triggerType = 'manual';
                }
            }
            return {
                ...workflow,
                nodes: nodes.map(n => ({
                    id: n.id || n.name,
                    name: n.name,
                    type: n.type,
                    position: n.position,
                })),
                nodeCount,
                triggerType,
                triggerInfo,
                instance,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get workflow detail', { instance, id, error });
            throw error;
        }
    }
    /**
     * 获取指定工作流的执行记录
     */
    async getWorkflowExecutions(instance, workflowId, limit = 50) {
        try {
            const response = await this.fetchN8nInstance(instance, `/api/v1/executions?workflowId=${workflowId}&limit=${limit}`);
            const executions = response.data || [];
            const successCount = executions.filter(e => e.status === 'success').length;
            const errorCount = executions.filter(e => e.status === 'error' || e.status === 'crashed').length;
            const runningCount = executions.filter(e => e.status === 'running' || e.status === 'waiting').length;
            const total = executions.length;
            return {
                total,
                success: successCount,
                error: errorCount,
                running: runningCount,
                successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
                executions,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get workflow executions', { instance, workflowId, error });
            throw error;
        }
    }
}
exports.n8nWorkflowsService = new N8nWorkflowsService();
//# sourceMappingURL=n8n-workflows.service.js.map