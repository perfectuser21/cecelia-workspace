"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsService = void 0;
// Notification service for sending alerts
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../../../shared/utils/config"));
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
class NotificationService {
    async notifyLoginRequired(request) {
        const { platform, accountId, reason, loginUrl } = request;
        logger_1.default.info('Sending login required notification', {
            platform,
            accountId,
            reason,
        });
        const message = `⚠️ Login Required\n\n` +
            `Platform: ${platform}\n` +
            `Account: ${accountId}\n` +
            `Reason: ${reason}\n\n` +
            `Please login at: ${loginUrl}`;
        const notified = [];
        // Send to Feishu
        if (config_1.default.notifications.feishu.webhookUrl) {
            try {
                await this.sendFeishuMessage(message);
                notified.push('feishu');
            }
            catch (error) {
                logger_1.default.error('Failed to send Feishu notification', {
                    error: error.message,
                });
            }
        }
        // Send to Slack
        if (config_1.default.notifications.slack.webhookUrl) {
            try {
                await this.sendSlackMessage(message);
                notified.push('slack');
            }
            catch (error) {
                logger_1.default.error('Failed to send Slack notification', {
                    error: error.message,
                });
            }
        }
        logger_1.default.info('Login required notification sent', {
            platform,
            accountId,
            channels: notified,
        });
        return {
            ok: true,
            notified,
        };
    }
    async notifyTeamDaily(request) {
        const { date, summaryText, notionUrl } = request;
        logger_1.default.info('Sending daily team notification', { date });
        const message = `📊 Daily Report - ${date}\n\n` +
            `${summaryText}\n\n` +
            (notionUrl ? `View full report: ${notionUrl}` : '');
        const channels = [];
        // Send to Feishu
        if (config_1.default.notifications.feishu.webhookUrl) {
            try {
                await this.sendFeishuMessage(message);
                channels.push('feishu');
            }
            catch (error) {
                logger_1.default.error('Failed to send Feishu notification', {
                    error: error.message,
                });
            }
        }
        // Send to Slack
        if (config_1.default.notifications.slack.webhookUrl) {
            try {
                await this.sendSlackMessage(message);
                channels.push('slack');
            }
            catch (error) {
                logger_1.default.error('Failed to send Slack notification', {
                    error: error.message,
                });
            }
        }
        logger_1.default.info('Daily team notification sent', {
            date,
            channels,
        });
        return {
            ok: true,
            channels,
        };
    }
    async notifyOpsAlert(request) {
        const { where, workflow, node, platform, accountId, error, meta } = request;
        const alertId = `alert_${Date.now()}`;
        logger_1.default.warn('Sending ops alert', {
            alertId,
            where,
            workflow,
            platform,
            accountId,
            error,
        });
        const message = `🚨 Operation Alert\n\n` +
            `Where: ${where}\n` +
            `Workflow: ${workflow}\n` +
            `Node: ${node}\n` +
            `Platform: ${platform}\n` +
            `Account: ${accountId}\n` +
            `Error: ${error}\n` +
            (meta ? `\nDetails: ${JSON.stringify(meta, null, 2)}` : '');
        // Send to Feishu
        if (config_1.default.notifications.feishu.webhookUrl) {
            try {
                await this.sendFeishuMessage(message);
            }
            catch (error) {
                logger_1.default.error('Failed to send Feishu alert', {
                    error: error.message,
                });
            }
        }
        // Send to Slack
        if (config_1.default.notifications.slack.webhookUrl) {
            try {
                await this.sendSlackMessage(message);
            }
            catch (error) {
                logger_1.default.error('Failed to send Slack alert', {
                    error: error.message,
                });
            }
        }
        return {
            ok: true,
            alertId,
        };
    }
    async sendFeishuMessage(message) {
        await axios_1.default.post(config_1.default.notifications.feishu.webhookUrl, {
            msg_type: 'text',
            content: {
                text: message,
            },
        });
    }
    async sendSlackMessage(message) {
        await axios_1.default.post(config_1.default.notifications.slack.webhookUrl, {
            text: message,
        });
    }
}
exports.notificationsService = new NotificationService();
//# sourceMappingURL=notifications.service.js.map