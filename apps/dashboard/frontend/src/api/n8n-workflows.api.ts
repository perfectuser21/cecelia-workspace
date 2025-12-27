// N8n Workflows API client

const API_BASE = import.meta.env.VITE_API_URL || '';

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
  runningCount: number;
  lastExecution?: {
    id: string;
    status: N8nExecution['status'];
    startedAt: string;
    stoppedAt?: string;
  };
  recentStats: {
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

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export const n8nWorkflowsApi = {
  getOverview: (): Promise<N8nOverview> => {
    return fetchApi('/api/v1/n8n-workflows/overview');
  },

  getWorkflows: (): Promise<WorkflowStats> => {
    return fetchApi('/api/v1/n8n-workflows/workflows');
  },

  getWorkflow: (id: string): Promise<N8nWorkflow> => {
    return fetchApi(`/api/v1/n8n-workflows/workflows/${id}`);
  },

  getExecutions: (params?: {
    status?: string;
    limit?: number;
    workflowId?: string;
  }): Promise<ExecutionStats> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.workflowId) queryParams.append('workflowId', params.workflowId);

    const queryString = queryParams.toString();
    const endpoint = `/api/v1/n8n-workflows/executions${queryString ? `?${queryString}` : ''}`;
    return fetchApi(endpoint);
  },
};
