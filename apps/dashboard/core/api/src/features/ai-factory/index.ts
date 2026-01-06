/**
 * AI Factory v3.0 模块入口
 *
 * 自动化任务执行系统，支持：
 * - Git Worktree 并行任务隔离
 * - Notion 任务集成
 * - Claude Code 自动执行
 * - 自动合并与冲突处理
 */

import { Router } from 'express';
import aiFactoryRoute from './ai-factory.route';

export const router: Router = aiFactoryRoute;
export const basePath = '/v1/ai-factory';
export const requiresAuth = true; // 需要 API Key 认证

// Export service for cross-module dependencies
export { aiFactoryService } from './ai-factory.service';

// Export types
export * from './ai-factory.types';
