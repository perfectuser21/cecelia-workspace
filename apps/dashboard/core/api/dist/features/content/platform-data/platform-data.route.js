"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Platform data routes - for scraped metrics from all platforms
const express_1 = require("express");
const connection_1 = require("../../../shared/db/connection");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const router = (0, express_1.Router)();
// Get content items (常规数据)
router.get('/', async (req, res, next) => {
    try {
        const { platform, content_type, limit = 100, offset = 0 } = req.query;
        let query = 'SELECT * FROM content_items WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (platform) {
            query += ` AND platform = $${paramIndex++}`;
            params.push(platform);
        }
        if (content_type) {
            query += ` AND content_type = $${paramIndex++}`;
            params.push(content_type);
        }
        query += ` ORDER BY publish_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);
        const result = await connection_1.db.query(query, params);
        res.json({
            success: true,
            data: result.rows,
            count: result.rowCount,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch content items', { error: error.message });
        next(error);
    }
});
// Get aggregated stats
router.get('/stats', async (req, res, next) => {
    try {
        const { platform } = req.query;
        let whereClause = '';
        const params = [];
        if (platform) {
            whereClause = 'WHERE platform = $1';
            params.push(platform);
        }
        // Stats by content type
        const byTypeQuery = `
      SELECT
        content_type,
        COUNT(*) as count,
        SUM(latest_views) as total_views,
        SUM(latest_likes) as total_likes,
        AVG(latest_views) as avg_views
      FROM content_items
      ${whereClause}
      GROUP BY content_type
    `;
        // Total stats
        const totalQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(latest_views) as total_views,
        SUM(latest_likes) as total_likes,
        SUM(latest_follower_gain) as total_follower_gain
      FROM content_items
      ${whereClause}
    `;
        const [byTypeResult, totalResult] = await Promise.all([
            connection_1.db.query(byTypeQuery, params),
            connection_1.db.query(totalQuery, params),
        ]);
        res.json({
            success: true,
            by_type: byTypeResult.rows,
            total: totalResult.rows[0],
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch platform stats', { error: error.message });
        next(error);
    }
});
// Get grouped content (按内容形式分组 + 跨平台聚合)
// 以抖音的 content_type 为准判断内容形式
router.get('/grouped', async (req, res, next) => {
    try {
        const { form = '视频', page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        // 先按标题分组，获取每组的"原始形式"（优先用抖音的类型判断）
        // 逻辑：如果有抖音内容，用抖音的 content_type；否则用第一个平台的
        const result = await connection_1.db.query(`
      WITH grouped_content AS (
        SELECT
          title,
          MIN(publish_time) as first_publish_time,
          SUM(latest_views) as total_views,
          SUM(latest_likes) as total_likes,
          SUM(latest_comments) as total_comments,
          SUM(latest_shares) as total_shares,
          SUM(latest_favorites) as total_favorites,
          array_agg(DISTINCT platform) as platforms,
          -- 优先取抖音的 content_type，没有则取第一个
          COALESCE(
            MAX(CASE WHEN platform = 'douyin' THEN content_type END),
            MAX(CASE WHEN platform = 'xiaohongshu' THEN content_type END),
            MIN(content_type)
          ) as primary_content_type,
          json_agg(json_build_object(
            'id', id,
            'platform', platform,
            'content_type', content_type,
            'views', latest_views,
            'likes', latest_likes,
            'comments', latest_comments,
            'shares', latest_shares,
            'favorites', latest_favorites,
            'publish_time', publish_time
          ) ORDER BY
            CASE WHEN platform = 'douyin' THEN 0 ELSE 1 END,
            latest_views DESC
          ) as items
        FROM content_items
        GROUP BY title
      ),
      with_form AS (
        SELECT *,
          CASE
            WHEN primary_content_type = '视频' THEN '视频'
            WHEN primary_content_type IN ('文章', '长文') THEN '长文'
            ELSE '图文'
          END as original_form
        FROM grouped_content
      )
      SELECT
        (SELECT MIN(id) FROM content_items WHERE title = wf.title) as id,
        title,
        first_publish_time,
        total_views,
        total_likes,
        total_comments,
        total_shares,
        total_favorites,
        platforms,
        primary_content_type,
        original_form,
        items
      FROM with_form wf
      WHERE original_form = $1
      ORDER BY first_publish_time DESC
      LIMIT $2 OFFSET $3
    `, [form, limit, offset]);
        // 获取该形式的总数
        const countResult = await connection_1.db.query(`
      WITH grouped_content AS (
        SELECT
          title,
          COALESCE(
            MAX(CASE WHEN platform = 'douyin' THEN content_type END),
            MAX(CASE WHEN platform = 'xiaohongshu' THEN content_type END),
            MIN(content_type)
          ) as primary_content_type
        FROM content_items
        GROUP BY title
      ),
      with_form AS (
        SELECT *,
          CASE
            WHEN primary_content_type = '视频' THEN '视频'
            WHEN primary_content_type IN ('文章', '长文') THEN '长文'
            ELSE '图文'
          END as original_form
        FROM grouped_content
      )
      SELECT COUNT(*) as total FROM with_form WHERE original_form = $1
    `, [form]);
        const totalItems = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalItems / Number(limit));
        // 计算该形式的平均值（基于分组后的数据）
        const avgResult = await connection_1.db.query(`
      WITH grouped_content AS (
        SELECT
          title,
          SUM(latest_views) as total_views,
          SUM(latest_likes) as total_likes,
          COALESCE(
            MAX(CASE WHEN platform = 'douyin' THEN content_type END),
            MAX(CASE WHEN platform = 'xiaohongshu' THEN content_type END),
            MIN(content_type)
          ) as primary_content_type
        FROM content_items
        GROUP BY title
      ),
      with_form AS (
        SELECT *,
          CASE
            WHEN primary_content_type = '视频' THEN '视频'
            WHEN primary_content_type IN ('文章', '长文') THEN '长文'
            ELSE '图文'
          END as original_form
        FROM grouped_content
      )
      SELECT
        AVG(total_views) as avg_views,
        AVG(total_likes) as avg_likes
      FROM with_form WHERE original_form = $1
    `, [form]);
        const avgViews = parseFloat(avgResult.rows[0].avg_views) || 0;
        const avgLikes = parseFloat(avgResult.rows[0].avg_likes) || 0;
        // 统计每种形式的数据（基于抖音优先的分类）
        const statsResult = await connection_1.db.query(`
      WITH grouped_content AS (
        SELECT
          title,
          SUM(latest_views) as total_views,
          SUM(latest_likes) as total_likes,
          COALESCE(
            MAX(CASE WHEN platform = 'douyin' THEN content_type END),
            MAX(CASE WHEN platform = 'xiaohongshu' THEN content_type END),
            MIN(content_type)
          ) as primary_content_type
        FROM content_items
        GROUP BY title
      ),
      with_form AS (
        SELECT *,
          CASE
            WHEN primary_content_type = '视频' THEN '视频'
            WHEN primary_content_type IN ('文章', '长文') THEN '长文'
            ELSE '图文'
          END as original_form
        FROM grouped_content
      )
      SELECT
        original_form as form,
        COUNT(*) as count,
        SUM(total_views) as total_views,
        SUM(total_likes) as total_likes
      FROM with_form
      GROUP BY original_form
    `);
        const formStats = {
            '视频': { count: 0, total_views: 0, total_likes: 0 },
            '图文': { count: 0, total_views: 0, total_likes: 0 },
            '长文': { count: 0, total_views: 0, total_likes: 0 },
        };
        for (const row of statsResult.rows) {
            formStats[row.form] = {
                count: parseInt(row.count),
                total_views: parseInt(row.total_views || '0'),
                total_likes: parseInt(row.total_likes || '0'),
            };
        }
        // 标记表现好的内容（高于平均值 1.5 倍）
        const dataWithMarks = result.rows.map((row) => ({
            ...row,
            is_top_performer: parseInt(row.total_views) > avgViews * 1.5,
        }));
        res.json({
            success: true,
            form: form,
            data: dataWithMarks,
            form_stats: formStats,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total_items: totalItems,
                total_pages: totalPages,
            },
            averages: {
                avg_views: Math.round(avgViews),
                avg_likes: Math.round(avgLikes),
            },
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch grouped content', { error: error.message });
        next(error);
    }
});
// Get metrics history for a content item (详细数据)
router.get('/:contentId/metrics', async (req, res, next) => {
    try {
        const { contentId } = req.params;
        const result = await connection_1.db.query(`SELECT * FROM content_metrics WHERE content_id = $1 ORDER BY days_after_publish`, [contentId]);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch content metrics', { error: error.message });
        next(error);
    }
});
// Batch insert/upsert content data (for scrapers)
router.post('/batch', async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No items provided',
            });
        }
        logger_1.default.info('Batch inserting content data', { count: items.length });
        let inserted = 0;
        let updated = 0;
        let metricsInserted = 0;
        for (const item of items) {
            // Calculate days after publish
            const publishDate = new Date(item.publish_time);
            const now = new Date();
            const daysAfterPublish = Math.max(1, Math.ceil((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24)));
            // Upsert content_items
            const itemResult = await connection_1.db.query(`
        INSERT INTO content_items (
          platform, content_type, title, publish_time, status,
          latest_views, latest_likes, latest_comments, latest_shares,
          latest_favorites, latest_follower_gain, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (platform, title, publish_time) DO UPDATE SET
          latest_views = EXCLUDED.latest_views,
          latest_likes = EXCLUDED.latest_likes,
          latest_comments = EXCLUDED.latest_comments,
          latest_shares = EXCLUDED.latest_shares,
          latest_favorites = EXCLUDED.latest_favorites,
          latest_follower_gain = EXCLUDED.latest_follower_gain,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_insert
      `, [
                item.platform || 'douyin',
                item.content_type,
                item.title,
                item.publish_time,
                item.status,
                item.views || 0,
                item.likes || 0,
                item.comments || 0,
                item.shares || 0,
                item.favorites || 0,
                item.follower_gain || 0,
            ]);
            const contentId = itemResult.rows[0].id;
            if (itemResult.rows[0].is_insert) {
                inserted++;
            }
            else {
                updated++;
            }
            // Insert metrics snapshot (only for specific days: 1, 2, 3, 5, 7, 15, 30)
            const targetDays = [1, 2, 3, 5, 7, 15, 30];
            const nearestDay = targetDays.reduce((prev, curr) => Math.abs(curr - daysAfterPublish) < Math.abs(prev - daysAfterPublish) ? curr : prev);
            // Only insert if we're close to a target day (within 1 day)
            if (Math.abs(daysAfterPublish - nearestDay) <= 1) {
                const metricsResult = await connection_1.db.query(`
          INSERT INTO content_metrics (
            content_id, days_after_publish, scraped_at,
            views, click_rate, completion_rate, completion_rate_5s, bounce_rate, avg_play_duration,
            likes, comments, shares, favorites, profile_visits, follower_gain
          ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (content_id, days_after_publish) DO UPDATE SET
            views = EXCLUDED.views,
            click_rate = EXCLUDED.click_rate,
            completion_rate = EXCLUDED.completion_rate,
            completion_rate_5s = EXCLUDED.completion_rate_5s,
            bounce_rate = EXCLUDED.bounce_rate,
            avg_play_duration = EXCLUDED.avg_play_duration,
            likes = EXCLUDED.likes,
            comments = EXCLUDED.comments,
            shares = EXCLUDED.shares,
            favorites = EXCLUDED.favorites,
            profile_visits = EXCLUDED.profile_visits,
            follower_gain = EXCLUDED.follower_gain,
            scraped_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [
                    contentId,
                    nearestDay,
                    item.views,
                    item.click_rate,
                    item.completion_rate,
                    item.completion_rate_5s,
                    item.bounce_rate_2s || item.bounce_rate,
                    item.avg_play_duration,
                    item.likes,
                    item.comments,
                    item.shares,
                    item.favorites,
                    item.profile_visits,
                    item.follower_gain,
                ]);
                if (metricsResult.rows[0]?.is_insert) {
                    metricsInserted++;
                }
            }
        }
        logger_1.default.info('Batch insert completed', { inserted, updated, metricsInserted });
        res.json({
            success: true,
            items: { inserted, updated },
            metrics: { inserted: metricsInserted },
            total: items.length,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to batch insert content data', { error: error.message });
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=platform-data.route.js.map