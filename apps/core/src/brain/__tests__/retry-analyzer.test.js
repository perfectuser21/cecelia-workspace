/**
 * Retry Analyzer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../task-system/db.js', () => ({
  default: {
    query: vi.fn()
  }
}));

vi.mock('../event-bus.js', () => ({
  emit: vi.fn().mockResolvedValue(undefined)
}));

import { analyzeFailure, createRetryTask, handleFailedTask, getRetryPolicy, forceRetry, MAX_RETRIES } from '../retry-analyzer.js';
import pool from '../../task-system/db.js';
import { emit } from '../event-bus.js';

describe('Retry Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeFailure', () => {
    const baseTask = { id: 'task-1', payload: {} };

    it('classifies timeout failures', () => {
      const result = analyzeFailure(baseTask, { status: 'timeout' });
      expect(result.failureType).toBe('timeout');
      expect(result.retryable).toBe(true);
      expect(result.adjustedPayload.timeout_extended).toBe(true);
    });

    it('classifies timeout by elapsed minutes', () => {
      const result = analyzeFailure(baseTask, { status: 'AI Failed', elapsed_minutes: 30 });
      expect(result.failureType).toBe('timeout');
      expect(result.retryable).toBe(true);
    });

    it('classifies CI failures', () => {
      const result = analyzeFailure(baseTask, { result_summary: 'CI check failed on lint' });
      expect(result.failureType).toBe('ci_failure');
      expect(result.retryable).toBe(true);
      expect(result.adjustedPayload.ci_context).toContain('CI check failed');
    });

    it('classifies env errors as non-retryable', () => {
      const result = analyzeFailure(baseTask, { result_summary: 'npm ERR! code ENOENT' });
      expect(result.failureType).toBe('env_error');
      expect(result.retryable).toBe(false);
      expect(result.adjustedPayload.env_issue).toBe(true);
    });

    it('classifies permission errors as env_error', () => {
      const result = analyzeFailure(baseTask, { result_summary: 'permission denied /usr/local/bin' });
      expect(result.failureType).toBe('env_error');
      expect(result.retryable).toBe(false);
    });

    it('classifies code errors', () => {
      const result = analyzeFailure(baseTask, { result_summary: 'ReferenceError: x is not defined' });
      expect(result.failureType).toBe('code_error');
      expect(result.retryable).toBe(true);
      expect(result.adjustedPayload.error_context).toContain('ReferenceError');
    });

    it('classifies unknown failures', () => {
      const result = analyzeFailure(baseTask, { result_summary: 'something unexpected happened' });
      expect(result.failureType).toBe('unknown');
      expect(result.retryable).toBe(true);
    });

    it('marks as non-retryable when retry count >= MAX_RETRIES', () => {
      const task = { id: 'task-1', payload: { retry_count: 2 } };
      const result = analyzeFailure(task, { status: 'timeout' });
      expect(result.failureType).toBe('timeout');
      expect(result.retryable).toBe(false);
      expect(result.reason).toContain('max retries');
    });

    it('increments retry_count in adjustedPayload', () => {
      const task = { id: 'task-1', payload: { retry_count: 1 } };
      const result = analyzeFailure(task, { status: 'timeout' });
      expect(result.adjustedPayload.retry_count).toBe(2);
    });

    it('preserves prd_content in adjustedPayload', () => {
      const task = { id: 'task-1', payload: { prd_content: '# PRD' } };
      const result = analyzeFailure(task, { status: 'timeout' });
      expect(result.adjustedPayload.prd_content).toBe('# PRD');
    });

    it('preserves prd_path in adjustedPayload', () => {
      const task = { id: 'task-1', payload: { prd_path: '/tmp/prd.md' } };
      const result = analyzeFailure(task, { status: 'timeout' });
      expect(result.adjustedPayload.prd_path).toBe('/tmp/prd.md');
    });

    it('handles empty runResult gracefully', () => {
      const result = analyzeFailure(baseTask, {});
      expect(result.failureType).toBe('unknown');
      expect(result.retryable).toBe(true);
    });
  });

  describe('createRetryTask', () => {
    it('creates a retry task with correct fields', async () => {
      const task = {
        id: 'task-1',
        title: 'Fix login',
        description: 'Fix the login bug',
        priority: 'P0',
        project_id: 'proj-1',
        goal_id: 'goal-1',
        tags: ['bug']
      };

      const retryTask = { id: 'retry-1', title: '[Retry] Fix login', status: 'queued' };
      pool.query.mockResolvedValueOnce({ rows: [retryTask] });

      const result = await createRetryTask(task, { retry_of: 'task-1', retry_count: 1, failure_type: 'timeout' });

      expect(result.id).toBe('retry-1');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.arrayContaining(['[Retry] Fix login', 'Fix the login bug', 'P0', 'proj-1', 'goal-1'])
      );
      expect(emit).toHaveBeenCalledWith('task_retried', 'retry-analyzer', expect.objectContaining({
        original_task_id: 'task-1',
        retry_task_id: 'retry-1'
      }));
    });

    it('does not double-prefix [Retry]', async () => {
      const task = { id: 'task-1', title: '[Retry] Fix login', priority: 'P1' };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'retry-2' }] });

      await createRetryTask(task, { retry_of: 'task-1', retry_count: 2 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['[Retry] Fix login'])
      );
    });
  });

  describe('handleFailedTask', () => {
    it('creates retry for retryable failures', async () => {
      const task = { id: 'task-1', title: 'Do thing', payload: {} };
      const retryTask = { id: 'retry-1', status: 'queued' };
      pool.query.mockResolvedValueOnce({ rows: [retryTask] });

      const result = await handleFailedTask(task, { status: 'timeout' });

      expect(result.analysis.failureType).toBe('timeout');
      expect(result.retryTask).toBeTruthy();
    });

    it('does not create retry for env_error', async () => {
      const task = { id: 'task-1', title: 'Do thing', payload: {} };
      const result = await handleFailedTask(task, { result_summary: 'npm ERR!' });

      expect(result.analysis.failureType).toBe('env_error');
      expect(result.retryTask).toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('does not create retry when max retries reached', async () => {
      const task = { id: 'task-1', title: 'Do thing', payload: { retry_count: 2 } };
      const result = await handleFailedTask(task, { status: 'timeout' });

      expect(result.analysis.retryable).toBe(false);
      expect(result.retryTask).toBeNull();
    });
  });

  describe('getRetryPolicy', () => {
    it('returns policy with correct fields', () => {
      const policy = getRetryPolicy();
      expect(policy.max_retries).toBe(2);
      expect(policy.retryable_types).toContain('timeout');
      expect(policy.retryable_types).toContain('ci_failure');
      expect(policy.retryable_types).toContain('code_error');
      expect(policy.retryable_types).toContain('unknown');
      expect(policy.non_retryable_types).toContain('env_error');
    });
  });

  describe('forceRetry', () => {
    it('creates retry task ignoring count limit', async () => {
      const task = { id: 'task-1', title: 'Do thing', payload: { retry_count: 5 } };
      pool.query.mockResolvedValueOnce({ rows: [task] }); // SELECT
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'retry-1', status: 'queued' }] }); // INSERT

      const result = await forceRetry('task-1');

      expect(result.success).toBe(true);
      expect(result.task.id).toBe('retry-1');
    });

    it('returns error for non-existent task', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await forceRetry('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });
});
