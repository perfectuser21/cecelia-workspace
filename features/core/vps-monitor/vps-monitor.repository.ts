// VPS Monitor repository for database operations
import db from '../../../shared/db/connection';
import logger from '../../../shared/utils/logger';

export interface VPSMetricRow {
  id: number;
  cpu_usage: number;
  memory_usage_percent: number;
  memory_used: number;
  disk_usage_percent: number;
  load_1min: number;
  load_5min: number;
  load_15min: number;
  network_rx: number;
  network_tx: number;
  created_at: Date;
}

export interface MetricData {
  cpuUsage: number;
  memoryUsagePercent: number;
  memoryUsed: number;
  diskUsagePercent: number;
  load1min: number;
  load5min: number;
  load15min: number;
  networkRx: number;
  networkTx: number;
}

class VPSMonitorRepository {
  /**
   * Save metrics to database
   */
  async saveMetric(data: MetricData): Promise<void> {
    try {
      const query = `
        INSERT INTO vps_metrics (
          cpu_usage,
          memory_usage_percent,
          memory_used,
          disk_usage_percent,
          load_1min,
          load_5min,
          load_15min,
          network_rx,
          network_tx
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await db.query(query, [
        data.cpuUsage,
        data.memoryUsagePercent,
        data.memoryUsed,
        data.diskUsagePercent,
        data.load1min,
        data.load5min,
        data.load15min,
        data.networkRx,
        data.networkTx,
      ]);

      logger.debug('VPS metrics saved to database');
    } catch (error) {
      logger.error('Failed to save VPS metrics', { error });
      throw error;
    }
  }

  /**
   * Get metrics history for the last N hours
   */
  async getHistory(hours: number): Promise<VPSMetricRow[]> {
    try {
      const query = `
        SELECT
          id,
          cpu_usage,
          memory_usage_percent,
          memory_used,
          disk_usage_percent,
          load_1min,
          load_5min,
          load_15min,
          network_rx,
          network_tx,
          created_at
        FROM vps_metrics
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY created_at ASC
      `;

      const result = await db.query<VPSMetricRow>(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get VPS metrics history', { error });
      throw error;
    }
  }

  /**
   * Delete old metrics (keep only last 7 days)
   */
  async cleanupOldMetrics(): Promise<number> {
    try {
      const query = `
        DELETE FROM vps_metrics
        WHERE created_at < NOW() - INTERVAL '7 days'
      `;

      const result = await db.query(query);
      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old VPS metrics`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old VPS metrics', { error });
      throw error;
    }
  }
}

export const vpsMonitorRepository = new VPSMonitorRepository();
