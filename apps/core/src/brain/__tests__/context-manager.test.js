/**
 * Context Manager Tests
 * Tests for session context storage and pronoun resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initContext,
  storeEntity,
  getRecentEntity,
  resolvePronoun,
  getAllEntities,
  clearContext,
  cleanupExpiredSessions,
  getStats,
  startCleanup,
  stopCleanup
} from '../context-manager.js';

describe('Context Manager', () => {
  const testSessionId = 'test-session-123';

  beforeEach(() => {
    // Clean up test session before each test
    clearContext(testSessionId);
  });

  afterEach(() => {
    // Clean up test session after each test
    clearContext(testSessionId);
  });

  describe('Entity Storage', () => {
    it('should store and retrieve a goal entity', () => {
      const goalEntity = {
        type: 'goal',
        id: 'goal-456',
        title: '优化系统性能'
      };

      storeEntity(testSessionId, goalEntity);

      const retrieved = getRecentEntity(testSessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved.type).toBe('goal');
      expect(retrieved.id).toBe('goal-456');
      expect(retrieved.title).toBe('优化系统性能');
      expect(retrieved.timestamp).toBeDefined();
    });

    it('should store and retrieve a task entity', () => {
      const taskEntity = {
        type: 'task',
        id: 'task-789',
        title: '修复登录 Bug'
      };

      storeEntity(testSessionId, taskEntity);

      const retrieved = getRecentEntity(testSessionId);
      expect(retrieved.type).toBe('task');
      expect(retrieved.id).toBe('task-789');
    });

    it('should retrieve the most recent entity when multiple exist', () => {
      // Store 3 entities
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal 1' });
      storeEntity(testSessionId, { type: 'task', id: 'task-1', title: 'Task 1' });
      storeEntity(testSessionId, { type: 'project', id: 'proj-1', title: 'Project 1' });

      // Most recent should be Project 1
      const recent = getRecentEntity(testSessionId);
      expect(recent.type).toBe('project');
      expect(recent.id).toBe('proj-1');
    });

    it('should retrieve the most recent entity of specific type', () => {
      // Store multiple entities of different types
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal 1' });
      storeEntity(testSessionId, { type: 'task', id: 'task-1', title: 'Task 1' });
      storeEntity(testSessionId, { type: 'goal', id: 'goal-2', title: 'Goal 2' });

      // Most recent goal should be goal-2
      const recentGoal = getRecentEntity(testSessionId, 'goal');
      expect(recentGoal.id).toBe('goal-2');

      // Most recent task should be task-1
      const recentTask = getRecentEntity(testSessionId, 'task');
      expect(recentTask.id).toBe('task-1');
    });

    it('should limit entities to max 10 (LRU eviction)', () => {
      // Store 12 entities
      for (let i = 1; i <= 12; i++) {
        storeEntity(testSessionId, { type: 'task', id: `task-${i}`, title: `Task ${i}` });
      }

      const allEntities = getAllEntities(testSessionId);

      // Should only keep last 10
      expect(allEntities.length).toBe(10);

      // First 2 should be evicted (task-1, task-2)
      const ids = allEntities.map(e => e.id);
      expect(ids).not.toContain('task-1');
      expect(ids).not.toContain('task-2');

      // Last 10 should be present (task-3 to task-12)
      expect(ids).toContain('task-12');
      expect(ids).toContain('task-3');
    });
  });

  describe('Pronoun Resolution', () => {
    it('should resolve "那个目标" to recent goal', () => {
      // Store a goal
      storeEntity(testSessionId, { type: 'goal', id: 'goal-456', title: '优化性能' });

      const resolved = resolvePronoun(testSessionId, '给那个目标添加一个任务');
      expect(resolved).toBeDefined();
      expect(resolved.type).toBe('goal');
      expect(resolved.id).toBe('goal-456');
    });

    it('should resolve "那个任务" to recent task', () => {
      // Store multiple entities
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal' });
      storeEntity(testSessionId, { type: 'task', id: 'task-1', title: 'Task' });

      const resolved = resolvePronoun(testSessionId, '更新那个任务的状态');
      expect(resolved).toBeDefined();
      expect(resolved.type).toBe('task');
      expect(resolved.id).toBe('task-1');
    });

    it('should resolve "它" to most recent entity', () => {
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal' });

      const resolved = resolvePronoun(testSessionId, '给它添加一个任务');
      expect(resolved).toBeDefined();
      expect(resolved.id).toBe('goal-1');
    });

    it('should resolve English pronouns "that goal"', () => {
      storeEntity(testSessionId, { type: 'goal', id: 'goal-en', title: 'English Goal' });

      const resolved = resolvePronoun(testSessionId, 'add a task to that goal');
      expect(resolved).toBeDefined();
      expect(resolved.type).toBe('goal');
      expect(resolved.id).toBe('goal-en');
    });

    it('should return null when no pronoun found', () => {
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal' });

      const resolved = resolvePronoun(testSessionId, '创建一个新目标');
      expect(resolved).toBeNull();
    });

    it('should return null when no context exists', () => {
      const resolved = resolvePronoun('non-existent-session', '那个目标');
      expect(resolved).toBeNull();
    });
  });

  describe('Session Isolation', () => {
    it('should isolate entities between different sessions', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      storeEntity(session1, { type: 'goal', id: 'goal-session1', title: 'Goal 1' });
      storeEntity(session2, { type: 'goal', id: 'goal-session2', title: 'Goal 2' });

      const entity1 = getRecentEntity(session1);
      const entity2 = getRecentEntity(session2);

      expect(entity1.id).toBe('goal-session1');
      expect(entity2.id).toBe('goal-session2');

      // Clean up
      clearContext(session1);
      clearContext(session2);
    });
  });

  describe('Context Cleanup', () => {
    it('should clear all entities for a session', () => {
      storeEntity(testSessionId, { type: 'goal', id: 'goal-1', title: 'Goal' });
      storeEntity(testSessionId, { type: 'task', id: 'task-1', title: 'Task' });

      let entities = getAllEntities(testSessionId);
      expect(entities.length).toBe(2);

      clearContext(testSessionId);

      entities = getAllEntities(testSessionId);
      expect(entities.length).toBe(0);
    });

    it('should cleanup expired sessions (mock test)', () => {
      // This test only verifies the function runs without error
      // Actual expiration would require waiting 30 minutes
      const cleaned = cleanupExpiredSessions();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Stats', () => {
    it('should return stats for active contexts', () => {
      storeEntity('session-stats-1', { type: 'goal', id: 'g1', title: 'Goal' });
      storeEntity('session-stats-2', { type: 'task', id: 't1', title: 'Task' });
      storeEntity('session-stats-2', { type: 'task', id: 't2', title: 'Task 2' });

      const stats = getStats();

      expect(stats).toBeDefined();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalEntities).toBeGreaterThanOrEqual(3);
      expect(stats.oldestSession).toBeDefined();
      expect(stats.newestSession).toBeDefined();

      // Clean up
      clearContext('session-stats-1');
      clearContext('session-stats-2');
    });
  });

  describe('Cleanup Timer Management', () => {
    it('should start and stop cleanup timer without errors', () => {
      // Stop existing timer
      stopCleanup();

      // Start new timer
      startCleanup();

      // Stop timer
      stopCleanup();

      // Multiple stop calls should be safe
      stopCleanup();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null or undefined entity gracefully', () => {
      storeEntity(testSessionId, null);
      const entities = getAllEntities(testSessionId);
      expect(entities.length).toBe(0);

      storeEntity(testSessionId, undefined);
      expect(getAllEntities(testSessionId).length).toBe(0);
    });

    it('should handle empty session_id gracefully', () => {
      storeEntity('', { type: 'goal', id: 'g1', title: 'Goal' });
      const entity = getRecentEntity('');
      // Should not store with empty session_id
      expect(entity).toBeNull();
    });

    it('should return null for non-existent entity type', () => {
      storeEntity(testSessionId, { type: 'goal', id: 'g1', title: 'Goal' });

      const task = getRecentEntity(testSessionId, 'task');
      expect(task).toBeNull();
    });
  });
});
