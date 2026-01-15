"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsRepository = void 0;
// Log repository for database operations
const connection_1 = require("../../../shared/db/connection");
class LogRepository {
    async create(data) {
        const result = await connection_1.db.query(`INSERT INTO logs (
        user_id, action, resource_type, resource_id,
        details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`, [
            data.user_id || null,
            data.action,
            data.resource_type || null,
            data.resource_id || null,
            data.details ? JSON.stringify(data.details) : null,
            data.ip_address || null,
            data.user_agent || null,
        ]);
        return result.rows[0];
    }
    async findRecent(limit = 100) {
        const result = await connection_1.db.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT $1', [limit]);
        return result.rows;
    }
    async findByAction(action, limit = 100) {
        const result = await connection_1.db.query('SELECT * FROM logs WHERE action = $1 ORDER BY created_at DESC LIMIT $2', [action, limit]);
        return result.rows;
    }
    async findByResource(resourceType, resourceId, limit = 100) {
        const result = await connection_1.db.query(`SELECT * FROM logs
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT $3`, [resourceType, resourceId, limit]);
        return result.rows;
    }
    async findByDateRange(startDate, endDate, limit = 1000) {
        const result = await connection_1.db.query(`SELECT * FROM logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at DESC
       LIMIT $3`, [startDate, endDate, limit]);
        return result.rows;
    }
    async deleteOldLogs(daysToKeep = 90) {
        const result = await connection_1.db.query(`DELETE FROM logs
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'`);
        return result.rowCount || 0;
    }
}
exports.logsRepository = new LogRepository();
//# sourceMappingURL=logs.repository.js.map