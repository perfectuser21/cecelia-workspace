"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRepository = exports.ReportRepository = void 0;
// Daily report repository for database operations
const connection_1 = require("../../../shared/db/connection");
class ReportRepository {
    async create(data) {
        const result = await connection_1.db.query(`INSERT INTO daily_reports (
        report_date, total_accounts, total_followers_delta,
        total_impressions, total_engagements, by_platform, notion_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (report_date)
      DO UPDATE SET
        total_accounts = EXCLUDED.total_accounts,
        total_followers_delta = EXCLUDED.total_followers_delta,
        total_impressions = EXCLUDED.total_impressions,
        total_engagements = EXCLUDED.total_engagements,
        by_platform = EXCLUDED.by_platform,
        notion_url = EXCLUDED.notion_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`, [
            data.report_date,
            data.total_accounts,
            data.total_followers_delta,
            data.total_impressions,
            data.total_engagements,
            JSON.stringify(data.by_platform),
            data.notion_url || null,
        ]);
        return result.rows[0];
    }
    async findByDate(date) {
        const result = await connection_1.db.query('SELECT * FROM daily_reports WHERE report_date = $1', [date]);
        return result.rows[0] || null;
    }
    async findByDateRange(startDate, endDate) {
        const result = await connection_1.db.query(`SELECT * FROM daily_reports
       WHERE report_date >= $1 AND report_date <= $2
       ORDER BY report_date DESC`, [startDate, endDate]);
        return result.rows;
    }
    async findRecent(limit = 30) {
        const result = await connection_1.db.query('SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT $1', [limit]);
        return result.rows;
    }
    async getLatest() {
        const result = await connection_1.db.query('SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 1');
        return result.rows[0] || null;
    }
}
exports.ReportRepository = ReportRepository;
exports.reportRepository = new ReportRepository();
exports.default = exports.reportRepository;
//# sourceMappingURL=report.repository.js.map