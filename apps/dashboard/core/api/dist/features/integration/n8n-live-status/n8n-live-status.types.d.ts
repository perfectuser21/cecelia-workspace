export type N8nInstance = 'cloud' | 'local';
export interface N8nExecutionNode {
    name: string;
    type: string;
    duration?: number;
    startTime?: string;
    endTime?: string;
    status?: 'success' | 'error' | 'running' | 'waiting';
}
export interface N8nExecutionDetail {
    id: string;
    workflowId: string;
    workflowName?: string;
    status: 'success' | 'error' | 'waiting' | 'running' | 'crashed';
    mode: string;
    startedAt: string;
    stoppedAt?: string;
    finished: boolean;
    duration?: number;
    nodes?: N8nExecutionNode[];
    errorMessage?: string;
}
export interface RunningExecution {
    id: string;
    workflowId: string;
    workflowName: string;
    startedAt: string;
    duration: number;
    currentNode?: string;
}
export interface TodayStats {
    running: number;
    success: number;
    error: number;
    total: number;
    successRate: number;
}
export interface LiveStatusOverview {
    todayStats: TodayStats;
    runningExecutions: RunningExecution[];
    recentCompleted: N8nExecutionDetail[];
    timestamp: number;
}
//# sourceMappingURL=n8n-live-status.types.d.ts.map