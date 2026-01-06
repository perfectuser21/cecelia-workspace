/**
 * AI Factory v3.0 类型定义
 */

// ========== 任务相关 ==========

export interface TaskInfo {
  id: string;
  name: string;
  codingType: CodingType;
  prompt: string;
  pageUrl: string;
}

export type CodingType =
  | 'Feature'     // 新功能
  | 'Bugfix'      // Bug 修复
  | 'Refactor'    // 重构
  | 'Check'       // 检查任务
  | 'Research'    // 研究任务
  | 'Other';      // 其他

// ========== 执行相关 ==========

export interface ExecutionConfig {
  taskId: string;
  model?: 'opus' | 'sonnet';
  budget?: number;
  maxIterations?: number;
  useRalph?: boolean;
  dryRun?: boolean;
}

export interface ExecutionResult {
  taskId: string;
  taskName: string;
  codingType: CodingType;
  executionResult: 'success' | 'failed' | 'timeout' | 'error';
  finalStatus: FinalStatus;
  hasConflict: boolean;
  worktreePath: string;
  model: string;
  useRalph: boolean;
  timestamp: string;
  iterations?: number;
  duration?: number;
}

export type FinalStatus =
  | 'AI Done'       // 成功完成并合并
  | 'AI Failed'     // 执行失败
  | 'AI Conflict'   // 合并冲突
  | 'AI Merged';    // 已合并（旧状态）

// ========== Worktree 相关 ==========

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  taskId: string;
}

export interface WorktreeListResult {
  worktrees: WorktreeInfo[];
  count: number;
}

// ========== API 请求/响应 ==========

export interface ExecuteTaskRequest {
  taskId: string;
  model?: 'opus' | 'sonnet';
  budget?: number;
  dryRun?: boolean;
}

export interface ExecuteTaskResponse {
  success: boolean;
  message: string;
  result?: ExecutionResult;
  error?: string;
}

export interface ListWorktreesResponse {
  success: boolean;
  worktrees: WorktreeInfo[];
  count: number;
}

export interface CleanupWorktreeRequest {
  taskId: string;
  deleteBranch?: boolean;
}

export interface CleanupWorktreeResponse {
  success: boolean;
  message: string;
  error?: string;
}

// ========== 脚本路径配置 ==========

export interface ScriptPaths {
  scriptsDir: string;
  executor: string;
  prepare: string;
  cleanup: string;
  worktreeManager: string;
  config: string;
  utils: string;
}
