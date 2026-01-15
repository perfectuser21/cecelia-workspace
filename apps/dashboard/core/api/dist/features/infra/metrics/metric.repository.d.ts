import { Metric, Platform } from '../../../shared/types';
export declare class MetricRepository {
    create(data: {
        account_id: number;
        platform: Platform;
        collection_date: string;
        followers_total: number;
        followers_delta: number;
        impressions: number;
        engagements: number;
        posts_published: number;
    }): Promise<Metric>;
    findByAccountAndDate(accountId: number, date: string): Promise<Metric | null>;
    findByAccountDateRange(accountId: number, startDate: string, endDate: string): Promise<Metric[]>;
    findByDateRange(startDate: string, endDate: string): Promise<Metric[]>;
    findByDate(date: string): Promise<Metric[]>;
    findByPlatform(platform: Platform, startDate: string, endDate: string): Promise<Metric[]>;
    getLatestByAccount(accountId: number): Promise<Metric | null>;
    getPreviousDayMetric(accountId: number, date: string): Promise<Metric | null>;
    aggregateByDate(date: string): Promise<{
        total_followers_delta: number;
        total_impressions: number;
        total_engagements: number;
        total_posts: number;
        account_count: number;
    }>;
    aggregateByPlatform(date: string): Promise<Array<{
        platform: Platform;
        followers_delta: number;
        impressions: number;
        engagements: number;
        posts: number;
    }>>;
}
export declare const metricRepository: MetricRepository;
export default metricRepository;
//# sourceMappingURL=metric.repository.d.ts.map