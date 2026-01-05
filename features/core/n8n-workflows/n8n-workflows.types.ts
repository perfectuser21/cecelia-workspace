// N8n Workflows types

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string }>;
}

// 工作流运行统计
export interface WorkflowRunStats {
  runningCount: number;        // 当前正在运行的数量
  lastExecution?: {            // 最近一次执行
    id: string;
    status: N8nExecution['status'];
    startedAt: string;
    stoppedAt?: string;
  };
  recentStats: {               // 近期统计（最近 20 条）
    total: number;
    success: number;
    error: number;
    successRate: number;
  };
}

// 带运行统计的工作流
export interface N8nWorkflowWithStats extends N8nWorkflow {
  runStats: WorkflowRunStats;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'crashed';
  startedAt: string;
  stoppedAt?: string;
  mode: string;
  finished: boolean;
  workflowName?: string;
}

export interface WorkflowsResponse {
  data: N8nWorkflow[];
}

export interface ExecutionsResponse {
  data: N8nExecution[];
}

export interface WorkflowStats {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  workflows: N8nWorkflowWithStats[];
  timestamp: number;
}

export interface ExecutionStats {
  total: number;
  success: number;
  error: number;
  running: number;
  successRate: number;
  executions: N8nExecution[];
  timestamp: number;
}

export interface N8nOverview {
  workflows: WorkflowStats;
  recentExecutions: ExecutionStats;
  timestamp: number;
}

// 多实例支持
export type N8nInstance = 'cloud' | 'local';

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
}

export interface N8nWorkflowDetail extends N8nWorkflow {
  nodes: N8nNode[];
  nodeCount: number;
  triggerType?: 'schedule' | 'webhook' | 'manual' | 'other';
  triggerInfo?: string;
  description?: string;
  instance: N8nInstance;
}
