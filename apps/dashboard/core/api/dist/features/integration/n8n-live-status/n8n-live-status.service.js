"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.n8nLiveStatusService = void 0;
// N8n Live Status service
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const instances = {
    local: {
        baseUrl: process.env.N8N_LOCAL_URL || 'http://localhost:5679',
        apiKey: process.env.N8N_LOCAL_API_KEY || '',
        name: 'Self-hosted',
    },
    cloud: {
        baseUrl: process.env.N8N_CLOUD_URL || '',
        apiKey: process.env.N8N_CLOUD_API_KEY || '',
        name: 'Cloud',
    },
};
class N8nLiveStatusService {
    /**
     * Check if instance is available
     */
    isInstanceAvailable(instance) {
        return !!instances[instance]?.apiKey;
    }
    /**
     * Get instance config
     */
    getInstanceConfig(instance) {
        const config = instances[instance];
        if (!config) {
            throw new Error(`Unknown instance: ${instance}`);
        }
        return config;
    }
    /**
     * Generic fetch method for n8n API
     */
    async fetchN8n(instance, endpoint) {
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
    /**
     * Calculate duration in seconds
     */
    calculateDuration(startedAt, stoppedAt) {
        const start = new Date(startedAt).getTime();
        const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
        return Math.round((end - start) / 1000);
    }
    /**
     * Get today's start timestamp
     */
    getTodayStart() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }
    /**
     * Parse execution nodes from execution data
     */
    parseExecutionNodes(execution) {
        const nodes = [];
        const runData = execution.data?.resultData?.runData;
        if (runData) {
            Object.entries(runData).forEach(([nodeName, nodeRuns]) => {
                if (nodeRuns && nodeRuns.length > 0) {
                    const run = nodeRuns[0];
                    nodes.push({
                        name: nodeName,
                        type: 'unknown',
                        duration: run.executionTime ? Math.round(run.executionTime) : undefined,
                        startTime: run.startTime ? new Date(run.startTime).toISOString() : undefined,
                        status: run.error ? 'error' : 'success',
                    });
                }
            });
        }
        return nodes;
    }
    /**
     * Get live status overview
     */
    async getLiveStatusOverview(instance) {
        try {
            const todayStart = this.getTodayStart().toISOString();
            // Fetch executions and workflows in parallel
            const [allExecutionsResponse, workflowsResponse] = await Promise.all([
                this.fetchN8n(instance, '/api/v1/executions?limit=200'),
                this.fetchN8n(instance, '/api/v1/workflows'),
            ]);
            const allExecutions = allExecutionsResponse.data || [];
            const workflows = workflowsResponse.data || [];
            // Create workflow map
            const workflowMap = new Map(workflows.map(w => [w.id, w.name]));
            // Filter today's executions
            const todayExecutions = allExecutions.filter(e => new Date(e.startedAt) >= new Date(todayStart));
            // Calculate today's stats
            const runningCount = todayExecutions.filter(e => e.status === 'running' || e.status === 'waiting').length;
            const successCount = todayExecutions.filter(e => e.status === 'success').length;
            const errorCount = todayExecutions.filter(e => e.status === 'error' || e.status === 'crashed').length;
            const totalCount = todayExecutions.length;
            const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
            const todayStats = {
                running: runningCount,
                success: successCount,
                error: errorCount,
                total: totalCount,
                successRate,
            };
            // Get running executions
            const runningExecutions = allExecutions
                .filter(e => e.status === 'running' || e.status === 'waiting')
                .map(e => ({
                id: e.id,
                workflowId: e.workflowId,
                workflowName: workflowMap.get(e.workflowId) || e.workflowData?.name || e.workflowId,
                startedAt: e.startedAt,
                duration: this.calculateDuration(e.startedAt),
                currentNode: undefined, // TODO: Parse from execution data if available
            }));
            // Get recent completed executions (last 10)
            const recentCompleted = allExecutions
                .filter(e => e.finished && (e.status === 'success' || e.status === 'error' || e.status === 'crashed'))
                .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                .slice(0, 10)
                .map(e => ({
                id: e.id,
                workflowId: e.workflowId,
                workflowName: workflowMap.get(e.workflowId) || e.workflowData?.name || e.workflowId,
                status: e.status,
                mode: e.mode,
                startedAt: e.startedAt,
                stoppedAt: e.stoppedAt,
                finished: e.finished,
                duration: e.stoppedAt ? this.calculateDuration(e.startedAt, e.stoppedAt) : undefined,
                nodes: this.parseExecutionNodes(e),
            }));
            return {
                todayStats,
                runningExecutions,
                recentCompleted,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get live status overview', { instance, error });
            throw error;
        }
    }
    /**
     * Get execution detail by ID
     */
    async getExecutionDetail(instance, executionId) {
        try {
            const execution = await this.fetchN8n(instance, `/api/v1/executions/${executionId}`);
            // Get workflow name
            let workflowName = execution.workflowData?.name || execution.workflowId;
            try {
                const workflowsResponse = await this.fetchN8n(instance, '/api/v1/workflows');
                const workflow = workflowsResponse.data.find(w => w.id === execution.workflowId);
                if (workflow) {
                    workflowName = workflow.name;
                }
            }
            catch {
                // Ignore error, use existing name
            }
            const nodes = this.parseExecutionNodes(execution);
            // Extract error message if any
            let errorMessage;
            if (execution.status === 'error' || execution.status === 'crashed') {
                const runData = execution.data?.resultData?.runData;
                if (runData) {
                    for (const nodeRuns of Object.values(runData)) {
                        if (nodeRuns && nodeRuns.length > 0) {
                            const error = nodeRuns[0].error;
                            if (error?.message) {
                                errorMessage = error.message;
                                break;
                            }
                        }
                    }
                }
            }
            return {
                id: execution.id,
                workflowId: execution.workflowId,
                workflowName,
                status: execution.status,
                mode: execution.mode,
                startedAt: execution.startedAt,
                stoppedAt: execution.stoppedAt,
                finished: execution.finished,
                duration: execution.stoppedAt
                    ? this.calculateDuration(execution.startedAt, execution.stoppedAt)
                    : this.calculateDuration(execution.startedAt),
                nodes,
                errorMessage,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get execution detail', { instance, executionId, error });
            throw error;
        }
    }
}
exports.n8nLiveStatusService = new N8nLiveStatusService();
//# sourceMappingURL=n8n-live-status.service.js.map