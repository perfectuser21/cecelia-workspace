"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishRepository = exports.PublishRepository = void 0;
// Publish task repository
const connection_1 = require("../../shared/db/connection");
const uuid_1 = require("uuid");
class PublishRepository {
    async createTask(data) {
        const id = (0, uuid_1.v4)();
        const result = await connection_1.db.query(`INSERT INTO publish_tasks
        (id, title, title_zh, title_en, content, content_zh, content_en, media_type, original_files, cover_image, target_platforms, schedule_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`, [
            id,
            data.title_zh, // 向后兼容 title 字段
            data.title_zh,
            data.title_en,
            data.content_zh || null, // 向后兼容 content 字段
            data.content_zh || null,
            data.content_en || null,
            data.media_type,
            JSON.stringify(data.original_files || []),
            data.cover_image || null,
            data.target_platforms,
            data.schedule_at || null,
            data.created_by || null,
        ]);
        return this.parseTask(result.rows[0]);
    }
    async findTaskById(id) {
        const result = await connection_1.db.query(`SELECT pt.*, u.name as creator_name, u.avatar as creator_avatar
       FROM publish_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       WHERE pt.id = $1`, [id]);
        return result.rows[0] ? this.parseTask(result.rows[0]) : null;
    }
    async findAllTasks(options = {}) {
        let query = `SELECT pt.*, u.name as creator_name, u.avatar as creator_avatar
                 FROM publish_tasks pt
                 LEFT JOIN users u ON pt.created_by = u.id
                 WHERE 1=1`;
        const params = [];
        let paramIndex = 1;
        if (options.status) {
            query += ` AND pt.status = $${paramIndex++}`;
            params.push(options.status);
        }
        if (options.createdBy) {
            query += ` AND pt.created_by = $${paramIndex++}`;
            params.push(options.createdBy);
        }
        query += ' ORDER BY pt.created_at DESC';
        if (options.limit) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(options.limit);
        }
        if (options.offset) {
            query += ` OFFSET $${paramIndex++}`;
            params.push(options.offset);
        }
        const result = await connection_1.db.query(query, params);
        return result.rows.map((row) => this.parseTask(row));
    }
    async updateTask(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;
        if (data.title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            params.push(data.title);
        }
        if (data.content !== undefined) {
            updates.push(`content = $${paramIndex++}`);
            params.push(data.content);
        }
        if (data.title_zh !== undefined) {
            updates.push(`title_zh = $${paramIndex++}`);
            params.push(data.title_zh);
        }
        if (data.title_en !== undefined) {
            updates.push(`title_en = $${paramIndex++}`);
            params.push(data.title_en);
        }
        if (data.content_zh !== undefined) {
            updates.push(`content_zh = $${paramIndex++}`);
            params.push(data.content_zh);
        }
        if (data.content_en !== undefined) {
            updates.push(`content_en = $${paramIndex++}`);
            params.push(data.content_en);
        }
        if (data.original_files !== undefined) {
            updates.push(`original_files = $${paramIndex++}`);
            params.push(JSON.stringify(data.original_files));
        }
        if (data.cover_image !== undefined) {
            updates.push(`cover_image = $${paramIndex++}`);
            params.push(data.cover_image);
        }
        if (data.processed_files !== undefined) {
            updates.push(`processed_files = $${paramIndex++}`);
            params.push(JSON.stringify(data.processed_files));
        }
        if (data.target_platforms !== undefined) {
            updates.push(`target_platforms = $${paramIndex++}`);
            params.push(data.target_platforms);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(data.status);
        }
        if (data.schedule_at !== undefined) {
            updates.push(`schedule_at = $${paramIndex++}`);
            params.push(data.schedule_at);
        }
        if (data.results !== undefined) {
            updates.push(`results = $${paramIndex++}`);
            params.push(JSON.stringify(data.results));
        }
        updates.push(`updated_at = $${paramIndex++}`);
        params.push(new Date());
        params.push(id);
        const result = await connection_1.db.query(`UPDATE publish_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, params);
        return result.rows[0] ? this.parseTask(result.rows[0]) : null;
    }
    async deleteTask(id) {
        const result = await connection_1.db.query('DELETE FROM publish_tasks WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async createMediaFile(data) {
        const id = (0, uuid_1.v4)();
        const result = await connection_1.db.query(`INSERT INTO media_files
        (id, original_name, file_path, file_size, mime_type, width, height, duration, thumbnail_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [
            id,
            data.original_name,
            data.file_path,
            data.file_size,
            data.mime_type,
            data.width || null,
            data.height || null,
            data.duration || null,
            data.thumbnail_path || null,
            data.created_by || null,
        ]);
        return result.rows[0];
    }
    async findMediaFileById(id) {
        const result = await connection_1.db.query('SELECT * FROM media_files WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async getStats() {
        // Total tasks
        const totalResult = await connection_1.db.query('SELECT COUNT(*) as total FROM publish_tasks');
        const total = parseInt(totalResult.rows[0].total, 10);
        // By status
        const statusResult = await connection_1.db.query(`
      SELECT status, COUNT(*) as count
      FROM publish_tasks
      GROUP BY status
    `);
        const byStatus = {};
        statusResult.rows.forEach((row) => {
            byStatus[row.status] = parseInt(row.count, 10);
        });
        // By platform - unnest target_platforms array and count
        const platformResult = await connection_1.db.query(`
      SELECT
        platform,
        COUNT(*) as total,
        SUM(CASE
          WHEN results::jsonb ? platform
            AND (results::jsonb -> platform ->> 'success')::boolean = true
          THEN 1 ELSE 0
        END) as success,
        SUM(CASE
          WHEN results::jsonb ? platform
            AND (results::jsonb -> platform ->> 'success')::boolean = false
          THEN 1 ELSE 0
        END) as failed
      FROM publish_tasks,
      unnest(target_platforms) as platform
      WHERE status != 'draft'
      GROUP BY platform
    `);
        const byPlatform = {};
        platformResult.rows.forEach((row) => {
            byPlatform[row.platform] = {
                total: parseInt(row.total, 10),
                success: parseInt(row.success, 10),
                failed: parseInt(row.failed, 10),
            };
        });
        // Recent 7 days trend
        const trendResult = await connection_1.db.query(`
      SELECT
        DATE(created_at) as date,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status IN ('failed', 'partial') THEN 1 ELSE 0 END) as failed
      FROM publish_tasks
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND status != 'draft'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
        const recentTrend = trendResult.rows.map((row) => ({
            date: row.date.toISOString().split('T')[0],
            success: parseInt(row.success, 10),
            failed: parseInt(row.failed, 10),
        }));
        return {
            total,
            byStatus,
            byPlatform,
            recentTrend,
        };
    }
    async getTaskLogs(taskId) {
        // Note: This requires a publish_logs table which may not exist yet
        // If the table doesn't exist, return empty array
        try {
            const result = await connection_1.db.query(`SELECT * FROM publish_logs
         WHERE task_id = $1
         ORDER BY created_at DESC`, [taskId]);
            return result.rows;
        }
        catch (error) {
            // Table doesn't exist, return empty array
            if (error.code === '42P01') {
                return [];
            }
            throw error;
        }
    }
    parseTask(row) {
        return {
            ...row,
            original_files: typeof row.original_files === 'string'
                ? JSON.parse(row.original_files)
                : row.original_files || [],
            processed_files: typeof row.processed_files === 'string'
                ? JSON.parse(row.processed_files)
                : row.processed_files || {},
            results: typeof row.results === 'string'
                ? JSON.parse(row.results)
                : row.results || {},
        };
    }
}
exports.PublishRepository = PublishRepository;
exports.publishRepository = new PublishRepository();
exports.default = exports.publishRepository;
//# sourceMappingURL=publish.repository.js.map