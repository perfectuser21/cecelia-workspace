/**
 * Tasks 路由
 *
 * API 端点：
 * - GET  /api/tasks          - 查询任务列表
 * - GET  /api/tasks/users    - 获取用户列表
 * - PATCH /api/tasks/:id     - 更新任务完成状态
 * - POST /api/tasks          - 创建新任务
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { queryTasks, updateTaskDone, updateTaskDue, createTask, getUsers } from './tasks.service';
import { config } from '../../shared/utils/config';

const router = Router();

// ========== Rate Limiter ==========
// 防止滥用：每分钟最多 60 次请求
const tasksLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(tasksLimiter);

// ========== 配置检查中间件 ==========
const checkNotionConfig = (req: Request, res: Response, next: Function) => {
  if (!config.notion.apiKey) {
    return res.status(500).json({ error: 'Notion API key not configured' });
  }
  if (!config.notion.tasksDbId) {
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const { name, range, includeDone, includeNoDue } = req.query;

    // 参数校验
    const validRanges = ['today', 'week', 'all'];
    if (range && !validRanges.includes(range as string)) {
      return res.status(400).json({
        error: `Invalid range. Must be one of: ${validRanges.join(', ')}`,
      });
    }

    const tasks = await queryTasks({
      name: name as string | undefined,
      range: (range as 'today' | 'week' | 'all') || 'all',
      includeDone: includeDone === 'true',
      includeNoDue: includeNoDue === 'true',
    });

    res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error('[Tasks] Query error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to query tasks',
    });
  }
});

// ========== GET /api/tasks/users ==========
// 获取用户列表（用于前端下拉选择器）
router.get('/users', (req: Request, res: Response) => {
  const users = getUsers();
  res.json({ success: true, users });
});

// ========== PATCH /api/tasks/:id ==========
// 更新任务状态或日期
// Body: { done?: boolean, due?: string }
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { done, due } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    let task;

    // 更新完成状态
    if (typeof done === 'boolean') {
      task = await updateTaskDone(id, done);
    }
    // 更新截止日期
    else if (due !== undefined) {
      if (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        return res.status(400).json({ error: 'due must be in YYYY-MM-DD format or null' });
      }
      task = await updateTaskDue(id, due);
    }
    else {
      return res.status(400).json({ error: 'Must provide done or due field' });
    }

    res.json({
      success: true,
      task,
    });
  } catch (error: any) {
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
router.post('/', async (req: Request, res: Response) => {
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

    const task = await createTask({
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
  } catch (error: any) {
    console.error('[Tasks] Create error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create task',
    });
  }
});

export default router;
