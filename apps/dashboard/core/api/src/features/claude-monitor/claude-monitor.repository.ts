// Claude Monitor repository for database operations
import { db } from '../../shared/db/connection';
import {
  ClaudeRun,
  ClaudeEvent,
  CreateRunDTO,
  UpdateRunDTO,
  CreateEventDTO,
} from './claude-monitor.types';

class ClaudeMonitorRepository {
  // ===== Run Operations =====

  async createRun(data: CreateRunDTO): Promise<ClaudeRun> {
    const id = this.generateUUID();
    const now = Date.now();

    const result = await db.query<ClaudeRun>(
      `INSERT INTO claude_runs (
        id, session_id, source, status, title, cwd, started_at,
        parent_run_id, agent_type, metadata
      )
      VALUES ($1, $2, $3, 'running', $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        data.session_id,
        data.source || 'manual',
        data.title || null,
        data.cwd,
        now,
        data.parent_run_id || null,
        data.agent_type || 'main',
        data.metadata || null, // PostgreSQL JSONB handles objects directly
      ]
    );

    return result.rows[0];
  }

  async findRunById(id: string): Promise<ClaudeRun | null> {
    const result = await db.query<ClaudeRun>(
      'SELECT * FROM claude_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findRunBySessionId(sessionId: string): Promise<ClaudeRun | null> {
    const result = await db.query<ClaudeRun>(
      `SELECT * FROM claude_runs
       WHERE session_id = $1 AND parent_run_id IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  async findAllRuns(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ClaudeRun[]> {
    const { status, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM claude_runs WHERE parent_run_id IS NULL';
    const params: any[] = [];

    if (status) {
      query += ' AND status = $1';
      params.push(status);
    }

    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query<ClaudeRun>(query, params);
    return result.rows;
  }

  async findChildRuns(parentId: string): Promise<ClaudeRun[]> {
    const result = await db.query<ClaudeRun>(
      'SELECT * FROM claude_runs WHERE parent_run_id = $1 ORDER BY started_at ASC',
      [parentId]
    );
    return result.rows;
  }

  async updateRun(id: string, data: UpdateRunDTO): Promise<ClaudeRun | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.ended_at !== undefined) {
      fields.push(`ended_at = $${paramIndex++}`);
      values.push(data.ended_at);
    }
    if (data.token_input !== undefined) {
      fields.push(`token_input = $${paramIndex++}`);
      values.push(data.token_input);
    }
    if (data.token_output !== undefined) {
      fields.push(`token_output = $${paramIndex++}`);
      values.push(data.token_output);
    }
    if (data.add_token_input !== undefined) {
      fields.push(`token_input = token_input + $${paramIndex++}`);
      values.push(data.add_token_input);
    }
    if (data.add_token_output !== undefined) {
      fields.push(`token_output = token_output + $${paramIndex++}`);
      values.push(data.add_token_output);
    }
    if (data.model !== undefined) {
      fields.push(`model = $${paramIndex++}`);
      values.push(data.model);
    }
    if (data.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(data.metadata); // PostgreSQL JSONB handles objects directly
    }

    if (fields.length === 0) {
      return this.findRunById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE claude_runs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query<ClaudeRun>(query, values);
    return result.rows[0] || null;
  }

  async deleteRun(id: string): Promise<boolean> {
    // Delete events first
    await db.query('DELETE FROM claude_events WHERE run_id = $1', [id]);

    // Delete child runs recursively
    const children = await this.findChildRuns(id);
    for (const child of children) {
      await this.deleteRun(child.id);
    }

    // Delete the run itself
    const result = await db.query('DELETE FROM claude_runs WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async countRunning(): Promise<number> {
    const result = await db.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM claude_runs WHERE status = 'running' AND parent_run_id IS NULL"
    );
    return parseInt(result.rows[0].count, 10);
  }

  async countTotal(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM claude_runs WHERE parent_run_id IS NULL'
    );
    return parseInt(result.rows[0].count, 10);
  }

  async findRunningRuns(): Promise<ClaudeRun[]> {
    const result = await db.query<ClaudeRun>(
      "SELECT * FROM claude_runs WHERE status = 'running'"
    );
    return result.rows;
  }

  // ===== Event Operations =====

  async createEvent(runId: string, data: CreateEventDTO): Promise<ClaudeEvent> {
    const now = Date.now();

    const result = await db.query<ClaudeEvent>(
      `INSERT INTO claude_events (run_id, type, tool_name, payload, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        runId,
        data.type,
        data.tool_name || null,
        data.payload || null, // PostgreSQL JSONB handles objects directly
        now,
      ]
    );

    return result.rows[0];
  }

  async findEventById(id: number): Promise<ClaudeEvent | null> {
    const result = await db.query<ClaudeEvent>(
      'SELECT * FROM claude_events WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findEventsByRunId(
    runId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ClaudeEvent[]> {
    const { limit = 100, offset = 0 } = options;

    const result = await db.query<ClaudeEvent>(
      `SELECT * FROM claude_events
       WHERE run_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [runId, limit, offset]
    );

    return result.rows;
  }

  async findRecentEvents(runId: string, since: number): Promise<ClaudeEvent[]> {
    const result = await db.query<ClaudeEvent>(
      `SELECT * FROM claude_events
       WHERE run_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [runId, since]
    );

    return result.rows;
  }

  async findLastEvent(runId: string): Promise<ClaudeEvent | null> {
    const result = await db.query<ClaudeEvent>(
      'SELECT * FROM claude_events WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
      [runId]
    );
    return result.rows[0] || null;
  }

  async countEvents(runId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM claude_events WHERE run_id = $1',
      [runId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getToolCallStats(runId: string): Promise<Record<string, number>> {
    const result = await db.query<{ tool_name: string; count: string }>(
      `SELECT tool_name, COUNT(*) as count
       FROM claude_events
       WHERE run_id = $1 AND tool_name IS NOT NULL
       GROUP BY tool_name`,
      [runId]
    );

    const stats: Record<string, number> = {};
    result.rows.forEach(row => {
      stats[row.tool_name] = parseInt(row.count, 10);
    });
    return stats;
  }

  // ===== Helper Methods =====

  private generateUUID(): string {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const claudeMonitorRepository = new ClaudeMonitorRepository();
