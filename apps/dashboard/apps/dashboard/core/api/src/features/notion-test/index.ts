/**
 * Notion API 重试测试模块入口
 */

import { Router } from 'express';
import notionTestRoute from './notion-test.route';

export const router: Router = notionTestRoute;
export const basePath = '/api/notion-test';
export const requiresAuth = false; // 测试端点不需要认证

export * from './notion-test.service';
export * from './notion-test.types';
