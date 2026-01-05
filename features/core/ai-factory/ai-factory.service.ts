/**
 * AI Factory v3.0 Service
 *
 * 封装 bash 脚本调用，提供 TypeScript 接口
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import logger from '../../../shared/utils/logger';
import {
  ExecutionConfig,
  ExecutionResult,
  WorktreeInfo,
  TaskInfo,
  ScriptPaths,
} from './ai-factory.types';

const execAsync = promisify(exec);

// ========== 脚本路径 ==========

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

const SCRIPTS: ScriptPaths = {
  scriptsDir: SCRIPTS_DIR,
  executor: path.join(SCRIPTS_DIR, 'executor.sh'),
  prepare: path.join(SCRIPTS_DIR, 'prepare.sh'),
  cleanup: path.join(SCRIPTS_DIR, 'cleanup.sh'),
  worktreeManager: path.join(SCRIPTS_DIR, 'worktree-manager.sh'),
  config: path.join(SCRIPTS_DIR, 'config.sh'),
  utils: path.join(SCRIPTS_DIR, 'utils.sh'),
};

// ========== 辅助函数 ==========

/**
 * 检查脚本是否存在且可执行
 */
function checkScriptExists(scriptPath: string): boolean {
  try {
    fs.accessSync(scriptPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 执行 bash 脚本并返回输出
 */
async function runScript(
  script: string,
  args: string[] = [],
  timeout: number = 600000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [script, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env },
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ========== 公开 API ==========

class AIFactoryService {
  /**
   * 验证所有脚本是否存在
   */
  validateScripts(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const [name, scriptPath] of Object.entries(SCRIPTS)) {
      if (name === 'scriptsDir') continue;
      if (!checkScriptExists(scriptPath)) {
        missing.push(name);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * 执行任务（完整流程：准备 → 执行 → 清理）
   */
  async executeTask(config: ExecutionConfig): Promise<ExecutionResult> {
    const {
      taskId,
      model = 'opus',
      budget = 100,
      maxIterations = 10,
      useRalph = false,
      dryRun = false,
    } = config;

    logger.info(`[AI Factory] Starting task: ${taskId}`);
    logger.info(`[AI Factory] Model: ${model}, Budget: ${budget}, Ralph: ${useRalph}`);

    const args = [
      taskId,
      '--model', model,
      '--budget', budget.toString(),
      '--max-iterations', maxIterations.toString(),
    ];

    if (useRalph) {
      args.push('--use-ralph');
    }

    if (dryRun) {
      args.push('--dry-run');
    }

    try {
      const result = await runScript(SCRIPTS.executor, args, 1800000); // 30 分钟超时

      // 解析输出中的 JSON 结果
      const jsonMatch = result.stdout.match(/\{[\s\S]*"task_id"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          taskId: parsed.task_id,
          taskName: parsed.task_name,
          codingType: parsed.coding_type,
          executionResult: parsed.execution_result,
          finalStatus: parsed.final_status,
          hasConflict: parsed.has_conflict,
          worktreePath: parsed.worktree_path,
          model: parsed.model,
          useRalph: parsed.use_ralph,
          timestamp: parsed.timestamp,
          iterations: parsed.iterations,
          duration: parsed.duration,
        };
      }

      throw new Error('Failed to parse execution result');
    } catch (error: any) {
      logger.error(`[AI Factory] Task failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 准备任务（创建 worktree、生成 prompt）
   */
  async prepareTask(taskId: string): Promise<{ worktreePath: string; promptPath: string; taskInfo: TaskInfo }> {
    logger.info(`[AI Factory] Preparing task: ${taskId}`);

    const result = await runScript(SCRIPTS.prepare, [taskId]);

    if (result.exitCode !== 0) {
      throw new Error(`Prepare failed: ${result.stderr}`);
    }

    // 解析输出
    const jsonMatch = result.stdout.match(/\{[\s\S]*"worktree_path"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        worktreePath: parsed.worktree_path,
        promptPath: parsed.prompt_path,
        taskInfo: {
          id: parsed.task_id,
          name: parsed.task_name,
          codingType: parsed.coding_type,
          prompt: parsed.prompt,
          pageUrl: parsed.page_url,
        },
      };
    }

    throw new Error('Failed to parse prepare result');
  }

  /**
   * 清理任务（处理结果、合并、通知）
   */
  async cleanupTask(
    taskId: string,
    executionResult: 'success' | 'failed' | 'timeout'
  ): Promise<{ finalStatus: string; hasConflict: boolean }> {
    logger.info(`[AI Factory] Cleaning up task: ${taskId}, result: ${executionResult}`);

    const result = await runScript(SCRIPTS.cleanup, [taskId, executionResult]);

    // 解析输出
    const jsonMatch = result.stdout.match(/\{[\s\S]*"final_status"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        finalStatus: parsed.final_status,
        hasConflict: parsed.has_conflict,
      };
    }

    throw new Error('Failed to parse cleanup result');
  }

  /**
   * 列出所有活跃的 worktree
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    const result = await runScript(SCRIPTS.worktreeManager, ['list']);

    if (result.exitCode !== 0) {
      throw new Error(`List worktrees failed: ${result.stderr}`);
    }

    try {
      const worktrees = JSON.parse(result.stdout.trim());
      return worktrees;
    } catch {
      return [];
    }
  }

  /**
   * 创建 worktree
   */
  async createWorktree(taskId: string): Promise<string> {
    const result = await runScript(SCRIPTS.worktreeManager, ['create', taskId]);

    if (result.exitCode !== 0) {
      throw new Error(`Create worktree failed: ${result.stderr}`);
    }

    // 从输出中提取路径
    const pathMatch = result.stdout.match(/^\/home\/[^\s]+/m);
    if (pathMatch) {
      return pathMatch[0];
    }

    throw new Error('Failed to get worktree path');
  }

  /**
   * 删除 worktree
   */
  async cleanupWorktree(taskId: string, deleteBranch: boolean = true): Promise<void> {
    const result = await runScript(SCRIPTS.worktreeManager, [
      'cleanup',
      taskId,
      deleteBranch ? 'true' : 'false',
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Cleanup worktree failed: ${result.stderr}`);
    }
  }

  /**
   * 检查潜在冲突文件
   */
  async checkConflicts(branchName: string): Promise<string[]> {
    const result = await runScript(SCRIPTS.worktreeManager, ['conflict-check', branchName]);

    if (result.exitCode !== 0) {
      return [];
    }

    return result.stdout.trim().split('\n').filter(Boolean);
  }

  /**
   * 获取脚本路径配置
   */
  getScriptPaths(): ScriptPaths {
    return { ...SCRIPTS };
  }
}

// 导出单例
export const aiFactoryService = new AIFactoryService();
