// N8n Workflows service - proxies n8n REST API
import logger from '../../shared/utils/logger';
import {
  N8nWorkflow,
  N8nExecution,
  WorkflowsResponse,
  ExecutionsResponse,
  WorkflowStats,
  ExecutionStats,
  N8nOverview,
  N8nWorkflowWithStats,
  WorkflowRunStats,
} from './n8n-workflows.types';

const N8N_BASE_URL = 'https://zenithjoy21xx.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_REST_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2ZhNjM5MC1hNDBjLTQ2MDUtOTdlZC02Y2ExM2YwYjgwYTciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzY2Mjg2NzU5LCJleHAiOjE4MDE0MTEyMDB9.9691--OtQhS52TVvQ9fYCzkiicWT-j6TnlLO9B95VmE';

class N8nWorkflowsService {
  private async fetchN8n<T>(endpoint: string): Promise<T> {
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

      return response.json();
    } catch (error) {
      logger.error('Failed to fetch from n8n API', { endpoint, error });
      throw error;
    }
  }

  /**
   * Calculate run stats for a single workflow
   */
  private calculateWorkflowRunStats(
    workflowId: string,
    executions: N8nExecution[]
  ): WorkflowRunStats {
    // 过滤该工作流的执行记录
    const workflowExecutions = executions.filter(e => e.workflowId === workflowId);

    // 当前正在运行的数量
    const runningCount = workflowExecutions.filter(
      e => e.status === 'running' || e.status === 'waiting'
    ).length;

    // 最近一次执行
    const sortedExecutions = [...workflowExecutions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const lastExecution = sortedExecutions[0];

    // 近期统计（取最近 20 条已完成的）
    const completedExecutions = sortedExecutions
      .filter(e => e.finished)
      .slice(0, 20);

    const successCount = completedExecutions.filter(e => e.status === 'success').length;
    const errorCount = completedExecutions.filter(
      e => e.status === 'error' || e.status === 'crashed'
    ).length;
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
  async getWorkflows(): Promise<WorkflowStats> {
    try {
      // 并行获取工作流和执行记录
      const [workflowsResponse, executionsResponse] = await Promise.all([
        this.fetchN8n<WorkflowsResponse>('/api/v1/workflows'),
        this.fetchN8n<ExecutionsResponse>('/api/v1/executions?limit=200'),
      ]);

      const workflows = workflowsResponse.data || [];
      const executions = executionsResponse.data || [];

      // 为每个工作流计算运行统计
      const workflowsWithStats: N8nWorkflowWithStats[] = workflows.map(workflow => ({
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
    } catch (error) {
      logger.error('Failed to get workflows', { error });
      throw error;
    }
  }

  /**
   * Get single workflow details
   */
  async getWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.fetchN8n<{ data: N8nWorkflow }>(`/api/v1/workflows/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get workflow', { id, error });
      throw error;
    }
  }

  /**
   * Get executions with optional filters
   */
  async getExecutions(params?: {
    status?: string;
    limit?: number;
    workflowId?: string;
  }): Promise<ExecutionStats> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.workflowId) queryParams.append('workflowId', params.workflowId);

      const queryString = queryParams.toString();
      const endpoint = `/api/v1/executions${queryString ? `?${queryString}` : ''}`;

      const response = await this.fetchN8n<ExecutionsResponse>(endpoint);
      const executions = response.data || [];

      // Also fetch workflows to map names
      let workflowMap: Map<string, string> = new Map();
      try {
        const workflowsResponse = await this.fetchN8n<WorkflowsResponse>('/api/v1/workflows');
        workflowMap = new Map(
          (workflowsResponse.data || []).map(w => [w.id, w.name])
        );
      } catch {
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
    } catch (error) {
      logger.error('Failed to get executions', { params, error });
      throw error;
    }
  }

  /**
   * Get overview with workflows and recent executions
   */
  async getOverview(): Promise<N8nOverview> {
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
    } catch (error) {
      logger.error('Failed to get n8n overview', { error });
      throw error;
    }
  }
}

export const n8nWorkflowsService = new N8nWorkflowsService();
