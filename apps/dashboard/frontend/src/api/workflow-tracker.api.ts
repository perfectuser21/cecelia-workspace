import { apiClient } from './client';

export type Phase = 'PREPARE' | 'VALIDATE' | 'EXECUTE' | 'VERIFY' | 'FINALIZE';
export type RunStatus = 'running' | 'success' | 'fail' | 'stuck';

export interface WorkflowRun {
  id: number;
  run_id: string;
  bundle: string;
  workflow: string | null;
  current_phase: Phase;
  current_substep: string | null;
  status: RunStatus;
  started_at: string;
  ended_at: string | null;
  total_duration_ms: number | null;
  prd_summary: string | null;
  state_dir: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEvent {
  id: number;
  run_id: string;
  phase: Phase;
  substep: string;
  status: string;
  message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SubstepProgress {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'fail' | 'stuck';
  duration_ms: number | null;
  started_at: string | null;
  message: string | null;
}

export interface PhaseProgress {
  phase: Phase;
  status: 'pending' | 'running' | 'success' | 'fail';
  substeps: SubstepProgress[];
}

export interface RunWithProgress extends WorkflowRun {
  phases: PhaseProgress[];
  events_count: number;
  last_event: WorkflowEvent | null;
}

export interface RunListResponse {
  runs: WorkflowRun[];
  running_count: number;
  total_count: number;
}

export interface EventListResponse {
  events: WorkflowEvent[];
}

// V2: 事件流类型
export type StreamEventType = 'info' | 'ai' | 'action' | 'success' | 'error';

export interface StreamEvent {
  id: number;
  time: string;
  icon: string;
  title: string;
  content: string;
  type: StreamEventType;
  expandable: boolean;
  details?: Record<string, any>;
}

export interface EventStreamResponse {
  run: WorkflowRun;
  events: StreamEvent[];
}

const BASE_PATH = '/v1/workflow-tracker';

export const workflowTrackerApi = {
  getRuns: async (params?: {
    status?: string;
    bundle?: string;
    limit?: number;
    offset?: number;
  }): Promise<RunListResponse> => {
    const { data } = await apiClient.get<RunListResponse>(`${BASE_PATH}/runs`, {
      params,
    });
    return data;
  },

  getRunDetail: async (runId: string): Promise<RunWithProgress> => {
    const { data } = await apiClient.get<RunWithProgress>(
      `${BASE_PATH}/runs/${runId}`
    );
    return data;
  },

  getEvents: async (
    runId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<EventListResponse> => {
    const { data } = await apiClient.get<EventListResponse>(
      `${BASE_PATH}/runs/${runId}/events`,
      { params }
    );
    return data;
  },

  deleteRun: async (runId: string): Promise<void> => {
    await apiClient.delete(`${BASE_PATH}/runs/${runId}`);
  },

  // V2: 获取格式化的事件流
  getEventStream: async (runId: string): Promise<EventStreamResponse> => {
    const { data } = await apiClient.get<EventStreamResponse>(
      `${BASE_PATH}/runs/${runId}/stream`
    );
    return data;
  },
};
