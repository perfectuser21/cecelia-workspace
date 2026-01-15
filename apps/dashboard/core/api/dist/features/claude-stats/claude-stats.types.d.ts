export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
}
export interface ModelUsage extends TokenUsage {
    model: string;
    cost: number;
}
export interface DailyStats {
    date: string;
    total_cost: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_read_tokens: number;
    total_cache_creation_tokens: number;
    sessions: number;
    by_model: ModelUsage[];
}
export interface SessionStats {
    session_id: string;
    cwd: string;
    started_at: string;
    ended_at: string | null;
    model: string;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    messages: number;
}
export interface StatsOverview {
    total_cost: number;
    total_sessions: number;
    total_messages: number;
    total_input_tokens: number;
    total_output_tokens: number;
    average_cost_per_session: number;
    by_model: ModelUsage[];
}
export interface StatsResponse {
    overview: StatsOverview;
    daily: DailyStats[];
    recent_sessions: SessionStats[];
}
export declare const MODEL_PRICING: Record<string, {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
}>;
export declare const DEFAULT_PRICING: {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
};
//# sourceMappingURL=claude-stats.types.d.ts.map