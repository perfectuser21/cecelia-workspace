/**
 * Intent Integration Tests
 * End-to-end tests for context reference across multiple API calls
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from '../routes.js';
import { clearContext } from '../context-manager.js';

const app = express();
app.use(express.json());
app.use('/api/brain', router);

describe('Intent Integration: Context References', () => {
  const sessionId = 'integration-test-session';

  beforeAll(() => {
    clearContext(sessionId);
  });

  afterAll(() => {
    clearContext(sessionId);
  });

  it('should resolve pronoun reference across two API calls', async () => {
    // First call: Create a goal
    const firstResponse = await request(app)
      .post('/api/brain/intent/create')
      .send({
        input: '创建一个 P0 目标：优化系统性能',
        options: {
          createGoal: true,
          session_id: sessionId
        }
      });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.success).toBe(true);
    expect(firstResponse.body.created).toBeDefined();

    // Second call: Use pronoun "那个目标"
    const secondResponse = await request(app)
      .post('/api/brain/intent')
      .send({
        text: '给那个目标添加一个任务：减少 API 响应时间',
        context: { session_id: sessionId }
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.intent).toBe('create_task');

    // Should have resolved entity reference
    expect(secondResponse.body.entities).toBeDefined();
    expect(secondResponse.body.entities.resolved_entity).toBeDefined();
    expect(secondResponse.body.entities.resolved_entity.type).toBe('goal');
  });

  it('should maintain context across multiple consecutive calls', async () => {
    const testSession = 'multi-call-session';

    try {
      // Call 1: Create goal
      await request(app)
        .post('/api/brain/intent/create')
        .send({
          input: '创建目标：提升用户体验',
          options: { createGoal: true, session_id: testSession }
        });

      // Call 2: Create task
      await request(app)
        .post('/api/brain/intent/create')
        .send({
          input: '添加任务：优化页面加载速度',
          options: { createTask: true, session_id: testSession }
        });

      // Call 3: Reference recent task with pronoun
      const thirdResponse = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '那个任务的优先级应该是 P0',
          context: { session_id: testSession }
        });

      expect(thirdResponse.status).toBe(200);
      expect(thirdResponse.body.entities.resolved_entity).toBeDefined();
      expect(thirdResponse.body.entities.resolved_entity.type).toBe('task');
    } finally {
      clearContext(testSession);
    }
  });

  it('should isolate contexts between different sessions', async () => {
    const session1 = 'session-isolation-1';
    const session2 = 'session-isolation-2';

    try {
      // Session 1: Create goal A
      await request(app)
        .post('/api/brain/intent/create')
        .send({
          input: '创建目标：完成项目 A',
          options: { createGoal: true, session_id: session1 }
        });

      // Session 2: Create goal B
      await request(app)
        .post('/api/brain/intent/create')
        .send({
          input: '创建目标：完成项目 B',
          options: { createGoal: true, session_id: session2 }
        });

      // Session 1 reference should only see goal A
      const session1Response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '那个目标',
          context: { session_id: session1 }
        });

      // Session 2 reference should only see goal B
      const session2Response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '那个目标',
          context: { session_id: session2 }
        });

      // Both should have resolved entities, but different ones
      expect(session1Response.body.entities.resolved_entity).toBeDefined();
      expect(session2Response.body.entities.resolved_entity).toBeDefined();

      // Titles should be different (isolation working)
      expect(session1Response.body.entities.resolved_entity.title).not.toBe(
        session2Response.body.entities.resolved_entity.title
      );
    } finally {
      clearContext(session1);
      clearContext(session2);
    }
  });

  it('should return null resolved_entity when no context exists', async () => {
    const emptySession = 'empty-context-session';

    const response = await request(app)
      .post('/api/brain/intent')
      .send({
        text: '那个目标怎么样了？',
        context: { session_id: emptySession }
      });

    expect(response.status).toBe(200);
    // No resolved_entity since no prior context
    expect(response.body.entities.resolved_entity).toBeUndefined();

    clearContext(emptySession);
  });

  it('should handle pronoun in input without any context gracefully', async () => {
    const noContextSession = 'no-context-session';

    const response = await request(app)
      .post('/api/brain/intent')
      .send({
        text: '给它添加一个任务',
        context: { session_id: noContextSession }
      });

    expect(response.status).toBe(200);
    expect(response.body.intent).toBeDefined();
    // Should not crash even if pronoun cannot be resolved
  });
});

describe('Intent Integration: End-to-End Workflow', () => {
  const workflowSession = 'e2e-workflow-session';

  afterAll(() => {
    clearContext(workflowSession);
  });

  it('should support complete goal creation to task addition workflow', async () => {
    // Step 1: User creates a goal via natural language
    const createGoalResponse = await request(app)
      .post('/api/brain/intent/create')
      .send({
        input: '创建一个 P0 目标：完成用户认证系统',
        options: {
          createGoal: true,
          session_id: workflowSession
        }
      });

    expect(createGoalResponse.body.success).toBe(true);
    const goalId = createGoalResponse.body.created?.goal?.id;
    expect(goalId).toBeDefined();

    // Step 2: User adds task using pronoun reference
    const addTaskResponse = await request(app)
      .post('/api/brain/intent')
      .send({
        text: '给那个目标添加一个任务：实现 JWT 认证',
        context: { session_id: workflowSession }
      });

    expect(addTaskResponse.body.intent).toBe('create_task');
    expect(addTaskResponse.body.entities.resolved_entity).toBeDefined();
    expect(addTaskResponse.body.entities.resolved_entity.id).toBe(goalId);

    // Step 3: User queries status
    const queryResponse = await request(app)
      .post('/api/brain/intent')
      .send({
        text: '那个目标的进展怎么样？',
        context: { session_id: workflowSession }
      });

    // Intent should be query-related
    expect(queryResponse.body.intent).toMatch(/query/);
    expect(queryResponse.body.entities.resolved_entity).toBeDefined();
  });
});

describe('Intent Integration: Accuracy Tests', () => {
  it('should achieve >= 85% accuracy on 20 test cases', async () => {
    const testCases = [
      { input: '创建一个 P0 目标：提升系统稳定性', expectedIntent: 'create_goal' },
      { input: '添加任务：修复登录 Bug', expectedIntent: 'create_task' },
      { input: '当前有哪些进行中的任务？', expectedIntent: 'query_status' },
      { input: '我想做一个 Dashboard 项目', expectedIntent: 'create_project' },
      { input: '给登录页面加一个忘记密码功能', expectedIntent: 'create_feature' },
      { input: '修复购物车价格显示问题', expectedIntent: 'fix_bug' },
      { input: '重构用户模块的代码', expectedIntent: 'refactor' },
      { input: '创建目标：优化 API 性能', expectedIntent: 'create_goal' },
      { input: '新建一个紧急任务：处理生产事故', expectedIntent: 'create_task' },
      { input: '查看所有 P0 任务', expectedIntent: 'query_status' },
      { input: 'create a goal: improve code quality', expectedIntent: 'create_goal' },
      { input: 'add task: write unit tests', expectedIntent: 'create_task' },
      { input: '解决数据库连接超时的问题', expectedIntent: 'fix_bug' },
      { input: '帮我看看这个 API 怎么用', expectedIntent: 'explore' },
      { input: '为什么这里会报错？', expectedIntent: 'question' },
      { input: '优化前端打包速度', expectedIntent: 'refactor' },
      { input: '创建一个新项目：短视频平台', expectedIntent: 'create_project' },
      { input: '给系统添加日志功能', expectedIntent: 'create_feature' },
      { input: '任务进度怎么样？', expectedIntent: 'query_status' },
      { input: '设定一个目标：完成 Q1 OKR', expectedIntent: 'create_goal' }
    ];

    let correct = 0;

    for (const testCase of testCases) {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: testCase.input });

      if (response.body.intent === testCase.expectedIntent) {
        correct++;
      }
    }

    const accuracy = (correct / testCases.length) * 100;
    expect(accuracy).toBeGreaterThanOrEqual(85);
  });
});
