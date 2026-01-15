"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vpsMonitorRepository = void 0;
// VPS Monitor repository for database operations
const connection_1 = __importDefault(require("../../shared/db/connection"));
const logger_1 = __importDefault(require("../../shared/utils/logger"));
class VPSMonitorRepository {
    /**
     * Save metrics to database
     */
    async saveMetric(data) {
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
            await connection_1.default.query(query, [
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
            logger_1.default.debug('VPS metrics saved to database');
        }
        catch (error) {
            logger_1.default.error('Failed to save VPS metrics', { error });
            throw error;
        }
    }
    /**
     * Get metrics history for the last N hours
     */
    async getHistory(hours) {
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
            const result = await connection_1.default.query(query);
            return result.rows;
        }
        catch (error) {
            logger_1.default.error('Failed to get VPS metrics history', { error });
            throw error;
        }
    }
    /**
     * Delete old metrics (keep only last 7 days)
     */
    async cleanupOldMetrics() {
        try {
            const query = `
        DELETE FROM vps_metrics
        WHERE created_at < NOW() - INTERVAL '7 days'
      `;
            const result = await connection_1.default.query(query);
            const deletedCount = result.rowCount || 0;
            if (deletedCount > 0) {
                logger_1.default.info(`Cleaned up ${deletedCount} old VPS metrics`);
            }
            return deletedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup old VPS metrics', { error });
            throw error;
        }
    }
}
exports.vpsMonitorRepository = new VPSMonitorRepository();
//# sourceMappingURL=vps-monitor.repository.js.map