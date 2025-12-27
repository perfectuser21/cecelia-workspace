// Publish task repository
import { db } from '../../shared/db/connection';
import { v4 as uuidv4 } from 'uuid';

export interface PublishTask {
  id: string;
  title: string; // 保留向后兼容
  title_zh: string;
  title_en: string;
  content: string | null; // 保留向后兼容
  content_zh: string | null;
  content_en: string | null;
  media_type: 'image' | 'video' | 'text';
  lang: 'zh' | 'en';
  original_files: string[];
  cover_image: string | null;
  processed_files: Record<string, string[]>;
  target_platforms: string[];
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  schedule_at: Date | null;
  results: Record<string, { success: boolean; url?: string; error?: string }>;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface MediaFile {
  id: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnail_path: string | null;
  created_by: number | null;
  created_at: Date;
}

export class PublishRepository {
  async createTask(data: {
    title_zh: string;
    title_en: string;
    content_zh?: string;
    content_en?: string;
    media_type: 'image' | 'video' | 'text';
    original_files?: string[];
    cover_image?: string;
    target_platforms: string[];
    schedule_at?: Date;
    created_by?: number;
  }): Promise<PublishTask> {
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO publish_tasks
        (id, title, title_zh, title_en, content, content_zh, content_en, media_type, original_files, cover_image, target_platforms, schedule_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
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
      ]
    );
    return this.parseTask(result.rows[0]);
  }

  async findTaskById(id: string): Promise<PublishTask | null> {
    const result = await db.query(
      `SELECT pt.*, u.name as creator_name, u.avatar as creator_avatar
       FROM publish_tasks pt
       LEFT JOIN users u ON pt.created_by = u.id
       WHERE pt.id = $1`,
      [id]
    );
    return result.rows[0] ? this.parseTask(result.rows[0]) : null;
  }

  async findAllTasks(options: {
    status?: string;
    createdBy?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<PublishTask[]> {
    let query = `SELECT pt.*, u.name as creator_name, u.avatar as creator_avatar
                 FROM publish_tasks pt
                 LEFT JOIN users u ON pt.created_by = u.id
                 WHERE 1=1`;
    const params: any[] = [];
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

    const result = await db.query(query, params);
    return result.rows.map((row: any) => this.parseTask(row));
  }

  async updateTask(id: string, data: Partial<{
    title: string;
    content: string;
    title_zh: string;
    title_en: string;
    content_zh: string;
    content_en: string;
    original_files: string[];
    cover_image: string | null;
    processed_files: Record<string, string[]>;
    target_platforms: string[];
    status: string;
    schedule_at: Date | null;
    results: Record<string, any>;
  }>): Promise<PublishTask | null> {
    const updates: string[] = [];
    const params: any[] = [];
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

    const result = await db.query(
      `UPDATE publish_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] ? this.parseTask(result.rows[0]) : null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM publish_tasks WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createMediaFile(data: {
    original_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    width?: number;
    height?: number;
    duration?: number;
    thumbnail_path?: string;
    created_by?: number;
  }): Promise<MediaFile> {
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO media_files
        (id, original_name, file_path, file_size, mime_type, width, height, duration, thumbnail_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
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
      ]
    );
    return result.rows[0];
  }

  async findMediaFileById(id: string): Promise<MediaFile | null> {
    const result = await db.query(
      'SELECT * FROM media_files WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPlatform: Record<string, { total: number; success: number; failed: number }>;
    recentTrend: Array<{ date: string; success: number; failed: number }>;
  }> {
    // Total tasks
    const totalResult = await db.query('SELECT COUNT(*) as total FROM publish_tasks');
    const total = parseInt(totalResult.rows[0].total, 10);

    // By status
    const statusResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM publish_tasks
      GROUP BY status
    `);
    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach((row: any) => {
      byStatus[row.status] = parseInt(row.count, 10);
    });

    // By platform - unnest target_platforms array and count
    const platformResult = await db.query(`
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

    const byPlatform: Record<string, { total: number; success: number; failed: number }> = {};
    platformResult.rows.forEach((row: any) => {
      byPlatform[row.platform] = {
        total: parseInt(row.total, 10),
        success: parseInt(row.success, 10),
        failed: parseInt(row.failed, 10),
      };
    });

    // Recent 7 days trend
    const trendResult = await db.query(`
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

    const recentTrend = trendResult.rows.map((row: any) => ({
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

  async getTaskLogs(taskId: string): Promise<Array<{
    id: string;
    task_id: string;
    platform: string;
    action: string;
    status: string;
    message: string | null;
    created_at: Date;
  }>> {
    // Note: This requires a publish_logs table which may not exist yet
    // If the table doesn't exist, return empty array
    try {
      const result = await db.query(
        `SELECT * FROM publish_logs
         WHERE task_id = $1
         ORDER BY created_at DESC`,
        [taskId]
      );
      return result.rows;
    } catch (error: any) {
      // Table doesn't exist, return empty array
      if (error.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  private parseTask(row: any): PublishTask {
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

export const publishRepository = new PublishRepository();
export default publishRepository;
