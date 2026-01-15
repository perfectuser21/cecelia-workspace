export type RunStatus = 'running' | 'done' | 'error' | 'canceled';
export type RunSource = 'n8n' | 'manual' | 'api';
export type AgentType = 'main' | 'Explore' | 'Plan' | 'general-purpose' | string;
export type EventType = 'run.created' | 'run.started' | 'tool.started' | 'tool.finished' | 'subagent.spawned' | 'subagent.finished' | 'log' | 'run.failed' | 'run.completed' | 'user.message' | 'assistant.message' | 'step.started' | 'step.completed' | 'step.failed';
export type AIFactoryStep = 'PREPARE' | 'EXECUTE' | 'CLEANUP';
export interface StepPayload {
    workflow: string;
    step: AIFactoryStep;
    substep?: string;
    description: string;
    task_id: string;
}
export interface ClaudeRun {
    id: string;
    session_id: string;
    source: RunSource;
    status: RunStatus;
    title: string | null;
    cwd: string;
    started_at: number;
    ended_at: number | null;
    token_input: number;
    token_output: number;
    model: string | null;
    parent_run_id: string | null;
    agent_type: AgentType;
    metadata: Record<string, any> | null;
    created_at?: Date;
    updated_at?: Date;
}
export interface ClaudeRunWithChildren extends ClaudeRun {
    children: ClaudeRunWithChildren[];
    events_count: number;
    last_event: ClaudeEvent | null;
}
export interface ClaudeEvent {
    id: number;
    run_id: string;
    type: EventType;
    tool_name: string | null;
    payload: Record<string, any> | null;
    created_at: number;
}
export interface CreateRunDTO {
    session_id: string;
    source?: RunSource;
    cwd: string;
    title?: string;
    n8n_execution_id?: string;
    parent_run_id?: string;
    agent_type?: AgentType;
    metadata?: Record<string, any>;
}
export interface UpdateRunDTO {
    status?: RunStatus;
    title?: string;
    ended_at?: number;
    token_input?: number;
    token_output?: number;
    add_token_input?: number;
    add_token_output?: number;
    model?: string;
    metadata?: Record<string, any>;
}
export interface CreateEventDTO {
    type: EventType;
    tool_name?: string;
    payload?: Record<string, any>;
}
export interface RunStatistics {
    run_id: string;
    token_input: number;
    token_output: number;
    events_count: number;
    tool_calls: Record<string, number>;
}
export interface RunListResponse {
    runs: ClaudeRunWithChildren[];
    running_count: number;
    total_count: number;
}
export interface EventListResponse {
    events: ClaudeEvent[];
}
//# sourceMappingURL=claude-monitor.types.d.ts.map