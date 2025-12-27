// Daily report repository for database operations
import { db } from '../../shared/db/connection';
import { DailyReport } from '../../shared/types';

export class ReportRepository {
  async create(data: {
    report_date: string;
    total_accounts: number;
    total_followers_delta: number;
    total_impressions: number;
    total_engagements: number;
    by_platform: Record<string, any>;
    notion_url?: string;
  }): Promise<DailyReport> {
    const result = await db.query<DailyReport>(
      `INSERT INTO daily_reports (
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
      RETURNING *`,
      [
        data.report_date,
        data.total_accounts,
        data.total_followers_delta,
        data.total_impressions,
        data.total_engagements,
        JSON.stringify(data.by_platform),
        data.notion_url || null,
      ]
    );
    return result.rows[0];
  }

  async findByDate(date: string): Promise<DailyReport | null> {
    const result = await db.query<DailyReport>(
      'SELECT * FROM daily_reports WHERE report_date = $1',
      [date]
    );
    return result.rows[0] || null;
  }

  async findByDateRange(startDate: string, endDate: string): Promise<DailyReport[]> {
    const result = await db.query<DailyReport>(
      `SELECT * FROM daily_reports
       WHERE report_date >= $1 AND report_date <= $2
       ORDER BY report_date DESC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  async findRecent(limit: number = 30): Promise<DailyReport[]> {
    const result = await db.query<DailyReport>(
      'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  async getLatest(): Promise<DailyReport | null> {
    const result = await db.query<DailyReport>(
      'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }
}

export const reportRepository = new ReportRepository();
export default reportRepository;
