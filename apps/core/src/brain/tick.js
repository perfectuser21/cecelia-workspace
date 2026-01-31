/**
 * Action Loop - Tick Mechanism
 * Implements automatic task progression through periodic ticks
 */

import pool from '../task-system/db.js';
import { getDailyFocus } from './focus.js';
import { updateTask } from './actions.js';
import { triggerCeceliaRun, checkCeceliaRunAvailable } from './executor.js';
import { compareGoalProgress, generateDecision, executeDecision } from './decision.js';

// Tick configuration
const TICK_INTERVAL_MINUTES = 5;
const STALE_THRESHOLD_HOURS = 24; // Tasks in_progress for more than 24h are stale
const AUTO_EXECUTE_CONFIDENCE = 0.8; // Auto-execute decisions with confidence >= this

// Working memory keys
const TICK_ENABLED_KEY = 'tick_enabled';
const TICK_LAST_KEY = 'tick_last';
const TICK_ACTIONS_TODAY_KEY = 'tick_actions_today';

/**
 * Get tick status
 */
async function getTickStatus() {
  const result = await pool.query(`
    SELECT key, value_json FROM working_memory
    WHERE key IN ($1, $2, $3)
  `, [TICK_ENABLED_KEY, TICK_LAST_KEY, TICK_ACTIONS_TODAY_KEY]);

  const memory = {};
  for (const row of result.rows) {
    memory[row.key] = row.value_json;
  }

  const enabled = memory[TICK_ENABLED_KEY]?.enabled ?? false;
  const lastTick = memory[TICK_LAST_KEY]?.timestamp || null;
  const actionsToday = memory[TICK_ACTIONS_TODAY_KEY]?.count || 0;

  // Calculate next tick time
  let nextTick = null;
  if (enabled && lastTick) {
    const lastTickDate = new Date(lastTick);
    nextTick = new Date(lastTickDate.getTime() + TICK_INTERVAL_MINUTES * 60 * 1000).toISOString();
  } else if (enabled) {
    nextTick = new Date(Date.now() + TICK_INTERVAL_MINUTES * 60 * 1000).toISOString();
  }

  return {
    enabled,
    interval_minutes: TICK_INTERVAL_MINUTES,
    last_tick: lastTick,
    next_tick: nextTick,
    actions_today: actionsToday
  };
}

/**
 * Enable automatic tick
 */
async function enableTick() {
  await pool.query(`
    INSERT INTO working_memory (key, value_json, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value_json = $2, updated_at = NOW()
  `, [TICK_ENABLED_KEY, { enabled: true }]);

  return { success: true, enabled: true };
}

/**
 * Disable automatic tick
 */
async function disableTick() {
  await pool.query(`
    INSERT INTO working_memory (key, value_json, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value_json = $2, updated_at = NOW()
  `, [TICK_ENABLED_KEY, { enabled: false }]);

  return { success: true, enabled: false };
}

/**
 * Check if a task is stale (in_progress for too long)
 */
function isStale(task) {
  if (task.status !== 'in_progress') return false;
  if (!task.started_at) return false;

  const startedAt = new Date(task.started_at);
  const hoursElapsed = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
  return hoursElapsed > STALE_THRESHOLD_HOURS;
}

/**
 * Log a decision internally
 */
async function logTickDecision(trigger, inputSummary, decision, result) {
  await pool.query(`
    INSERT INTO decision_log (trigger, input_summary, llm_output_json, action_result_json, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    trigger,
    inputSummary,
    decision,
    result,
    result?.success ? 'success' : 'failed'
  ]);
}

/**
 * Update actions count for today
 */
async function incrementActionsToday(count = 1) {
  const today = new Date().toISOString().split('T')[0];

  // Get current count
  const result = await pool.query(
    'SELECT value_json FROM working_memory WHERE key = $1',
    [TICK_ACTIONS_TODAY_KEY]
  );

  const current = result.rows[0]?.value_json || { date: today, count: 0 };

  // Reset if new day
  const newCount = current.date === today ? current.count + count : count;

  await pool.query(`
    INSERT INTO working_memory (key, value_json, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value_json = $2, updated_at = NOW()
  `, [TICK_ACTIONS_TODAY_KEY, { date: today, count: newCount }]);

  return newCount;
}

/**
 * Execute a tick - the core self-driving loop
 *
 * 1. Compare goal progress (Decision Engine)
 * 2. Generate and execute high-confidence decisions
 * 3. Get daily focus OKR
 * 4. Check related task status
 * 5. Decide next action
 * 6. Execute action via cecelia-run
 * 7. Log decision
 */
async function executeTick() {
  const actionsTaken = [];
  const now = new Date();
  let decisionEngineResult = null;

  // 1. Decision Engine: Compare goal progress
  try {
    const comparison = await compareGoalProgress();

    // Log comparison result
    await logTickDecision(
      'tick',
      `Goal comparison: ${comparison.overall_health}, ${comparison.goals.length} goals analyzed`,
      { action: 'compare_goals', overall_health: comparison.overall_health },
      { success: true, goals_analyzed: comparison.goals.length }
    );

    // 2. Generate decision if there are issues
    if (comparison.overall_health !== 'healthy' || comparison.next_actions.length > 0) {
      const decision = await generateDecision({ trigger: 'tick' });

      await logTickDecision(
        'tick',
        `Decision generated: ${decision.actions.length} actions, confidence: ${decision.confidence}`,
        { action: 'generate_decision', decision_id: decision.decision_id },
        { success: true, confidence: decision.confidence }
      );

      // Auto-execute high-confidence decisions
      if (decision.confidence >= AUTO_EXECUTE_CONFIDENCE && decision.actions.length > 0) {
        const execResult = await executeDecision(decision.decision_id);

        await logTickDecision(
          'tick',
          `Auto-executed decision: ${execResult.results.length} actions`,
          { action: 'execute_decision', decision_id: decision.decision_id },
          { success: true, executed: execResult.results.length }
        );

        actionsTaken.push({
          action: 'execute_decision',
          decision_id: decision.decision_id,
          actions_executed: execResult.results.length,
          confidence: decision.confidence
        });
      } else if (decision.actions.length > 0) {
        // Low confidence - log but don't execute
        await logTickDecision(
          'tick',
          `Decision pending approval: confidence ${decision.confidence} < ${AUTO_EXECUTE_CONFIDENCE}`,
          { action: 'decision_pending', decision_id: decision.decision_id },
          { success: true, requires_approval: true }
        );
      }

      decisionEngineResult = {
        comparison_health: comparison.overall_health,
        decision_id: decision.decision_id,
        actions_generated: decision.actions.length,
        confidence: decision.confidence
      };
    }
  } catch (err) {
    // Decision engine error should not stop the tick
    await logTickDecision(
      'tick',
      `Decision engine error: ${err.message}`,
      { action: 'decision_error', error: err.message },
      { success: false, error: err.message }
    );
  }

  // 3. Get daily focus
  const focusResult = await getDailyFocus();

  if (!focusResult) {
    await logTickDecision(
      'tick',
      'No daily focus set',
      { action: 'skip', reason: 'no_focus' },
      { success: true, skipped: true }
    );
    return {
      success: true,
      decision_engine: decisionEngineResult,
      actions_taken: actionsTaken,
      reason: 'No active Objective to focus on',
      next_tick: new Date(now.getTime() + TICK_INTERVAL_MINUTES * 60 * 1000).toISOString()
    };
  }

  const { focus } = focusResult;
  const objectiveId = focus.objective.id;

  // 4. Get tasks related to focus objective
  const krIds = focus.key_results.map(kr => kr.id);
  const allGoalIds = [objectiveId, ...krIds];

  const tasksResult = await pool.query(`
    SELECT id, title, status, priority, started_at, updated_at
    FROM tasks
    WHERE goal_id = ANY($1)
      AND status NOT IN ('completed', 'cancelled')
    ORDER BY
      CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      created_at ASC
  `, [allGoalIds]);

  const tasks = tasksResult.rows;

  // 5. Decision logic
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const queued = tasks.filter(t => t.status === 'queued');

  // Check for stale tasks
  const staleTasks = tasks.filter(t => isStale(t));
  for (const task of staleTasks) {
    await logTickDecision(
      'tick',
      `Stale task detected: ${task.title}`,
      { action: 'detect_stale', task_id: task.id },
      { success: true, task_id: task.id, title: task.title }
    );
    actionsTaken.push({
      action: 'detect_stale',
      task_id: task.id,
      title: task.title,
      reason: `Task has been in_progress for over ${STALE_THRESHOLD_HOURS} hours`
    });
  }

  // 6. Execute action: Start next task if nothing in progress
  if (inProgress.length === 0 && queued.length > 0) {
    const nextTask = queued[0];

    // First, update task status to in_progress
    const updateResult = await updateTask({
      task_id: nextTask.id,
      status: 'in_progress'
    });

    if (updateResult.success) {
      await logTickDecision(
        'tick',
        `Started task: ${nextTask.title}`,
        { action: 'update-task', task_id: nextTask.id, status: 'in_progress' },
        updateResult
      );
      actionsTaken.push({
        action: 'update-task',
        task_id: nextTask.id,
        title: nextTask.title,
        status: 'in_progress'
      });

      // Then, trigger cecelia-run for execution
      const ceceliaAvailable = await checkCeceliaRunAvailable();
      if (ceceliaAvailable.available) {
        // Get full task data for execution
        const fullTaskResult = await pool.query(
          'SELECT * FROM tasks WHERE id = $1',
          [nextTask.id]
        );

        if (fullTaskResult.rows.length > 0) {
          const fullTask = fullTaskResult.rows[0];
          const execResult = await triggerCeceliaRun(fullTask);

          await logTickDecision(
            'tick',
            `Triggered cecelia-run for task: ${nextTask.title}`,
            { action: 'trigger-cecelia', task_id: nextTask.id, run_id: execResult.runId },
            execResult
          );

          actionsTaken.push({
            action: 'trigger-cecelia',
            task_id: nextTask.id,
            title: nextTask.title,
            run_id: execResult.runId,
            success: execResult.success
          });
        }
      } else {
        // cecelia-run not available, just log
        await logTickDecision(
          'tick',
          `cecelia-run not available, task status updated only`,
          { action: 'no-executor', task_id: nextTask.id, reason: ceceliaAvailable.error },
          { success: true, warning: 'cecelia-run not available' }
        );
      }
    }
  } else if (inProgress.length > 0) {
    // Log that we're waiting for in-progress tasks
    await logTickDecision(
      'tick',
      `Waiting for ${inProgress.length} in-progress task(s)`,
      { action: 'wait', in_progress_count: inProgress.length },
      { success: true }
    );
  } else if (queued.length === 0) {
    // No tasks to work on
    await logTickDecision(
      'tick',
      'No queued tasks for focus objective',
      { action: 'skip', reason: 'no_queued_tasks' },
      { success: true }
    );
  }

  // 7. Update tick state
  await pool.query(`
    INSERT INTO working_memory (key, value_json, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value_json = $2, updated_at = NOW()
  `, [TICK_LAST_KEY, { timestamp: now.toISOString() }]);

  // Update actions count
  if (actionsTaken.length > 0) {
    await incrementActionsToday(actionsTaken.length);
  }

  return {
    success: true,
    decision_engine: decisionEngineResult,
    focus: {
      objective_id: objectiveId,
      objective_title: focus.objective.title
    },
    actions_taken: actionsTaken,
    summary: {
      in_progress: inProgress.length,
      queued: queued.length,
      stale: staleTasks.length
    },
    next_tick: new Date(now.getTime() + TICK_INTERVAL_MINUTES * 60 * 1000).toISOString()
  };
}

export {
  getTickStatus,
  enableTick,
  disableTick,
  executeTick,
  isStale,
  TICK_INTERVAL_MINUTES
};
