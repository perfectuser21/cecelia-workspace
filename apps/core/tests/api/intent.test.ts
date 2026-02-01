/**
 * Intent API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import intentRoutes from '../../src/intent/routes.js';

describe('Intent API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/intent', intentRoutes);
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('POST /api/intent/parse', () => {
    it('API 端点能够接收 POST 请求，参数包含 text 字段', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: '创建一个任务' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('API 返回包含：intent_type、confidence、entities、suggested_action', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: '创建一个任务' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('intent_type');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('entities');
      expect(response.body.data).toHaveProperty('suggested_action');
    });

    it('能够关联当前 Brain 状态中的 current_focus 项目（通过 query params）', async () => {
      const response = await request(app)
        .post('/api/intent/parse?project=test-project&goal=test-goal')
        .send({ text: '创建一个任务' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const projectEntity = response.body.data.entities.find(
        (e: { type: string }) => e.type === 'project'
      );
      expect(projectEntity?.value).toBe('test-project');
    });

    it('边界情况：空字符串输入返回错误提示或低置信度', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: '' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Empty input should return low confidence
      expect(response.body.data.confidence).toBeLessThan(0.5);
      expect(response.body.data.suggested_action.type).toBe('clarify');
    });

    it('边界情况：缺少 text 字段返回错误', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('边界情况：text 字段类型错误返回错误', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: 12345 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text field must be a string');
    });

    it('边界情况：空 query params 不应导致空字符串传入', async () => {
      const response = await request(app)
        .post('/api/intent/parse?project=&goal=')
        .send({ text: '创建任务' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Empty query params should be filtered out to undefined
      const entities = response.body.data.entities;
      const projectEntity = entities.find((e: { type: string }) => e.type === 'project');
      // Should not have empty string project
      if (projectEntity) {
        expect(projectEntity.value).not.toBe('');
      }
    });
  });

  describe('Performance', () => {
    it('API 响应时间 < 500ms（不含 LLM 调用，使用模拟数据测试）', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/intent/parse')
        .send({ text: '创建一个 P1 任务：实现登录功能' })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('反例测试：安全与边界', () => {
    it('特殊字符输入不应导致解析错误', async () => {
      const specialChars = '<script>alert(1)</script> & " \' ; --';
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: specialChars })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('超长文本输入应该被正常处理', async () => {
      const longText = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: longText })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('无关内容应该返回低置信度结果', async () => {
      const response = await request(app)
        .post('/api/intent/parse')
        .send({ text: '今天天气真好啊' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.confidence).toBeLessThan(0.6);
    });
  });
});
