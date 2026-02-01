/**
 * Intent Recognition Types
 * Type definitions for natural language intent recognition system
 */

/**
 * Intent types that can be recognized
 */
export type IntentType =
  | 'CREATE_GOAL'
  | 'CREATE_PROJECT'
  | 'CREATE_TASK'
  | 'QUERY_TASKS'
  | 'UPDATE_TASK'
  | 'UNKNOWN';

/**
 * Priority levels
 */
export type Priority = 'P0' | 'P1' | 'P2';

/**
 * Task status values
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Extracted entities from natural language input
 */
export interface ExtractedEntities {
  /** Title/name extracted from input */
  title?: string;
  /** Priority level (P0/P1/P2) */
  priority?: Priority;
  /** Associated project/goal ID or name */
  relatedTo?: string;
  /** Task status (for updates) */
  status?: TaskStatus;
  /** Time range/deadline (if mentioned) */
  timeRange?: string;
  /** Type of entity (goal/project/task) */
  type?: 'goal' | 'project' | 'task';
}

/**
 * Intent recognition result
 */
export interface IntentRecognitionResult {
  /** Recognized intent type */
  intent: IntentType;
  /** Extracted entities */
  entities: ExtractedEntities;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether user confirmation is needed */
  needsConfirmation: boolean;
  /** Human-readable explanation of what was understood */
  understanding: string;
}

/**
 * Intent recognition request payload
 */
export interface IntentRecognitionRequest {
  /** Natural language input from user */
  input: string;
  /** Optional context (current project, etc.) */
  context?: {
    currentProject?: string;
    currentGoal?: string;
  };
}

/**
 * Intent recognition response
 */
export interface IntentRecognitionResponse {
  success: boolean;
  data?: IntentRecognitionResult;
  error?: string;
}
