/**
 * Retry Analyzer - Analyze task failures and create retry tasks
 *
 * Failure types:
 * - timeout: execution exceeded time limit
 * - ci_failure: CI/CD check failed
 * - code_error: code-level error during execution
 * - env_error: environment issue (not retryable)
 * - unknown: unclassifiable failure
 */

import pool from '../task-system/db.js';
import { emit } from './event-bus.js';

const MAX_RETRIES = 2;

const RETRYABLE_TYPES = ['timeout', 'ci_failure', 'code_error', 'unknown'];
const NON_RETRYABLE_TYPES = ['env_error'];

/**
 * Analyze a task failure and determine retry strategy.
 *
 * @param {Object} task - The failed task (with payload)
 * @param {Object} runResult - The run result from execution callback
 * @returns {{ failureType: string, retryable: boolean, adjustedPayload: Object, reason: string }}
 */
function analyzeFailure(task, runResult) {
  const status = runResult.status || '';
  const summary = runResult.result_summary || '';
  const elapsed = runResult.elapsed_minutes || 0;
  const combined = `${status} ${summary}`.toLowerCase();

  let failureType = 'unknown';
  let retryable = true;
  const retryHints = {};
  let reason = '';

  // Classify failure type (order matters: more specific first)
  if (/timeout/i.test(combined) || elapsed > 25) {
    failureType = 'timeout';
    retryHints.timeout_extended = true;
    reason = `Execution timed out (${elapsed ? elapsed + 'min' : 'timeout detected'})`;
  } else if (/\bnpm\b|permission|enoent/i.test(combined)) {
    failureType = 'env_error';
    retryable = false;
    retryHints.env_issue = true;
    reason = `Environment error: ${summary.slice(0, 100)}`;
  } else if (/\bci\b|\bcheck\b/i.test(combined)) {
    failureType = 'ci_failure';
    retryHints.ci_context = summary.slice(0, 200);
    reason = `CI/check failure: ${summary.slice(0, 100)}`;
  } else if (/error|fail/i.test(combined)) {
    failureType = 'code_error';
    retryHints.error_context = summary.slice(0, 200);
    reason = `Code error: ${summary.slice(0, 100)}`;
  } else {
    failureType = 'unknown';
    retryHints.previous_failure = status || summary || 'unknown';
    reason = `Unknown failure: ${(status || summary || 'no details').slice(0, 100)}`;
  }

  // Check retry count from task payload
  const currentRetryCount = task.payload?.retry_count || 0;
  if (currentRetryCount >= MAX_RETRIES) {
    retryable = false;
    reason += ` (max retries ${MAX_RETRIES} reached)`;
  }

  // Build adjusted payload for retry task
  const adjustedPayload = {
    ...retryHints,
    retry_of: task.id,
    retry_count: currentRetryCount + 1,
    failure_type: failureType,
    failure_reason: reason
  };

  // Preserve original PRD content
  if (task.payload?.prd_content) {
    adjustedPayload.prd_content = task.payload.prd_content;
  }
  if (task.payload?.prd_path) {
    adjustedPayload.prd_path = task.payload.prd_path;
  }

  return { failureType, retryable, adjustedPayload, reason };
}

/**
 * Create a retry task from a failed task.
 *
 * @param {Object} task - The original failed task
 * @param {Object} adjustedPayload - Payload with retry hints
 * @returns {Object|null} - The new retry task, or null if creation failed
 */
async function createRetryTask(task, adjustedPayload) {
  const retryTitle = task.title.startsWith('[Retry]') ? task.title : `[Retry] ${task.title}`;

  const result = await pool.query(`
    INSERT INTO tasks (title, description, priority, project_id, goal_id, status, payload, tags)
    VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)
    RETURNING *
  `, [
    retryTitle,
    task.description || '',
    task.priority || 'P1',
    task.project_id || null,
    task.goal_id || null,
    JSON.stringify(adjustedPayload),
    task.tags || []
  ]);

  const retryTask = result.rows[0];

  await emit('task_retried', 'retry-analyzer', {
    original_task_id: task.id,
    retry_task_id: retryTask.id,
    retry_count: adjustedPayload.retry_count,
    failure_type: adjustedPayload.failure_type,
    reason: adjustedPayload.failure_reason
  });

  console.log(`[retry-analyzer] Created retry task ${retryTask.id} for ${task.id} (${adjustedPayload.failure_type}, attempt ${adjustedPayload.retry_count})`);

  return retryTask;
}

/**
 * Handle a failed task: analyze, and optionally create retry.
 *
 * @param {Object} task - Full task row from DB
 * @param {Object} runResult - Run result with status, result_summary, elapsed_minutes
 * @returns {{ analysis: Object, retryTask: Object|null }}
 */
async function handleFailedTask(task, runResult) {
  const analysis = analyzeFailure(task, runResult);

  let retryTask = null;
  if (analysis.retryable) {
    retryTask = await createRetryTask(task, analysis.adjustedPayload);
  }

  return { analysis, retryTask };
}

/**
 * Get the retry policy configuration.
 */
function getRetryPolicy() {
  return {
    max_retries: MAX_RETRIES,
    retryable_types: RETRYABLE_TYPES,
    non_retryable_types: NON_RETRYABLE_TYPES
  };
}

/**
 * Force-retry a task (ignores retry count limit).
 *
 * @param {string} taskId - Task ID to retry
 * @returns {Object} - { success, task } or { success: false, error }
 */
async function forceRetry(taskId) {
  const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (result.rows.length === 0) {
    return { success: false, error: 'Task not found' };
  }

  const task = result.rows[0];
  const retryCount = task.payload?.retry_count || 0;

  const adjustedPayload = {
    retry_of: task.id,
    retry_count: retryCount + 1,
    forced: true
  };

  // Preserve PRD content
  if (task.payload?.prd_content) adjustedPayload.prd_content = task.payload.prd_content;
  if (task.payload?.prd_path) adjustedPayload.prd_path = task.payload.prd_path;

  const retryTask = await createRetryTask(task, adjustedPayload);
  return { success: true, task: retryTask };
}

export {
  analyzeFailure,
  createRetryTask,
  handleFailedTask,
  getRetryPolicy,
  forceRetry,
  MAX_RETRIES,
  RETRYABLE_TYPES,
  NON_RETRYABLE_TYPES
};
