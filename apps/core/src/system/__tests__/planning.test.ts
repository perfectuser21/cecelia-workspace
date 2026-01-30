/**
 * Planning Engine Tests - Phase 5.2
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5211/api/system';

// Response types
interface ApiResponse {
  success: boolean;
  [key: string]: unknown;
}

describe('Planning Engine API', () => {
  describe('POST /api/system/plan/generate', () => {
    it('should generate a daily plan', async () => {
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });

      const data = (await response.json()) as ApiResponse;
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const plan = data.plan as {
        plan_id: string;
        scope: string;
        tasks: unknown[];
        summary: { total: number };
        reasoning: string;
      };
      expect(plan.plan_id).toMatch(/^plan_daily_\d{8}$/);
      expect(plan.scope).toBe('daily');
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(plan.summary.total).toBeGreaterThanOrEqual(0);
      expect(plan.reasoning).toBeDefined();
    });

    it('should generate a weekly plan', async () => {
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'weekly' }),
      });

      const data = (await response.json()) as ApiResponse;
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      const plan = data.plan as { plan_id: string; scope: string };
      expect(plan.plan_id).toMatch(/^plan_weekly_\d{8}$/);
      expect(plan.scope).toBe('weekly');
    });

    it('should reject invalid scope', async () => {
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'invalid' }),
      });

      const data = (await response.json()) as ApiResponse;
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should default to daily scope if not provided', async () => {
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as ApiResponse;
      expect(response.status).toBe(201);
      expect((data.plan as { scope: string }).scope).toBe('daily');
    });
  });

  describe('GET /api/system/plan/status', () => {
    beforeAll(async () => {
      // Ensure a plan exists
      await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });
    });

    it('should return current plan status', async () => {
      const response = await fetch(`${API_BASE}/plan/status`);
      const data = (await response.json()) as ApiResponse;

      expect(data.success).toBe(true);
      expect(data.active_plan).toBeDefined();
      expect(data.progress).toBeDefined();

      const progress = data.progress as {
        total: number;
        completed: number;
        in_progress: number;
        pending: number;
      };
      expect(typeof progress.total).toBe('number');
      expect(typeof progress.completed).toBe('number');
      expect(typeof progress.in_progress).toBe('number');
      expect(typeof progress.pending).toBe('number');
    });

    it('should include next_task if available', async () => {
      const response = await fetch(`${API_BASE}/plan/status`);
      const data = (await response.json()) as ApiResponse;

      expect(data.success).toBe(true);
      // next_task can be null if no tasks
      if (data.next_task) {
        const nextTask = data.next_task as { id: string; title: string; priority: string };
        expect(nextTask.id).toBeDefined();
        expect(nextTask.title).toBeDefined();
        expect(nextTask.priority).toBeDefined();
      }
    });
  });

  describe('GET /api/system/plan/:planId', () => {
    let planId: string;

    beforeAll(async () => {
      // Generate a plan to get its ID
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });
      const data = (await response.json()) as ApiResponse;
      planId = (data.plan as { plan_id: string }).plan_id;
    });

    it('should return plan by ID', async () => {
      const response = await fetch(`${API_BASE}/plan/${planId}`);
      const data = (await response.json()) as ApiResponse;

      expect(data.success).toBe(true);
      expect((data.plan as { plan_id: string }).plan_id).toBe(planId);
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await fetch(`${API_BASE}/plan/plan_nonexistent_99999999`);
      expect(response.status).toBe(404);
    });
  });

  describe('Plan stored in Memory', () => {
    it('should store plan in working memory', async () => {
      // Generate a plan
      await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });

      // Check memory for plan
      const memoryResponse = await fetch(`${API_BASE}/memory?layer=working&category=state`);
      const memoryData = (await memoryResponse.json()) as ApiResponse;

      expect(memoryData.success).toBe(true);
      const entries = memoryData.entries as Array<{ key: string; layer: string; category: string }>;
      const planEntry = entries.find(e => e.key.startsWith('plan_daily_'));
      expect(planEntry).toBeDefined();
      expect(planEntry?.layer).toBe('working');
      expect(planEntry?.category).toBe('state');
    });

    it('should store current_plan reference in context', async () => {
      // Generate a plan
      await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });

      // Check memory for current_plan
      const memoryResponse = await fetch(`${API_BASE}/memory/current_plan`);
      const memoryData = (await memoryResponse.json()) as ApiResponse;

      expect(memoryData.success).toBe(true);
      const entry = memoryData.entry as { layer: string; category: string; value: { plan_id: string } };
      expect(entry.layer).toBe('working');
      expect(entry.category).toBe('context');
      expect(entry.value.plan_id).toMatch(/^plan_\w+_\d{8}$/);
    });
  });

  describe('Plan tasks sorted by priority', () => {
    it('should prioritize P0 tasks over P1 and P2', async () => {
      const response = await fetch(`${API_BASE}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'daily' }),
      });

      const data = (await response.json()) as ApiResponse;
      const plan = data.plan as { tasks: Array<{ priority: string }> };

      if (plan.tasks.length > 1) {
        // Check that P0 tasks come before P1 tasks
        let foundP1 = false;
        for (const task of plan.tasks) {
          if (task.priority === 'P1') foundP1 = true;
          if (task.priority === 'P0' && foundP1) {
            // P0 after P1 means wrong order
            expect(true).toBe(false);
          }
        }
      }
      // If only 0 or 1 task, ordering is trivially correct
      expect(true).toBe(true);
    });
  });
});
