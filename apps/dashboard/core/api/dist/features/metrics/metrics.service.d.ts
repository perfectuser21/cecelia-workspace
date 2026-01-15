import { Metric, Platform, CollectDailyResponse, StoreMetricsResponse } from '../../shared/types';
export declare class MetricService {
    storeMetrics(data: CollectDailyResponse): Promise<StoreMetricsResponse>;
    getMetricsByAccount(accountId: number, startDate: string, endDate: string): Promise<Metric[]>;
    getMetricsByDate(date: string): Promise<Metric[]>;
    getMetricsByDateRange(startDate: string, endDate: string): Promise<Metric[]>;
    getMetricsByPlatform(platform: Platform, startDate: string, endDate: string): Promise<Metric[]>;
    getLatestMetric(accountId: number): Promise<Metric | null>;
    getPreviousDayMetric(accountId: number, date: string): Promise<Metric | null>;
    generateDailyReport(date: string): Promise<{
        ok: true;
        notionPageId?: string;
        summaryText: string;
        metrics: {
            total_accounts: number;
            total_followers_delta: number;
            total_impressions: number;
            total_engagements: number;
        };
    }>;
    private generateSummaryText;
    getReportByDate(date: string): Promise<import("../../shared/types").DailyReport | null>;
    getRecentReports(limit?: number): Promise<import("../../shared/types").DailyReport[]>;
    getDashboardMetrics(timeRange?: 'today' | 'week' | 'month'): Promise<{
        overview: {
            totalFollowers: number;
            totalFollowersDelta: number;
            totalImpressions: number;
            totalEngagements: number;
            engagementRate: number;
        };
        trends: {
            followers: {
                date: string;
                count: number;
            }[];
            impressions: {
                date: string;
                count: number;
            }[];
            engagements: {
                date: string;
                count: number;
            }[];
        };
        byPlatform: {
            platform: string;
            followers: number;
            followersDelta: number;
            impressions: number;
            engagements: number;
            accounts: number;
        }[];
        topContent: never[];
    }>;
}
export declare const metricService: MetricService;
export default metricService;
//# sourceMappingURL=metrics.service.d.ts.map