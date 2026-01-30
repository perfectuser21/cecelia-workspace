/**
 * Planning Engine - Phase 5.2
 *
 * Generates daily/weekly plans based on:
 * - Current OKR/Goals
 * - Task priorities (P0, P1, P2)
 * - Task status (pending, in_progress)
 * - Memory context (working + longterm)
 */

import pool from '../task-system/db.js';
import { writeMemory, readMemory, queryMemory } from './memory.js';

// Plan scope types
export type PlanScope = 'daily' | 'weekly';

// Plan task interface
export interface PlanTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  estimated_hours?: number;
  goal_id?: string;
  goal_title?: string;
  depends_on: string[];
}

// Generated plan interface
export interface GeneratedPlan {
  plan_id: string;
  scope: PlanScope;
  created_at: string;
  tasks: PlanTask[];
  summary: {
    total: number;
    by_priority: Record<string, number>;
  };
  reasoning: string;
}

// Plan status interface
export interface PlanStatus {
  active_plan: string | null;
  plan: GeneratedPlan | null;
  progress: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
  };
  next_task: PlanTask | null;
}

/**
 * Get current date string for plan ID
 */
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Fetch all active goals with their progress
 */
async function fetchGoals(): Promise<Array<{ id: string; title: string; priority: string; progress: number }>> {
  try {
    const result = await pool.query(`
      SELECT id, title, priority, progress
      FROM goals
      WHERE status != 'completed'
      ORDER BY
        CASE priority
          WHEN 'P0' THEN 1
          WHEN 'P1' THEN 2
          WHEN 'P2' THEN 3
          ELSE 4
        END,
        progress DESC
    `);
    return result.rows.map((row: { id: unknown; title: string; priority: string; progress: number }) => ({
      id: String(row.id),
      title: row.title,
      priority: row.priority || 'P2',
      progress: row.progress || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch tasks for planning
 */
async function fetchTasks(): Promise<PlanTask[]> {
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.priority, t.status, t.goal_id, g.title as goal_title
      FROM tasks t
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.status IN ('pending', 'in_progress')
      ORDER BY
        CASE t.priority
          WHEN 'P0' THEN 1
          WHEN 'P1' THEN 2
          WHEN 'P2' THEN 3
          ELSE 4
        END,
        t.created_at ASC
    `);
    return result.rows.map((row: { id: unknown; title: string; priority: string; status: string; goal_id: unknown; goal_title: string }) => ({
      id: String(row.id),
      title: row.title,
      priority: row.priority || 'P2',
      status: row.status,
      goal_id: row.goal_id ? String(row.goal_id) : undefined,
      goal_title: row.goal_title || undefined,
      depends_on: [],
    }));
  } catch {
    return [];
  }
}

/**
 * Read context from memory
 */
async function readContext(): Promise<{ focus: string | null; preferences: Record<string, unknown> }> {
  // Read current focus from working memory
  const focusEntry = await readMemory('current_focus');
  const focus = focusEntry?.value?.focus as string || null;

  // Read preferences from longterm memory
  const preferences: Record<string, unknown> = {};
  const prefEntries = await queryMemory({ layer: 'longterm', category: 'preference' });
  for (const entry of prefEntries) {
    preferences[entry.key] = entry.value;
  }

  return { focus, preferences };
}

/**
 * Generate a daily or weekly plan
 */
export async function generatePlan(scope: PlanScope = 'daily'): Promise<GeneratedPlan> {
  const dateStr = getDateString();
  const planId = `plan_${scope}_${dateStr}`;

  // Fetch data
  const [goals, tasks, context] = await Promise.all([
    fetchGoals(),
    fetchTasks(),
    readContext(),
  ]);

  // Filter tasks based on scope
  // Daily: P0 + top P1 tasks (max 8)
  // Weekly: All P0, P1 + some P2 (max 20)
  let filteredTasks: PlanTask[];
  let maxTasks: number;

  if (scope === 'daily') {
    maxTasks = 8;
    // Prioritize P0, then P1
    const p0Tasks = tasks.filter(t => t.priority === 'P0');
    const p1Tasks = tasks.filter(t => t.priority === 'P1');
    filteredTasks = [...p0Tasks, ...p1Tasks].slice(0, maxTasks);
  } else {
    maxTasks = 20;
    const p0Tasks = tasks.filter(t => t.priority === 'P0');
    const p1Tasks = tasks.filter(t => t.priority === 'P1');
    const p2Tasks = tasks.filter(t => t.priority === 'P2');
    filteredTasks = [...p0Tasks, ...p1Tasks, ...p2Tasks].slice(0, maxTasks);
  }

  // Count by priority
  const byPriority: Record<string, number> = {};
  for (const task of filteredTasks) {
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
  }

  // Generate reasoning
  const reasoningParts: string[] = [];
  if (goals.length > 0) {
    const topGoal = goals[0];
    reasoningParts.push(`当前最高优先级目标: ${topGoal.title} (${topGoal.priority}, ${topGoal.progress}% 完成)`);
  }
  if (context.focus) {
    reasoningParts.push(`当前焦点: ${context.focus}`);
  }
  reasoningParts.push(`选取了 ${filteredTasks.length} 个任务: P0=${byPriority['P0'] || 0}, P1=${byPriority['P1'] || 0}, P2=${byPriority['P2'] || 0}`);

  const plan: GeneratedPlan = {
    plan_id: planId,
    scope,
    created_at: new Date().toISOString(),
    tasks: filteredTasks,
    summary: {
      total: filteredTasks.length,
      by_priority: byPriority,
    },
    reasoning: reasoningParts.join('. '),
  };

  // Store plan in working memory
  await writeMemory({
    layer: 'working',
    category: 'state',
    key: planId,
    value: plan as unknown as Record<string, unknown>,
    source: 'system',
  });

  // Update current plan reference
  await writeMemory({
    layer: 'working',
    category: 'context',
    key: 'current_plan',
    value: { plan_id: planId, scope, created_at: plan.created_at },
    source: 'system',
  });

  return plan;
}

/**
 * Get current plan status
 */
export async function getPlanStatus(): Promise<PlanStatus> {
  // Read current plan reference
  const currentPlanEntry = await readMemory('current_plan');

  if (!currentPlanEntry) {
    return {
      active_plan: null,
      plan: null,
      progress: { total: 0, completed: 0, in_progress: 0, pending: 0 },
      next_task: null,
    };
  }

  const planId = currentPlanEntry.value.plan_id as string;

  // Read the actual plan
  const planEntry = await readMemory(planId);

  if (!planEntry) {
    return {
      active_plan: planId,
      plan: null,
      progress: { total: 0, completed: 0, in_progress: 0, pending: 0 },
      next_task: null,
    };
  }

  const plan = planEntry.value as unknown as GeneratedPlan;

  // Get current task statuses from database
  const taskIds = plan.tasks.map(t => t.id);
  const taskStatuses: Record<string, string> = {};

  if (taskIds.length > 0) {
    try {
      const result = await pool.query(
        'SELECT id, status FROM tasks WHERE id = ANY($1)',
        [taskIds]
      );
      for (const row of result.rows) {
        taskStatuses[String(row.id)] = row.status;
      }
    } catch {
      // Use original statuses from plan
      for (const task of plan.tasks) {
        taskStatuses[task.id] = task.status;
      }
    }
  }

  // Calculate progress
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let nextTask: PlanTask | null = null;

  for (const task of plan.tasks) {
    const currentStatus = taskStatuses[task.id] || task.status;
    if (currentStatus === 'completed') {
      completed++;
    } else if (currentStatus === 'in_progress') {
      inProgress++;
      if (!nextTask) nextTask = { ...task, status: currentStatus };
    } else {
      pending++;
      if (!nextTask) nextTask = { ...task, status: currentStatus };
    }
  }

  return {
    active_plan: planId,
    plan,
    progress: {
      total: plan.tasks.length,
      completed,
      in_progress: inProgress,
      pending,
    },
    next_task: nextTask,
  };
}

/**
 * Get plan by ID
 */
export async function getPlan(planId: string): Promise<GeneratedPlan | null> {
  const planEntry = await readMemory(planId);
  if (!planEntry) return null;
  return planEntry.value as unknown as GeneratedPlan;
}
