"use strict";
/**
 * Tasks 路由
 *
 * API 端点：
 * - GET  /api/tasks          - 查询任务列表
 * - GET  /api/tasks/users    - 获取用户列表
 * - PATCH /api/tasks/:id     - 更新任务完成状态
 * - POST /api/tasks          - 创建新任务
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const tasks_service_1 = require("./tasks.service");
const config_1 = require("../../shared/utils/config");
const router = (0, express_1.Router)();
// ========== Rate Limiter ==========
// 防止滥用：每分钟最多 60 次请求
const tasksLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 分钟
    max: 60,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(tasksLimiter);
// ========== 配置检查中间件 ==========
const checkNotionConfig = (req, res, next) => {
    if (!config_1.config.notion.apiKey) {
        return res.status(500).json({ error: 'Notion API key not configured' });
    }
    if (!config_1.config.notion.tasksDbId) {
        return res.status(500).json({ error: 'Notion Tasks database ID not configured' });
    }
    next();
};
router.use(checkNotionConfig);
// ========== GET /api/tasks ==========
// 查询任务列表
// Query params:
//   - name: 负责人名称（模糊匹配）
//   - range: today | week | all（默认 all）
//   - includeDone: true | false（默认 false）
//   - includeNoDue: true | false（默认 false）
router.get('/', async (req, res) => {
    try {
        const { name, range, includeDone, includeNoDue } = req.query;
        // 参数校验
        const validRanges = ['today', 'week', 'all'];
        if (range && !validRanges.includes(range)) {
            return res.status(400).json({
                error: `Invalid range. Must be one of: ${validRanges.join(', ')}`,
            });
        }
        const tasks = await (0, tasks_service_1.queryTasks)({
            name: name,
            range: range || 'all',
            includeDone: includeDone === 'true',
            includeNoDue: includeNoDue === 'true',
        });
        res.json({
            success: true,
            tasks,
            count: tasks.length,
        });
    }
    catch (error) {
        console.error('[Tasks] Query error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to query tasks',
        });
    }
});
// ========== GET /api/tasks/users ==========
// 获取用户列表（用于前端下拉选择器）
router.get('/users', (req, res) => {
    const users = (0, tasks_service_1.getUsers)();
    res.json({ success: true, users });
});
// ========== PATCH /api/tasks/:id ==========
// 更新任务状态或日期
// Body: { done?: boolean, due?: string }
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { done, due } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Task ID is required' });
        }
        let task;
        // 更新完成状态
        if (typeof done === 'boolean') {
            task = await (0, tasks_service_1.updateTaskDone)(id, done);
        }
        // 更新截止日期
        else if (due !== undefined) {
            if (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
                return res.status(400).json({ error: 'due must be in YYYY-MM-DD format or null' });
            }
            task = await (0, tasks_service_1.updateTaskDue)(id, due);
        }
        else {
            return res.status(400).json({ error: 'Must provide done or due field' });
        }
        res.json({
            success: true,
            task,
        });
    }
    catch (error) {
        console.error('[Tasks] Update error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update task',
        });
    }
});
// ========== POST /api/tasks ==========
// 创建新任务
// Body: { title: string, due?: string (ISO date), assigneeName: string, priority?: string, highlight?: boolean }
router.post('/', async (req, res) => {
    try {
        const { title, due, assigneeName, priority, highlight } = req.body;
        // 参数校验
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'title is required and must be a non-empty string' });
        }
        if (!assigneeName || typeof assigneeName !== 'string') {
            return res.status(400).json({ error: 'assigneeName is required' });
        }
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
            return res.status(400).json({ error: 'due must be in YYYY-MM-DD format' });
        }
        if (priority && !['高', '中', '低'].includes(priority)) {
            return res.status(400).json({ error: 'priority must be one of: 高, 中, 低' });
        }
        const task = await (0, tasks_service_1.createTask)({
            title: title.trim(),
            due: due || undefined,
            assigneeName,
            priority: priority || undefined,
            highlight: highlight === true,
        });
        res.status(201).json({
            success: true,
            task,
        });
    }
    catch (error) {
        console.error('[Tasks] Create error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create task',
        });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.route.js.map