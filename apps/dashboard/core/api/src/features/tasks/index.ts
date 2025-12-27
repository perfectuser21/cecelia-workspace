/**
 * Tasks 模块入口
 *
 * 个人任务面板 - 对接 Notion 任务库
 * 支持按用户查看/勾选/新增任务
 */

import { Router } from 'express';
import tasksRoute from './tasks.route';

export const router: Router = tasksRoute;
export const basePath = '/api/tasks';
export const requiresAuth = true; // 需要 API Key 认证

export * from './tasks.service';
export { TASKS_CONFIG } from './tasks.config';
