"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricRepository = exports.MetricRepository = void 0;
// Metric repository for database operations
const connection_1 = require("../../../shared/db/connection");
class MetricRepository {
    async create(data) {
        const result = await connection_1.db.query(`INSERT INTO metrics (
        account_id, platform, collection_date,
        followers_total, followers_delta, impressions,
        engagements, posts_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (account_id, collection_date)
      DO UPDATE SET
        followers_total = EXCLUDED.followers_total,
        followers_delta = EXCLUDED.followers_delta,
        impressions = EXCLUDED.impressions,
        engagements = EXCLUDED.engagements,
        posts_published = EXCLUDED.posts_published,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`, [
            data.account_id,
            data.platform,
            data.collection_date,
            data.followers_total,
            data.followers_delta,
            data.impressions,
            data.engagements,
            data.posts_published,
        ]);
        return result.rows[0];
    }
    async findByAccountAndDate(accountId, date) {
        const result = await connection_1.db.query('SELECT * FROM metrics WHERE account_id = $1 AND collection_date = $2', [accountId, date]);
        return result.rows[0] || null;
    }
    async findByAccountDateRange(accountId, startDate, endDate) {
        const result = await connection_1.db.query(`SELECT * FROM metrics
       WHERE account_id = $1
       AND collection_date >= $2
       AND collection_date <= $3
       ORDER BY collection_date ASC`, [accountId, startDate, endDate]);
        return result.rows;
    }
    async findByDateRange(startDate, endDate) {
        const result = await connection_1.db.query(`SELECT m.*, a.display_name, a.account_id as platform_account_id
       FROM metrics m
       JOIN accounts a ON m.account_id = a.id
       WHERE m.collection_date >= $1 AND m.collection_date <= $2
       ORDER BY m.collection_date ASC, a.platform, a.display_name`, [startDate, endDate]);
        return result.rows;
    }
    async findByDate(date) {
        const result = await connection_1.db.query(`SELECT m.*, a.display_name, a.account_id as platform_account_id
       FROM metrics m
       JOIN accounts a ON m.account_id = a.id
       WHERE m.collection_date = $1
       ORDER BY a.platform, a.display_name`, [date]);
        return result.rows;
    }
    async findByPlatform(platform, startDate, endDate) {
        const result = await connection_1.db.query(`SELECT m.*, a.display_name, a.account_id as platform_account_id
       FROM metrics m
       JOIN accounts a ON m.account_id = a.id
       WHERE m.platform = $1
       AND m.collection_date >= $2
       AND m.collection_date <= $3
       ORDER BY m.collection_date ASC, a.display_name`, [platform, startDate, endDate]);
        return result.rows;
    }
    async getLatestByAccount(accountId) {
        const result = await connection_1.db.query(`SELECT * FROM metrics
       WHERE account_id = $1
       ORDER BY collection_date DESC
       LIMIT 1`, [accountId]);
        return result.rows[0] || null;
    }
    async getPreviousDayMetric(accountId, date) {
        const result = await connection_1.db.query(`SELECT * FROM metrics
       WHERE account_id = $1
       AND collection_date < $2
       ORDER BY collection_date DESC
       LIMIT 1`, [accountId, date]);
        return result.rows[0] || null;
    }
    async aggregateByDate(date) {
        const result = await connection_1.db.query(`SELECT
        COALESCE(SUM(followers_delta), 0) as total_followers_delta,
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(engagements), 0) as total_engagements,
        COALESCE(SUM(posts_published), 0) as total_posts,
        COUNT(DISTINCT account_id) as account_count
       FROM metrics
       WHERE collection_date = $1`, [date]);
        const row = result.rows[0];
        return {
            total_followers_delta: parseInt(row.total_followers_delta, 10),
            total_impressions: parseInt(row.total_impressions, 10),
            total_engagements: parseInt(row.total_engagements, 10),
            total_posts: parseInt(row.total_posts, 10),
            account_count: parseInt(row.account_count, 10),
        };
    }
    async aggregateByPlatform(date) {
        const result = await connection_1.db.query(`SELECT
        platform,
        COALESCE(SUM(followers_delta), 0) as followers_delta,
        COALESCE(SUM(impressions), 0) as impressions,
        COALESCE(SUM(engagements), 0) as engagements,
        COALESCE(SUM(posts_published), 0) as posts
       FROM metrics
       WHERE collection_date = $1
       GROUP BY platform
       ORDER BY platform`, [date]);
        return result.rows.map(row => ({
            platform: row.platform,
            followers_delta: parseInt(row.followers_delta, 10),
            impressions: parseInt(row.impressions, 10),
            engagements: parseInt(row.engagements, 10),
            posts: parseInt(row.posts, 10),
        }));
    }
}
exports.MetricRepository = MetricRepository;
exports.metricRepository = new MetricRepository();
exports.default = exports.metricRepository;
//# sourceMappingURL=metric.repository.js.map