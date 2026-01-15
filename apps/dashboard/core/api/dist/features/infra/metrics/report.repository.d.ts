import { DailyReport } from '../../../shared/types';
export declare class ReportRepository {
    create(data: {
        report_date: string;
        total_accounts: number;
        total_followers_delta: number;
        total_impressions: number;
        total_engagements: number;
        by_platform: Record<string, any>;
        notion_url?: string;
    }): Promise<DailyReport>;
    findByDate(date: string): Promise<DailyReport | null>;
    findByDateRange(startDate: string, endDate: string): Promise<DailyReport[]>;
    findRecent(limit?: number): Promise<DailyReport[]>;
    getLatest(): Promise<DailyReport | null>;
}
export declare const reportRepository: ReportRepository;
export default reportRepository;
//# sourceMappingURL=report.repository.d.ts.map