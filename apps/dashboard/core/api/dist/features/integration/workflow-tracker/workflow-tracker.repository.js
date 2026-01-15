"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowTrackerRepository = void 0;
// Workflow Tracker repository for database operations
const connection_1 = require("../../../shared/db/connection");
class WorkflowTrackerRepository {
    // ===== Run Operations =====
    async createRun(data) {
        const result = await connection_1.db.query(`INSERT INTO workflow_runs (
        run_id, bundle, workflow, prd_summary, state_dir, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`, [
            data.run_id,
            data.bundle,
            data.workflow || null,
            data.prd_summary || null,
            data.state_dir || null,
            data.metadata || null,
        ]);
        return result.rows[0];
    }
    async findRunById(runId) {
        const result = await connection_1.db.query('SELECT * FROM workflow_runs WHERE run_id = $1', [runId]);
        return result.rows[0] || null;
    }
    async findAllRuns(options) {
        const { status, bundle, limit = 50, offset = 0 } = options;
        const params = [];
        const conditions = [];
        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (bundle) {
            params.push(bundle);
            conditions.push(`bundle = $${params.length}`);
        }
        let query = 'SELECT * FROM workflow_runs';
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await connection_1.db.query(query, params);
        return result.rows;
    }
    async updateRun(runId, data) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (data.current_phase !== undefined) {
            fields.push(`current_phase = $${paramIndex++}`);
            values.push(data.current_phase);
        }
        if (data.current_substep !== undefined) {
            fields.push(`current_substep = $${paramIndex++}`);
            values.push(data.current_substep);
        }
        if (data.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.ended_at !== undefined) {
            fields.push(`ended_at = $${paramIndex++}`);
            values.push(data.ended_at);
        }
        if (data.total_duration_ms !== undefined) {
            fields.push(`total_duration_ms = $${paramIndex++}`);
            values.push(data.total_duration_ms);
        }
        if (data.metadata !== undefined) {
            fields.push(`metadata = $${paramIndex++}`);
            values.push(data.metadata);
        }
        if (fields.length === 0) {
            return this.findRunById(runId);
        }
        fields.push(`updated_at = NOW()`);
        values.push(runId);
        const query = `UPDATE workflow_runs SET ${fields.join(', ')} WHERE run_id = $${paramIndex} RETURNING *`;
        const result = await connection_1.db.query(query, values);
        return result.rows[0] || null;
    }
    async deleteRun(runId) {
        const result = await connection_1.db.query('DELETE FROM workflow_runs WHERE run_id = $1', [runId]);
        return (result.rowCount || 0) > 0;
    }
    async countRunning() {
        const result = await connection_1.db.query("SELECT COUNT(*) as count FROM workflow_runs WHERE status = 'running'");
        return parseInt(result.rows[0].count, 10);
    }
    async countTotal() {
        const result = await connection_1.db.query('SELECT COUNT(*) as count FROM workflow_runs');
        return parseInt(result.rows[0].count, 10);
    }
    // ===== Event Operations =====
    async createEvent(runId, data) {
        const result = await connection_1.db.query(`INSERT INTO workflow_events (
        run_id, phase, substep, status, message, duration_ms,
        event_type, description, details
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`, [
            runId,
            data.phase,
            data.substep,
            data.status,
            data.message || null,
            data.duration_ms || null,
            data.event_type || null,
            data.description || null,
            data.details ? JSON.stringify(data.details) : null,
        ]);
        return result.rows[0];
    }
    async findEventsByRunId(runId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const result = await connection_1.db.query(`SELECT * FROM workflow_events
       WHERE run_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`, [runId, limit, offset]);
        return result.rows;
    }
    async findLastEvent(runId) {
        const result = await connection_1.db.query('SELECT * FROM workflow_events WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1', [runId]);
        return result.rows[0] || null;
    }
    async countEvents(runId) {
        const result = await connection_1.db.query('SELECT COUNT(*) as count FROM workflow_events WHERE run_id = $1', [runId]);
        return parseInt(result.rows[0].count, 10);
    }
    // ===== Stuck Detection =====
    async findStuckStartEvents(thresholdMs = 300000) {
        const result = await connection_1.db.query(`SELECT e.* FROM workflow_events e
       JOIN workflow_runs r ON e.run_id = r.run_id
       WHERE e.status = 'start'
         AND r.status = 'running'
         AND e.created_at < NOW() - INTERVAL '${thresholdMs} milliseconds'
         AND NOT EXISTS (
           SELECT 1 FROM workflow_events e2
           WHERE e2.run_id = e.run_id
             AND e2.phase = e.phase
             AND e2.substep = e.substep
             AND e2.status IN ('success', 'fail', 'stuck')
             AND e2.created_at > e.created_at
         )`);
        return result.rows;
    }
    async markSubstepStuck(runId, phase, substep) {
        await connection_1.db.query(`INSERT INTO workflow_events (run_id, phase, substep, status, message)
       VALUES ($1, $2, $3, 'stuck', '超时 (>300s)')`, [runId, phase, substep]);
        await connection_1.db.query(`UPDATE workflow_runs SET status = 'stuck', updated_at = NOW() WHERE run_id = $1`, [runId]);
    }
}
exports.workflowTrackerRepository = new WorkflowTrackerRepository();
//# sourceMappingURL=workflow-tracker.repository.js.map