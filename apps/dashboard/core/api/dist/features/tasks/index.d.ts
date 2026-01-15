/**
 * Tasks 模块入口
 *
 * 个人任务面板 - 对接 Notion 任务库
 * 支持按用户查看/勾选/新增任务
 */
import { Router } from 'express';
export declare const router: Router;
export declare const basePath = "/api/tasks";
export declare const requiresAuth = true;
export * from './tasks.service';
export { TASKS_CONFIG } from './tasks.config';
//# sourceMappingURL=index.d.ts.map