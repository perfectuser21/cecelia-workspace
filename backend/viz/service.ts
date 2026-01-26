/**
 * Visualization Data Service
 * File-based storage for visualization data ingestion and querying
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  VizDataPoint,
  IngestRequest,
  QueryOptions,
  StorageStats,
  CleanupResult,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Event emitter for real-time updates
export const vizEvents = new EventEmitter();

// Data directory - relative to project root
const VIZ_DATA_DIR = join(__dirname, '../../data/viz');

// Ensure viz data directory exists
if (!fs.existsSync(VIZ_DATA_DIR)) {
  fs.mkdirSync(VIZ_DATA_DIR, { recursive: true });
}

/**
 * Get the monthly data file path for a given timestamp
 */
function getMonthlyFilePath(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return path.join(VIZ_DATA_DIR, `${year}-${month}.ndjson`);
}

/**
 * Parse time range string to milliseconds
 */
function parseTimeRange(range: string): number {
  const match = range.match(/^(\d+)([hdwm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    h: 60 * 60 * 1000,           // hours
    d: 24 * 60 * 60 * 1000,      // days
    w: 7 * 24 * 60 * 60 * 1000,  // weeks
    m: 30 * 24 * 60 * 60 * 1000, // months (approximate)
  };

  return value * multipliers[unit];
}

/**
 * Ingest a new data point
 */
export function ingestData(data: IngestRequest): VizDataPoint {
  const id = `${data.source}-${data.type}-${data.timestamp}`;
  const dataPoint: VizDataPoint = {
    id,
    source: data.source,
    type: data.type,
    timestamp: data.timestamp,
    payload: data.payload,
    createdAt: new Date().toISOString(),
  };

  // Append to monthly NDJSON file
  const filePath = getMonthlyFilePath(data.timestamp);
  const line = JSON.stringify(dataPoint) + '\n';

  fs.appendFileSync(filePath, line, 'utf-8');

  // Emit event for real-time updates
  vizEvents.emit('data', dataPoint);

  return dataPoint;
}

/**
 * Query data with filters
 */
export function queryData(options: QueryOptions = {}): VizDataPoint[] {
  const {
    source,
    type,
    range = '7d',
    limit = 1000,
  } = options;

  const rangeMs = parseTimeRange(range);
  const cutoffTime = Date.now() - rangeMs;

  // Determine which monthly files to read based on range
  const now = new Date();
  const cutoffDate = new Date(cutoffTime);
  const monthsToRead: string[] = [];

  // Calculate how many months to read (range / 30 days, minimum 2 months)
  const monthsToCheck = Math.max(2, Math.ceil(rangeMs / (30 * 24 * 60 * 60 * 1000)));

  for (let i = 0; i < monthsToCheck; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const filePath = path.join(VIZ_DATA_DIR, `${year}-${month}.ndjson`);
    if (fs.existsSync(filePath)) {
      monthsToRead.push(filePath);
    }

    // Stop if we've gone past the cutoff date
    if (date < cutoffDate) break;
  }

  // Read and filter data
  const results: VizDataPoint[] = [];

  for (const filePath of monthsToRead) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const dataPoint = JSON.parse(line) as VizDataPoint;

        // Apply filters
        if (dataPoint.timestamp < cutoffTime) continue;
        if (source && dataPoint.source !== source) continue;
        if (type && dataPoint.type !== type) continue;

        results.push(dataPoint);

        // Stop if limit reached
        if (results.length >= limit) break;
      } catch (err) {
        // Skip invalid lines
        console.error('Invalid JSON line:', line, err);
      }
    }

    if (results.length >= limit) break;
  }

  // Sort by timestamp descending (newest first)
  results.sort((a, b) => b.timestamp - a.timestamp);

  return results.slice(0, limit);
}

/**
 * Clean up old data (older than 7 days)
 * Call this periodically via cron or manually
 */
export function cleanupOldData(): CleanupResult {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cutoffYear = cutoffDate.getFullYear();
  const cutoffMonth = cutoffDate.getMonth() + 1;

  const files = fs.readdirSync(VIZ_DATA_DIR);
  const deletedFiles: string[] = [];
  const keptFiles: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.ndjson')) continue;

    const match = file.match(/^(\d{4})-(\d{2})\.ndjson$/);
    if (!match) continue;

    const fileYear = parseInt(match[1]);
    const fileMonth = parseInt(match[2]);

    // Delete if older than cutoff
    if (fileYear < cutoffYear || (fileYear === cutoffYear && fileMonth < cutoffMonth)) {
      const filePath = path.join(VIZ_DATA_DIR, file);
      fs.unlinkSync(filePath);
      deletedFiles.push(file);
    } else {
      keptFiles.push(file);
    }
  }

  return { deletedFiles, keptFiles };
}

/**
 * Get storage statistics
 */
export function getStorageStats(): StorageStats {
  const files = fs.readdirSync(VIZ_DATA_DIR).filter(f => f.endsWith('.ndjson'));

  let totalSize = 0;
  const fileStats = files.map(file => {
    const filePath = path.join(VIZ_DATA_DIR, file);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim()).length;

    totalSize += stats.size;

    return {
      name: file,
      size: stats.size,
      lines,
    };
  });

  return {
    totalFiles: files.length,
    totalSize,
    files: fileStats,
  };
}
