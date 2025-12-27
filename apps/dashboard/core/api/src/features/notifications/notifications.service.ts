// Notification service for sending alerts
import axios from 'axios';
import config from '../../shared/utils/config';
import logger from '../../shared/utils/logger';
import {
  NotifyLoginRequiredRequest,
  NotifyLoginRequiredResponse,
  NotifyTeamDailyRequest,
  NotifyTeamDailyResponse,
  NotifyOpsAlertRequest,
  NotifyOpsAlertResponse,
} from './notifications.types';

class NotificationService {
  async notifyLoginRequired(
    request: NotifyLoginRequiredRequest
  ): Promise<NotifyLoginRequiredResponse> {
    const { platform, accountId, reason, loginUrl } = request;

    logger.info('Sending login required notification', {
      platform,
      accountId,
      reason,
    });

    const message = `⚠️ Login Required\n\n` +
      `Platform: ${platform}\n` +
      `Account: ${accountId}\n` +
      `Reason: ${reason}\n\n` +
      `Please login at: ${loginUrl}`;

    const notified: string[] = [];

    // Send to Feishu
    if (config.notifications.feishu.webhookUrl) {
      try {
        await this.sendFeishuMessage(message);
        notified.push('feishu');
      } catch (error: any) {
        logger.error('Failed to send Feishu notification', {
          error: error.message,
        });
      }
    }

    // Send to Slack
    if (config.notifications.slack.webhookUrl) {
      try {
        await this.sendSlackMessage(message);
        notified.push('slack');
      } catch (error: any) {
        logger.error('Failed to send Slack notification', {
          error: error.message,
        });
      }
    }

    logger.info('Login required notification sent', {
      platform,
      accountId,
      channels: notified,
    });

    return {
      ok: true,
      notified,
    };
  }

  async notifyTeamDaily(
    request: NotifyTeamDailyRequest
  ): Promise<NotifyTeamDailyResponse> {
    const { date, summaryText, notionUrl } = request;

    logger.info('Sending daily team notification', { date });

    const message = `📊 Daily Report - ${date}\n\n` +
      `${summaryText}\n\n` +
      (notionUrl ? `View full report: ${notionUrl}` : '');

    const channels: string[] = [];

    // Send to Feishu
    if (config.notifications.feishu.webhookUrl) {
      try {
        await this.sendFeishuMessage(message);
        channels.push('feishu');
      } catch (error: any) {
        logger.error('Failed to send Feishu notification', {
          error: error.message,
        });
      }
    }

    // Send to Slack
    if (config.notifications.slack.webhookUrl) {
      try {
        await this.sendSlackMessage(message);
        channels.push('slack');
      } catch (error: any) {
        logger.error('Failed to send Slack notification', {
          error: error.message,
        });
      }
    }

    logger.info('Daily team notification sent', {
      date,
      channels,
    });

    return {
      ok: true,
      channels,
    };
  }

  async notifyOpsAlert(
    request: NotifyOpsAlertRequest
  ): Promise<NotifyOpsAlertResponse> {
    const { where, workflow, node, platform, accountId, error, meta } = request;

    const alertId = `alert_${Date.now()}`;

    logger.warn('Sending ops alert', {
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
    if (config.notifications.feishu.webhookUrl) {
      try {
        await this.sendFeishuMessage(message);
      } catch (error: any) {
        logger.error('Failed to send Feishu alert', {
          error: error.message,
        });
      }
    }

    // Send to Slack
    if (config.notifications.slack.webhookUrl) {
      try {
        await this.sendSlackMessage(message);
      } catch (error: any) {
        logger.error('Failed to send Slack alert', {
          error: error.message,
        });
      }
    }

    return {
      ok: true,
      alertId,
    };
  }

  private async sendFeishuMessage(message: string): Promise<void> {
    await axios.post(config.notifications.feishu.webhookUrl, {
      msg_type: 'text',
      content: {
        text: message,
      },
    });
  }

  private async sendSlackMessage(message: string): Promise<void> {
    await axios.post(config.notifications.slack.webhookUrl, {
      text: message,
    });
  }
}

export const notificationsService = new NotificationService();
