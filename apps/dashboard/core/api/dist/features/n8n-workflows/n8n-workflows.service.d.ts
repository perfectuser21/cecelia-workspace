import { N8nWorkflow, WorkflowStats, ExecutionStats, N8nOverview, N8nWorkflowDetail, N8nInstance } from './n8n-workflows.types';
declare class N8nWorkflowsService {
    /**
     * 检查实例是否可用（已配置 API Key）
     */
    isInstanceAvailable(instance: N8nInstance): boolean;
    /**
     * 获取实例配置
     */
    private getInstanceConfig;
    /**
     * 通用 fetch 方法（支持多实例）
     */
    private fetchN8nInstance;
    private fetchN8n;
    /**
     * Calculate run stats for a single workflow
     */
    private calculateWorkflowRunStats;
    /**
     * Get all workflows with run statistics
     */
    getWorkflows(): Promise<WorkflowStats>;
    /**
     * Get single workflow details
     */
    getWorkflow(id: string): Promise<N8nWorkflow>;
    /**
     * Get executions with optional filters
     */
    getExecutions(params?: {
        status?: string;
        limit?: number;
        workflowId?: string;
    }): Promise<ExecutionStats>;
    /**
     * Get overview with workflows and recent executions
     */
    getOverview(): Promise<N8nOverview>;
    /**
     * 获取指定实例的工作流列表（带统计）
     */
    getWorkflowsByInstance(instance: N8nInstance): Promise<WorkflowStats>;
    /**
     * 获取指定实例的概览
     */
    getOverviewByInstance(instance: N8nInstance): Promise<N8nOverview>;
    /**
     * 获取单个工作流详情
     */
    getWorkflowDetail(instance: N8nInstance, id: string): Promise<N8nWorkflowDetail>;
    /**
     * 获取指定工作流的执行记录
     */
    getWorkflowExecutions(instance: N8nInstance, workflowId: string, limit?: number): Promise<ExecutionStats>;
}
export declare const n8nWorkflowsService: N8nWorkflowsService;
export {};
//# sourceMappingURL=n8n-workflows.service.d.ts.map