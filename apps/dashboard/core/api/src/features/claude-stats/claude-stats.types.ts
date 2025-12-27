// Claude Stats types

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
  date: string; // YYYY-MM-DD
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

// Claude pricing (2025) - per million tokens
export const MODEL_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_creation: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cache_read: 1.5, cache_creation: 18.75 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4, cache_read: 0.08, cache_creation: 1 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25, cache_read: 0.03, cache_creation: 0.3 },
};

// Default pricing for unknown models (use Sonnet pricing)
export const DEFAULT_PRICING = { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 };
