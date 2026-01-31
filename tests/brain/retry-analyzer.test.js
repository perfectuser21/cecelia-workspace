import { describe, it, expect, vi } from 'vitest';

// Mock DB and tick modules before importing retry-analyzer
vi.mock('../../apps/core/src/task-system/db.js', () => ({
  default: { query: vi.fn() },
}));
vi.mock('../../apps/core/src/brain/tick.js', () => ({
  DISPATCH_TIMEOUT_MINUTES: 30,
}));

const { analyzeFailure, classifyError, shouldRetryTask, computeAdjustments, extractErrorText, MAX_RETRIES } = await import('../../apps/core/src/brain/retry-analyzer.js');

describe('retry-analyzer', () => {
  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      expect(classifyError('Task timed out after 35 minutes')).toBe('timeout');
      expect(classifyError('dispatch timeout exceeded')).toBe('timeout');
      expect(classifyError('auto-fail timeout')).toBe('timeout');
    });

    it('should classify infra errors', () => {
      expect(classifyError('ECONNREFUSED 127.0.0.1:5432')).toBe('infra_error');
      expect(classifyError('npm ERR! code ENOENT')).toBe('infra_error');
      expect(classifyError('git fatal: could not read')).toBe('infra_error');
      expect(classifyError('spawn ENOENT')).toBe('infra_error');
      expect(classifyError('connection refused')).toBe('infra_error');
    });

    it('should classify code errors', () => {
      expect(classifyError('SyntaxError: unexpected token')).toBe('code_error');
      expect(classifyError('TypeError: x is not a function')).toBe('code_error');
      expect(classifyError('build failed with exit code 1')).toBe('code_error');
      expect(classifyError('test failed: 3 assertions')).toBe('code_error');
      expect(classifyError('CI failed on lint step')).toBe('code_error');
    });

    it('should classify prd_unclear errors', () => {
      expect(classifyError('PRD is unclear')).toBe('prd_unclear');
      expect(classifyError('no PRD found for task')).toBe('prd_unclear');
      expect(classifyError('PRD missing required fields')).toBe('prd_unclear');
      expect(classifyError('requirements unclear')).toBe('prd_unclear');
    });

    it('should default to code_error for unknown errors', () => {
      expect(classifyError('something went wrong')).toBe('code_error');
      expect(classifyError('unknown error')).toBe('code_error');
    });
  });

  describe('extractErrorText', () => {
    it('should extract from task.error string', () => {
      expect(extractErrorText({ error: 'timeout' })).toBe('timeout');
    });

    it('should extract from payload.error_details', () => {
      const task = { payload: { error_details: 'ECONNREFUSED' } };
      expect(extractErrorText(task)).toContain('ECONNREFUSED');
    });

    it('should extract from payload.last_run_result.result_summary', () => {
      const task = { payload: { last_run_result: { result_summary: 'build failed' } } };
      expect(extractErrorText(task)).toContain('build failed');
    });

    it('should return unknown error for empty task', () => {
      expect(extractErrorText({})).toBe('unknown error');
    });

    it('should combine multiple error sources', () => {
      const task = { error: 'top error', payload: { error_details: 'detail error' } };
      const text = extractErrorText(task);
      expect(text).toContain('top error');
      expect(text).toContain('detail error');
    });
  });

  describe('computeAdjustments', () => {
    const baseTask = { payload: { retry_count: 0, dispatch_timeout: 30 } };

    it('should increase timeout by 50% for timeout category', () => {
      const adj = computeAdjustments('timeout', baseTask);
      expect(adj.dispatch_timeout).toBe(45);
      expect(adj.should_retry).toBe(true);
      expect(adj.retry_delay_ms).toBe(0);
    });

    it('should set 10min delay for infra_error', () => {
      const adj = computeAdjustments('infra_error', baseTask);
      expect(adj.retry_delay_ms).toBe(600000);
      expect(adj.should_retry).toBe(true);
      expect(adj.dispatch_timeout).toBe(30);
    });

    it('should not retry prd_unclear', () => {
      const adj = computeAdjustments('prd_unclear', baseTask);
      expect(adj.should_retry).toBe(false);
    });

    it('should allow retry for code_error', () => {
      const adj = computeAdjustments('code_error', baseTask);
      expect(adj.should_retry).toBe(true);
      expect(adj.retry_delay_ms).toBe(0);
    });

    it('should not retry when retry_count >= MAX_RETRIES', () => {
      const task = { payload: { retry_count: 2 } };
      const adj = computeAdjustments('timeout', task);
      expect(adj.should_retry).toBe(false);
    });
  });

  describe('analyzeFailure', () => {
    it('should return category, reason, adjustments', () => {
      const task = { error: 'Task timed out after 40 minutes', payload: { dispatch_timeout: 30 } };
      const result = analyzeFailure(task);

      expect(result.category).toBe('timeout');
      expect(result.reason).toContain('Task exceeded dispatch timeout');
      expect(result.adjustments.dispatch_timeout).toBe(45);
      expect(result.adjustments.should_retry).toBe(true);
    });

    it('should handle infra errors', () => {
      const task = { error: 'ECONNREFUSED 127.0.0.1:5432', payload: {} };
      const result = analyzeFailure(task);

      expect(result.category).toBe('infra_error');
      expect(result.adjustments.retry_delay_ms).toBe(600000);
    });

    it('should handle prd_unclear', () => {
      const task = { error: 'PRD is unclear and missing fields', payload: {} };
      const result = analyzeFailure(task);

      expect(result.category).toBe('prd_unclear');
      expect(result.adjustments.should_retry).toBe(false);
    });
  });

  describe('shouldRetryTask', () => {
    it('should return shouldRetry=false when retry_count >= MAX_RETRIES', () => {
      const task = { error: 'timeout', payload: { retry_count: 2 } };
      const result = shouldRetryTask(task);

      expect(result.shouldRetry).toBe(false);
      expect(result.analysis.category).toBe('max_retries_exceeded');
    });

    it('should return shouldRetry=true for retryable timeout', () => {
      const task = { error: 'Task timed out', payload: { retry_count: 0 } };
      const result = shouldRetryTask(task);

      expect(result.shouldRetry).toBe(true);
      expect(result.analysis.category).toBe('timeout');
    });

    it('should return shouldRetry=false for prd_unclear regardless of retry_count', () => {
      const task = { error: 'PRD is unclear', payload: { retry_count: 0 } };
      const result = shouldRetryTask(task);

      expect(result.shouldRetry).toBe(false);
      expect(result.analysis.category).toBe('prd_unclear');
    });

    it('should return shouldRetry=true for infra_error with low retry count', () => {
      const task = { error: 'ECONNREFUSED', payload: { retry_count: 1 } };
      const result = shouldRetryTask(task);

      expect(result.shouldRetry).toBe(true);
      expect(result.analysis.adjustments.retry_delay_ms).toBe(600000);
    });
  });
});
