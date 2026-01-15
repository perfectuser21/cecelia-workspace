"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricService = exports.MetricService = void 0;
// Metric service for metrics data operations
const metric_repository_1 = require("./metric.repository");
const report_repository_1 = require("./report.repository");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
const accounts_1 = require("../accounts");
class MetricService {
    async storeMetrics(data) {
        const { platform, accountId, date } = data;
        logger_1.default.info('Storing metrics', { platform, accountId, date });
        try {
            // Get account
            const account = await accounts_1.accountsService.getAccountByPlatformAndId(platform, accountId);
            // Store metric
            const metric = await metric_repository_1.metricRepository.create({
                account_id: account.id,
                platform,
                collection_date: date,
                followers_total: data.followers_total,
                followers_delta: data.followers_delta,
                impressions: data.impressions,
                engagements: data.engagements,
                posts_published: data.posts_published,
            });
            logger_1.default.info('Metrics stored', {
                id: metric.id,
                platform,
                accountId,
                date,
            });
            return {
                ok: true,
                id: `metric_${metric.id}`,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to store metrics', {
                platform,
                accountId,
                date,
                error: error.message,
            });
            throw new error_middleware_1.AppError(`Failed to store metrics: ${error.message}`, 500);
        }
    }
    async getMetricsByAccount(accountId, startDate, endDate) {
        return await metric_repository_1.metricRepository.findByAccountDateRange(accountId, startDate, endDate);
    }
    async getMetricsByDate(date) {
        return await metric_repository_1.metricRepository.findByDate(date);
    }
    async getMetricsByDateRange(startDate, endDate) {
        return await metric_repository_1.metricRepository.findByDateRange(startDate, endDate);
    }
    async getMetricsByPlatform(platform, startDate, endDate) {
        return await metric_repository_1.metricRepository.findByPlatform(platform, startDate, endDate);
    }
    async getLatestMetric(accountId) {
        return await metric_repository_1.metricRepository.getLatestByAccount(accountId);
    }
    async getPreviousDayMetric(accountId, date) {
        return await metric_repository_1.metricRepository.getPreviousDayMetric(accountId, date);
    }
    async generateDailyReport(date) {
        logger_1.default.info('Generating daily report', { date });
        try {
            // Aggregate metrics for the date
            const aggregated = await metric_repository_1.metricRepository.aggregateByDate(date);
            const byPlatform = await metric_repository_1.metricRepository.aggregateByPlatform(date);
            // Create platform breakdown
            const platformData = {};
            byPlatform.forEach(p => {
                platformData[p.platform] = {
                    followers_delta: p.followers_delta,
                    impressions: p.impressions,
                    engagements: p.engagements,
                    posts: p.posts,
                };
            });
            // Store report
            await report_repository_1.reportRepository.create({
                report_date: date,
                total_accounts: aggregated.account_count,
                total_followers_delta: aggregated.total_followers_delta,
                total_impressions: aggregated.total_impressions,
                total_engagements: aggregated.total_engagements,
                by_platform: platformData,
            });
            // Generate summary text
            const summaryText = this.generateSummaryText(date, aggregated, byPlatform);
            logger_1.default.info('Daily report generated', {
                date,
                accounts: aggregated.account_count,
                followersDelta: aggregated.total_followers_delta,
            });
            return {
                ok: true,
                summaryText,
                metrics: {
                    total_accounts: aggregated.account_count,
                    total_followers_delta: aggregated.total_followers_delta,
                    total_impressions: aggregated.total_impressions,
                    total_engagements: aggregated.total_engagements,
                },
            };
        }
        catch (error) {
            logger_1.default.error('Failed to generate daily report', {
                date,
                error: error.message,
            });
            throw new error_middleware_1.AppError(`Failed to generate report: ${error.message}`, 500);
        }
    }
    generateSummaryText(date, aggregated, byPlatform) {
        const lines = [
            `Daily Report for ${date}`,
            `Total Accounts Processed: ${aggregated.account_count}`,
            `Total Followers Delta: ${aggregated.total_followers_delta > 0 ? '+' : ''}${aggregated.total_followers_delta}`,
            `Total Impressions: ${aggregated.total_impressions.toLocaleString()}`,
            `Total Engagements: ${aggregated.total_engagements.toLocaleString()}`,
            `Total Posts: ${aggregated.total_posts}`,
            '',
            'By Platform:',
        ];
        byPlatform.forEach(p => {
            lines.push(`- ${p.platform}: ${p.followers_delta > 0 ? '+' : ''}${p.followers_delta} followers, ` +
                `${p.impressions.toLocaleString()} impressions, ${p.engagements.toLocaleString()} engagements`);
        });
        return lines.join('\n');
    }
    async getReportByDate(date) {
        return await report_repository_1.reportRepository.findByDate(date);
    }
    async getRecentReports(limit = 30) {
        return await report_repository_1.reportRepository.findRecent(limit);
    }
    async getDashboardMetrics(timeRange = 'week') {
        const now = new Date();
        let startDate;
        let endDate = now.toISOString().split('T')[0];
        switch (timeRange) {
            case 'today':
                startDate = endDate;
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = weekAgo.toISOString().split('T')[0];
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate = monthAgo.toISOString().split('T')[0];
                break;
        }
        try {
            // Get metrics in date range
            const metrics = await metric_repository_1.metricRepository.findByDateRange(startDate, endDate);
            // Get latest followers total per account
            const accounts = await accounts_1.accountsService.getAllAccounts();
            const latestByAccount = {};
            for (const m of metrics) {
                if (!latestByAccount[m.account_id] || m.collection_date > latestByAccount[m.account_id].collection_date) {
                    latestByAccount[m.account_id] = m;
                }
            }
            // Calculate overview
            const totalFollowers = Object.values(latestByAccount).reduce((sum, m) => sum + (m.followers_total || 0), 0);
            const totalFollowersDelta = metrics.reduce((sum, m) => sum + (m.followers_delta || 0), 0);
            const totalImpressions = metrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
            const totalEngagements = metrics.reduce((sum, m) => sum + (m.engagements || 0), 0);
            const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;
            // Calculate trends by date
            const trendsByDate = {};
            for (const m of metrics) {
                const date = m.collection_date;
                if (!trendsByDate[date]) {
                    trendsByDate[date] = { followers: 0, impressions: 0, engagements: 0 };
                }
                trendsByDate[date].followers += m.followers_delta || 0;
                trendsByDate[date].impressions += m.impressions || 0;
                trendsByDate[date].engagements += m.engagements || 0;
            }
            const sortedDates = Object.keys(trendsByDate).sort();
            const trends = {
                followers: sortedDates.map(date => ({ date, count: trendsByDate[date].followers })),
                impressions: sortedDates.map(date => ({ date, count: trendsByDate[date].impressions })),
                engagements: sortedDates.map(date => ({ date, count: trendsByDate[date].engagements })),
            };
            // Calculate by platform
            const byPlatformMap = {};
            for (const m of metrics) {
                const platform = m.platform;
                if (!byPlatformMap[platform]) {
                    byPlatformMap[platform] = { followers: 0, followersDelta: 0, impressions: 0, engagements: 0, accounts: new Set() };
                }
                byPlatformMap[platform].followersDelta += m.followers_delta || 0;
                byPlatformMap[platform].impressions += m.impressions || 0;
                byPlatformMap[platform].engagements += m.engagements || 0;
                byPlatformMap[platform].accounts.add(m.account_id);
            }
            // Add latest followers per platform
            for (const m of Object.values(latestByAccount)) {
                if (byPlatformMap[m.platform]) {
                    byPlatformMap[m.platform].followers += m.followers_total || 0;
                }
            }
            const byPlatform = Object.entries(byPlatformMap).map(([platform, data]) => ({
                platform,
                followers: data.followers,
                followersDelta: data.followersDelta,
                impressions: data.impressions,
                engagements: data.engagements,
                accounts: data.accounts.size,
            }));
            return {
                overview: {
                    totalFollowers,
                    totalFollowersDelta,
                    totalImpressions,
                    totalEngagements,
                    engagementRate: Math.round(engagementRate * 100) / 100,
                },
                trends,
                byPlatform,
                topContent: [], // TODO: implement top content
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get dashboard metrics', { timeRange, error: error.message });
            throw new error_middleware_1.AppError(`Failed to get dashboard metrics: ${error.message}`, 500);
        }
    }
}
exports.MetricService = MetricService;
exports.metricService = new MetricService();
exports.default = exports.metricService;
//# sourceMappingURL=metrics.service.js.map