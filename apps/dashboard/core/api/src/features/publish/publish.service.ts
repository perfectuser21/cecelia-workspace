// Publish service for managing publish tasks
import axios from 'axios';
import { publishRepository, PublishTask } from './publish.repository';
import { contentsRepository } from '../contents';
import { mediaService } from './media.service';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import config from '../../shared/utils/config';

// Cloudflare Deploy Hook - 发布到网站后自动触发重建
const CLOUDFLARE_DEPLOY_HOOK = process.env.CLOUDFLARE_DEPLOY_HOOK || '';

// Feishu webhook URL - 发布完成后发送通知
const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';

async function triggerWebsiteRebuild() {
  // 调用主机上的部署 webhook
  const DEPLOY_WEBHOOK = process.env.DEPLOY_WEBHOOK_URL || 'http://host.docker.internal:9999/deploy';
  const DEPLOY_SECRET = process.env.DEPLOY_SECRET || 'zenithjoyai-deploy-2024';

  try {
    logger.info('Triggering zenithjoyai.com rebuild via webhook...');

    await axios.post(DEPLOY_WEBHOOK, {}, {
      headers: {
        'Authorization': `Bearer ${DEPLOY_SECRET}`,
      },
      timeout: 5000, // 5 秒超时，webhook 立即返回
    });

    logger.info('zenithjoyai.com rebuild triggered successfully');
  } catch (error: any) {
    logger.error('Failed to trigger website rebuild', { error: error.message });
  }
}

/**
 * 发送飞书通知 - 发布任务完成时调用
 * @param task 发布任务
 */
async function sendFeishuNotification(task: PublishTask) {
  if (!FEISHU_WEBHOOK_URL) {
    logger.debug('FEISHU_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  try {
    // 计算平台状态
    const platformResults = task.target_platforms.map(platform => {
      const result = task.results[platform];
      if (!result) return `${platform} ⏳`;
      return result.success ? `${platform} ✅` : `${platform} ❌`;
    });

    // 统计成功/失败数量
    const successCount = Object.values(task.results).filter(r => r.success).length;
    const totalCount = task.target_platforms.length;
    const failedCount = totalCount - successCount;

    // 确定整体状态文本
    let statusText = '';
    let statusColor = 'grey';
    if (task.status === 'completed') {
      statusText = '全部成功';
      statusColor = 'green';
    } else if (task.status === 'failed') {
      statusText = '全部失败';
      statusColor = 'red';
    } else if (task.status === 'partial') {
      statusText = '部分失败';
      statusColor = 'orange';
    }

    // 构建飞书卡片消息
    const card = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: '📢 发布完成通知',
          },
          template: statusColor,
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**标题**: ${task.title_zh || task.title}\n**状态**: ${statusText} (${successCount}/${totalCount})\n**平台**: ${platformResults.join(' | ')}`,
            },
          },
          {
            tag: 'hr',
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  tag: 'plain_text',
                  content: '查看详情',
                },
                type: 'primary',
                url: `https://dashboard.zenjoymedia.media:3000/content`,
              },
            ],
          },
        ],
      },
    };

    // 异步发送，不阻塞返回
    await axios.post(FEISHU_WEBHOOK_URL, card, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Feishu notification sent', { taskId: task.id, status: task.status });
  } catch (error: any) {
    // 通知失败不影响主流程
    logger.error('Failed to send Feishu notification', {
      taskId: task.id,
      error: error.message,
    });
  }
}

export class PublishService {
  async createTask(data: {
    titleZh: string;
    titleEn: string;
    contentZh?: string;
    contentEn?: string;
    mediaType: 'image' | 'video' | 'text';
    originalFiles?: string[];
    coverImage?: string;
    targetPlatforms: string[];
    scheduleAt?: Date;
    createdBy?: number;
  }): Promise<PublishTask> {
    const task = await publishRepository.createTask({
      title_zh: data.titleZh,
      title_en: data.titleEn,
      content_zh: data.contentZh,
      content_en: data.contentEn,
      media_type: data.mediaType,
      original_files: data.originalFiles,
      cover_image: data.coverImage,
      target_platforms: data.targetPlatforms,
      schedule_at: data.scheduleAt,
      created_by: data.createdBy,
    });

    logger.info('Publish task created', {
      taskId: task.id,
      title: task.title,
      platforms: task.target_platforms,
    });

    return task;
  }

  async getTaskById(id: string): Promise<PublishTask> {
    const task = await publishRepository.findTaskById(id);
    if (!task) {
      throw new AppError(`Task not found: ${id}`, 404);
    }
    return task;
  }

  async getTasks(options: {
    status?: string;
    createdBy?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<PublishTask[]> {
    return await publishRepository.findAllTasks(options);
  }

  async updateTask(id: string, data: Partial<{
    title: string;
    content: string;
    titleZh: string;
    titleEn: string;
    contentZh: string;
    contentEn: string;
    originalFiles: string[];
    targetPlatforms: string[];
    scheduleAt: Date | null;
  }>): Promise<PublishTask> {
    const existing = await this.getTaskById(id);

    // 只能在 draft 状态时编辑内容
    if (data.titleZh || data.titleEn || data.contentZh || data.contentEn) {
      if (existing.status !== 'draft') {
        throw new AppError('Can only edit content in draft status', 400);
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.titleZh !== undefined) {
      updateData.title_zh = data.titleZh;
      updateData.title = data.titleZh; // 保持向后兼容
    }
    if (data.titleEn !== undefined) updateData.title_en = data.titleEn;
    if (data.contentZh !== undefined) {
      updateData.content_zh = data.contentZh;
      updateData.content = data.contentZh; // 保持向后兼容
    }
    if (data.contentEn !== undefined) updateData.content_en = data.contentEn;
    if (data.originalFiles !== undefined) updateData.original_files = data.originalFiles;
    if (data.targetPlatforms !== undefined) updateData.target_platforms = data.targetPlatforms;
    if (data.scheduleAt !== undefined) updateData.schedule_at = data.scheduleAt;

    const updated = await publishRepository.updateTask(id, updateData);
    if (!updated) {
      throw new AppError(`Failed to update task: ${id}`, 500);
    }

    logger.info('Publish task updated', { taskId: id });
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await this.getTaskById(id);
    const deleted = await publishRepository.deleteTask(id);
    if (!deleted) {
      throw new AppError(`Failed to delete task: ${id}`, 500);
    }
    logger.info('Publish task deleted', { taskId: id });
  }

  async processAndSubmit(id: string): Promise<PublishTask> {
    const task = await this.getTaskById(id);

    if (task.status !== 'draft') {
      throw new AppError(`Task is not in draft status: ${task.status}`, 400);
    }

    // Update status to pending
    await publishRepository.updateTask(id, { status: 'pending' });

    // Process images for each platform
    if (task.media_type === 'image' && task.original_files.length > 0) {
      const processedFiles: Record<string, string[]> = {};

      for (const file of task.original_files) {
        const processed = await mediaService.processImageForPlatforms(
          file,
          task.target_platforms
        );

        for (const [platform, paths] of Object.entries(processed)) {
          if (!processedFiles[platform]) {
            processedFiles[platform] = [];
          }
          processedFiles[platform].push(...paths);
        }
      }

      await publishRepository.updateTask(id, { processed_files: processedFiles });
    }

    // 处理 website 平台 - 直接保存到 website_contents 表
    if (task.target_platforms.includes('website')) {
      await this.publishToWebsite(task);
    }

    // 其他平台通过 n8n workflow 处理
    const otherPlatforms = task.target_platforms.filter(p => p !== 'website');
    if (otherPlatforms.length > 0) {
      await this.triggerN8nWorkflow(id);
    } else {
      // 如果只有 website 平台，直接标记为完成
      await publishRepository.updateTask(id, { status: 'completed' });
    }

    return await this.getTaskById(id);
  }

  private async publishToWebsite(task: PublishTask): Promise<void> {
    try {
      // 生成 slug (从中文标题生成 URL 友好的 slug)
      const slug = this.generateSlug(task.title_zh || task.title);

      // 确定内容类型
      const contentType = task.media_type === 'video' ? 'video' : 'article';
      const isVideo = task.media_type === 'video';

      // 获取媒体文件 URL
      const baseUrl = process.env.PUBLIC_MEDIA_URL || 'https://dashboard.zenjoymedia.media:3000/media';
      const firstFileUrl = task.original_files.length > 0
        ? `${baseUrl}/${task.original_files[0]}`
        : undefined;

      // 封面图 URL
      const coverImageUrl = task.cover_image
        ? `${baseUrl}/${task.cover_image}`
        : undefined;

      // 视频：video_url 存视频，thumbnail_url 存封面图
      // 图片：thumbnail_url 存第一张图
      const videoUrl = isVideo ? firstFileUrl : undefined;
      const thumbnailUrl = isVideo ? coverImageUrl : firstFileUrl;

      const urls: string[] = [];

      // 创建中文版内容
      const existingZh = await contentsRepository.findBySlugAndLang(slug, 'zh');
      if (existingZh) {
        await contentsRepository.update(existingZh.id, {
          title: task.title_zh || task.title,
          body: task.content_zh || task.content || undefined,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          status: 'published',
          published_at: new Date(),
        });
        logger.info('Website content updated (zh)', { slug, taskId: task.id });
      } else {
        await contentsRepository.create({
          slug,
          title: task.title_zh || task.title,
          body: task.content_zh || task.content || undefined,
          content_type: contentType,
          lang: 'zh',
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          status: 'published',
        });
        logger.info('Website content created (zh)', { slug, taskId: task.id });
      }
      urls.push(`https://zenithjoyai.com/zh/posts/${slug}`);

      // 创建英文版内容（如果有英文标题）
      if (task.title_en) {
        const existingEn = await contentsRepository.findBySlugAndLang(slug, 'en');
        if (existingEn) {
          await contentsRepository.update(existingEn.id, {
            title: task.title_en,
            body: task.content_en || task.content || undefined,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            status: 'published',
            published_at: new Date(),
          });
          logger.info('Website content updated (en)', { slug, taskId: task.id });
        } else {
          await contentsRepository.create({
            slug,
            title: task.title_en,
            body: task.content_en || task.content || undefined,
            content_type: contentType,
            lang: 'en',
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            status: 'published',
          });
          logger.info('Website content created (en)', { slug, taskId: task.id });
        }
        urls.push(`https://zenithjoyai.com/en/posts/${slug}`);
      }

      // 更新任务结果
      await this.updateTaskResult(task.id, 'website', {
        success: true,
        url: urls.join(' | '),
      });

      // 触发网站重建
      await triggerWebsiteRebuild();

    } catch (error: any) {
      logger.error('Failed to publish to website', { taskId: task.id, error: error.message });
      await this.updateTaskResult(task.id, 'website', {
        success: false,
        error: error.message,
      });
    }
  }

  private generateSlug(title: string): string {
    // 将中文标题转为拼音或简单的 hash
    // 简单处理：移除特殊字符，用横线连接
    const timestamp = Date.now().toString(36);
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    return `${cleanTitle}-${timestamp}`;
  }

  private async triggerN8nWorkflow(taskId: string): Promise<void> {
    const n8nWebhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      logger.warn('N8N_PUBLISH_WEBHOOK_URL not configured, skipping workflow trigger');
      await publishRepository.updateTask(taskId, { status: 'processing' });
      return;
    }

    try {
      const task = await this.getTaskById(taskId);

      // 异步触发 n8n workflow，不等待响应（发布过程可能需要几分钟）
      // n8n 完成后会通过 /result 接口回调更新状态
      axios.post(n8nWebhookUrl, {
        taskId: task.id,
        title: task.title,
        content: task.content,
        mediaType: task.media_type,
        originalFiles: task.original_files,
        processedFiles: task.processed_files,
        targetPlatforms: task.target_platforms,
      }, {
        timeout: 5000,  // 5秒超时，只确保请求发出
      }).catch(err => {
        // 忽略超时错误，因为 n8n 可能需要很长时间处理
        if (err.code !== 'ECONNABORTED') {
          logger.error('n8n webhook request failed', { taskId, error: err.message });
        }
      });

      await publishRepository.updateTask(taskId, { status: 'processing' });

      logger.info('Triggered n8n publish workflow', { taskId });
    } catch (error: any) {
      logger.error('Failed to trigger n8n workflow', {
        taskId,
        error: error.message,
      });

      await publishRepository.updateTask(taskId, {
        status: 'failed',
        results: { _error: { success: false, error: error.message } },
      });

      throw new AppError('Failed to trigger publish workflow', 500);
    }
  }

  async updateTaskResult(
    taskId: string,
    platform: string,
    result: { success: boolean; url?: string; error?: string }
  ): Promise<PublishTask> {
    const task = await this.getTaskById(taskId);
    const previousStatus = task.status;

    const results = { ...task.results, [platform]: result };
    await publishRepository.updateTask(taskId, { results });

    // Check if all platforms are done
    const completedCount = Object.keys(results).length;
    const totalPlatforms = task.target_platforms.length;

    if (completedCount >= totalPlatforms) {
      const successCount = Object.values(results).filter(r => r.success).length;
      let status: string;

      if (successCount === totalPlatforms) {
        status = 'completed';
      } else if (successCount === 0) {
        status = 'failed';
      } else {
        status = 'partial';
      }

      await publishRepository.updateTask(taskId, { status });

      // 状态变更为最终态时，发送飞书通知（异步，不阻塞）
      if (previousStatus === 'processing') {
        const updatedTask = await this.getTaskById(taskId);
        // 不等待通知完成，直接继续
        sendFeishuNotification(updatedTask).catch(err => {
          logger.error('Feishu notification async error', { taskId, error: err.message });
        });
      }
    }

    return await this.getTaskById(taskId);
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPlatform: Record<string, { total: number; success: number; failed: number }>;
    recentTrend: Array<{ date: string; success: number; failed: number }>;
  }> {
    return await publishRepository.getStats();
  }

  async getTaskLogs(taskId: string): Promise<Array<{
    id: string;
    taskId: string;
    platform: string;
    action: string;
    status: string;
    message: string | null;
    createdAt: Date;
  }>> {
    const task = await this.getTaskById(taskId);
    const logs = await publishRepository.getTaskLogs(taskId);

    return logs.map(log => ({
      id: log.id,
      taskId: log.task_id,
      platform: log.platform,
      action: log.action,
      status: log.status,
      message: log.message,
      createdAt: log.created_at,
    }));
  }

  async retryPlatform(taskId: string, platform: string): Promise<PublishTask> {
    const task = await this.getTaskById(taskId);

    // 验证状态
    if (!['completed', 'failed', 'partial'].includes(task.status)) {
      throw new AppError(`Can only retry in completed/failed/partial status, current: ${task.status}`, 400);
    }

    // 验证平台存在
    if (!task.target_platforms.includes(platform)) {
      throw new AppError(`Platform ${platform} not in target platforms`, 400);
    }

    // 清除该平台的结果
    const results = { ...task.results };
    delete results[platform];

    await publishRepository.updateTask(taskId, {
      results,
      status: 'processing', // 重新设为处理中
    });

    logger.info('Retrying platform', { taskId, platform });

    // 重新触发工作流（只针对该平台）
    if (platform === 'website') {
      await this.publishToWebsite(task);
    } else {
      await this.triggerN8nWorkflow(taskId);
    }

    return await this.getTaskById(taskId);
  }

  async copyTask(taskId: string, userId?: number): Promise<PublishTask> {
    const source = await this.getTaskById(taskId);

    // 创建副本
    const copied = await this.createTask({
      titleZh: source.title_zh,
      titleEn: source.title_en,
      contentZh: source.content_zh || undefined,
      contentEn: source.content_en || undefined,
      mediaType: source.media_type,
      originalFiles: source.original_files,
      coverImage: source.cover_image || undefined,
      targetPlatforms: source.target_platforms,
      createdBy: userId,
    });

    logger.info('Task copied', { sourceId: taskId, newId: copied.id });
    return copied;
  }

  async batchOperation(action: 'delete' | 'submit', ids: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        if (action === 'delete') {
          await this.deleteTask(id);
        } else if (action === 'submit') {
          await this.processAndSubmit(id);
        }
        results.push({ id, success: true });
        successCount++;
      } catch (error: any) {
        results.push({ id, success: false, error: error.message });
        failedCount++;
        logger.error(`Batch ${action} failed for task ${id}`, { error: error.message });
      }
    }

    logger.info('Batch operation completed', {
      action,
      total: ids.length,
      success: successCount,
      failed: failedCount,
    });

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  formatTaskForApi(task: PublishTask & { creator_name?: string; creator_avatar?: string }): any {
    // Calculate progress
    const totalPlatforms = task.target_platforms.length;
    const completedPlatforms = Object.keys(task.results || {}).length;
    const successPlatforms = Object.values(task.results || {}).filter(r => r.success).length;

    return {
      id: task.id,
      title: task.title,
      titleZh: task.title_zh,
      titleEn: task.title_en,
      content: task.content,
      contentZh: task.content_zh,
      contentEn: task.content_en,
      mediaType: task.media_type,
      originalFiles: task.original_files,
      coverImage: task.cover_image,
      processedFiles: task.processed_files,
      targetPlatforms: task.target_platforms,
      status: task.status,
      scheduleAt: task.schedule_at,
      results: task.results,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      createdBy: task.created_by,
      creatorName: task.creator_name || null,
      creatorAvatar: task.creator_avatar || null,
      // Progress info
      progress: {
        total: totalPlatforms,
        completed: completedPlatforms,
        success: successPlatforms,
        failed: completedPlatforms - successPlatforms,
      },
    };
  }
}

export const publishService = new PublishService();
export default publishService;
