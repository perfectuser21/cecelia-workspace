/**
 * Intent Recognition Types
 */

export type IntentType = 'create_task' | 'query_status' | 'update_progress';

export interface IntentEntity {
  type: string;
  value: string;
  /** Confidence score in range [0, 1] */
  confidence: number;
}

export interface IntentResult {
  intent_type: IntentType;
  confidence: number;
  entities: IntentEntity[];
  suggested_action: {
    type: string;
    parameters: Record<string, unknown>;
  };
}

export interface ParseRequest {
  text: string;
}

export interface ParseResponse {
  success: boolean;
  data?: IntentResult;
  error?: string;
}
