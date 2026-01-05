// Workflow Tracker types

export type Phase = 'PREPARE' | 'VALIDATE' | 'EXECUTE' | 'VERIFY' | 'FINALIZE';
export type RunStatus = 'running' | 'success' | 'fail' | 'stuck';
export type EventStatus = 'start' | 'success' | 'fail' | 'stuck';

// V2: 事件类型
export type EventType =
  | 'prd_read'        // 读取 PRD
  | 'ai_understand'   // AI 理解/任务拆分
  | 'task_start'      // 任务开始
  | 'task_complete'   // 任务完成
  | 'file_write'      // 文件写入
  | 'claude_call'     // Claude API 调用
  | 'qc_result'       // 质检结果
  | 'decision'        // 决策点
  | 'error'           // 错误
  | 'info';           // 一般信息

export interface WorkflowRun {
  id: number;
  run_id: string;
  bundle: string;
  workflow: string | null;
  current_phase: Phase;
  current_substep: string | null;
  status: RunStatus;
  started_at: Date;
  ended_at: Date | null;
  total_duration_ms: number | null;
  prd_summary: string | null;
  state_dir: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowEvent {
  id: number;
  run_id: string;
  phase: Phase;
  substep: string;
  status: EventStatus;
  message: string | null;
  duration_ms: number | null;
  // V2: 富事件字段
  event_type: EventType | null;
  description: string | null;
  details: Record<string, any> | null;
  created_at: Date;
}

export interface CreateRunDTO {
  run_id: string;
  bundle: string;
  workflow?: string;
  prd_summary?: string;
  state_dir?: string;
  metadata?: Record<string, any>;
}

export interface UpdateRunDTO {
  current_phase?: Phase;
  current_substep?: string;
  status?: RunStatus;
  ended_at?: Date;
  total_duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface EmitEventDTO {
  phase: Phase;
  substep: string;
  status: EventStatus;
  message?: string;
  duration_ms?: number;
  // V2: 富事件字段
  event_type?: EventType;
  description?: string;
  details?: Record<string, any>;
}

export interface SubstepProgress {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'fail' | 'stuck';
  duration_ms: number | null;
  started_at: Date | null;
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

export interface StepsDefinition {
  version: string;
  bundle: string;
  phases: Record<Phase, StepDef[]>;
  default_timeout_sec: number;
}

export interface StepDef {
  id: string;
  name: string;
  timeout_sec?: number;
  optional?: boolean;
}

// V2: 格式化的事件流（供前端直接渲染）
export type StreamEventType = 'info' | 'ai' | 'action' | 'success' | 'error';

export interface StreamEvent {
  id: number;
  time: string;           // "14:23:05"
  icon: string;           // emoji
  title: string;          // 标题
  content: string;        // 内容
  type: StreamEventType;  // 样式类型
  expandable: boolean;    // 是否可展开
  details?: Record<string, any>;  // 展开详情
}

export interface EventStreamResponse {
  run: WorkflowRun;
  events: StreamEvent[];
}
