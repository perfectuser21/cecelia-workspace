/**
 * AI Factory v3.0 路由
 *
 * API 端点：
 * - POST   /v1/ai-factory/execute     - 执行任务
 * - GET    /v1/ai-factory/worktrees   - 列出活跃 worktree
 * - DELETE /v1/ai-factory/worktrees/:taskId - 清理 worktree
 * - GET    /v1/ai-factory/health      - 健康检查
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { aiFactoryService } from './ai-factory.service';
import {
  ExecuteTaskRequest,
  CleanupWorktreeRequest,
} from './ai-factory.types';

const router = Router();

// ========== Rate Limiter ==========
// 防止滥用：每分钟最多 10 次执行请求
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many execution requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== GET /v1/ai-factory/health ==========
// 健康检查：验证脚本是否存在
router.get('/health', (req: Request, res: Response) => {
  const validation = aiFactoryService.validateScripts();

  if (validation.valid) {
    res.json({
      success: true,
      status: 'healthy',
      scripts: aiFactoryService.getScriptPaths(),
    });
  } else {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      missing: validation.missing,
    });
  }
});

// ========== POST /v1/ai-factory/execute ==========
// 执行任务（异步启动，立即返回）
router.post('/execute', executeLimiter, async (req: Request, res: Response) => {
  try {
    const { taskId, model, budget, dryRun } = req.body as ExecuteTaskRequest;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId is required',
      });
    }

    // 验证 model 参数
    if (model && !['opus', 'sonnet'].includes(model)) {
      return res.status(400).json({
        success: false,
        error: 'model must be "opus" or "sonnet"',
      });
    }

    // 异步执行任务（不阻塞响应）
    // 注意：实际的长时间任务应该通过消息队列或后台进程处理
    const executePromise = aiFactoryService.executeTask({
      taskId,
      model: model || 'opus',
      budget: budget || 100,
      dryRun: dryRun || false,
    });

    // 如果 dryRun，等待结果
    if (dryRun) {
      const result = await executePromise;
      return res.json({
        success: true,
        message: 'Dry run completed',
        result,
      });
    }

    // 否则立即返回，后台执行
    res.json({
      success: true,
      message: 'Task execution started',
      taskId,
      note: 'Task is running in background. Check Notion for status updates.',
    });

    // 后台继续执行
    executePromise.catch((err) => {
      console.error(`[AI Factory] Background execution failed: ${err.message}`);
    });
  } catch (error: any) {
    console.error('[AI Factory] Execute error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start task execution',
    });
  }
});

// ========== GET /v1/ai-factory/worktrees ==========
// 列出所有活跃的 worktree
router.get('/worktrees', async (req: Request, res: Response) => {
  try {
    const worktrees = await aiFactoryService.listWorktrees();

    res.json({
      success: true,
      worktrees,
      count: worktrees.length,
    });
  } catch (error: any) {
    console.error('[AI Factory] List worktrees error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list worktrees',
    });
  }
});

// ========== DELETE /v1/ai-factory/worktrees/:taskId ==========
// 清理指定的 worktree
router.delete('/worktrees/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { deleteBranch } = req.query as { deleteBranch?: string };

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId is required',
      });
    }

    await aiFactoryService.cleanupWorktree(
      taskId,
      deleteBranch !== 'false' // 默认删除分支
    );

    res.json({
      success: true,
      message: `Worktree cleaned up: ${taskId}`,
    });
  } catch (error: any) {
    console.error('[AI Factory] Cleanup worktree error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup worktree',
    });
  }
});

// ========== POST /v1/ai-factory/prepare ==========
// 仅准备任务（创建 worktree、生成 prompt），不执行
router.post('/prepare', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId is required',
      });
    }

    const result = await aiFactoryService.prepareTask(taskId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[AI Factory] Prepare error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to prepare task',
    });
  }
});

// ========== GET /v1/ai-factory/conflicts/:branch ==========
// 检查潜在冲突文件
router.get('/conflicts/:branch', async (req: Request, res: Response) => {
  try {
    const { branch } = req.params;

    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'branch is required',
      });
    }

    const files = await aiFactoryService.checkConflicts(branch);

    res.json({
      success: true,
      branch,
      conflictFiles: files,
      count: files.length,
    });
  } catch (error: any) {
    console.error('[AI Factory] Check conflicts error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check conflicts',
    });
  }
});

export default router;
