/**
 * Type definitions for Visualization Data API
 */

/**
 * A single data point in the visualization system
 */
export interface VizDataPoint {
  /** Unique identifier for this data point */
  id: string;
  /** Data source identifier (e.g., 'engine', 'n8n', 'custom') */
  source: string;
  /** Data type identifier (e.g., 'gate_status', 'task_update', 'metrics') */
  type: string;
  /** Unix timestamp in milliseconds when the event occurred */
  timestamp: number;
  /** Arbitrary payload data */
  payload: Record<string, any>;
  /** ISO timestamp when this record was created */
  createdAt: string;
}

/**
 * Request body for data ingestion
 */
export interface IngestRequest {
  source: string;
  type: string;
  timestamp: number;
  payload: Record<string, any>;
}

/**
 * Query options for data retrieval
 */
export interface QueryOptions {
  /** Filter by data source */
  source?: string;
  /** Filter by data type */
  type?: string;
  /** Time range (e.g., '7d', '24h', '30d') */
  range?: string;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Storage statistics response
 */
export interface StorageStats {
  /** Total number of data files */
  totalFiles: number;
  /** Total storage size in bytes */
  totalSize: number;
  /** Per-file statistics */
  files: Array<{
    name: string;
    size: number;
    lines: number;
  }>;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  /** Files that were deleted */
  deletedFiles: string[];
  /** Files that were kept */
  keptFiles: string[];
}
