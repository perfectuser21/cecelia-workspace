/**
 * Integration tests for Intent Recognition API
 * KR1: 意图识别 - 自然语言→OKR/Project/Task
 *
 * Tests POST /api/brain/intent/parse endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from '../../../brain/routes.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/brain', router);

describe('POST /api/brain/intent/parse', () => {
  describe('意图分类功能', () => {
    it('能够识别创建任务的意图', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '帮我做个登录功能' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('task');
      expect(response.body.entities.title).toContain('登录');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    it('能够识别创建目标的意图', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '我想完成用户认证系统' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(['goal', 'task']).toContain(response.body.type);
      expect(response.body.entities.title).toBeTruthy();
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    it('能够识别创建项目的意图', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '开始一个新的电商项目' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('project');
      expect(response.body.entities.title).toContain('电商');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    it('分类准确率达到阈值（测试10个样本）', async () => {
      const testCases = [
        { input: '添加一个用户注册功能', expectedType: 'task' },
        { input: '创建一个 P0 目标：提升性能', expectedType: 'goal' },
        { input: '开发一个博客系统', expectedType: 'project' },
        { input: '修复购物车 bug', expectedType: 'task' },
        { input: '写一个 API 接口', expectedType: 'task' },
        { input: '设定提升用户体验的目标', expectedType: 'goal' },
        { input: '搭建监控平台', expectedType: 'project' },
        { input: '优化数据库查询', expectedType: 'task' },
        { input: '目标：完成系统重构', expectedType: 'goal' },
        { input: '实现评论功能', expectedType: 'task' }
      ];

      let correctCount = 0;

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/brain/intent/parse')
          .send({ input: testCase.input });

        if (response.body.type === testCase.expectedType) {
          correctCount++;
        }
      }

      const accuracy = (correctCount / testCases.length) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(80);
    });
  });

  describe('实体提取功能', () => {
    it('能够提取标题', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '帮我做个用户管理系统' })
        .expect(200);

      expect(response.body.entities.title).toBeTruthy();
      expect(response.body.entities.title).toContain('用户');
    });

    it('能够提取描述', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '开发一个电商平台' })
        .expect(200);

      expect(response.body.entities.description).toBe('开发一个电商平台');
    });

    it('能够提取优先级 P0/P1/P2', async () => {
      const p0Response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '紧急任务：修复登录 bug' })
        .expect(200);

      expect(p0Response.body.entities.priority).toBe('P0');

      const p1Response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '普通任务：添加日志' })
        .expect(200);

      expect(p1Response.body.entities.priority).toBe('P1');
    });

    it('能够提取时间范围', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '今天完成登录功能' })
        .expect(200);

      expect(response.body.entities.timeframe).toBe('今天');
    });

    it('实体提取覆盖率达到 70%', async () => {
      const testCases = [
        '帮我做个登录功能',
        '创建用户管理模块',
        '添加支付接口',
        '紧急修复购物车bug',
        '今天完成API开发',
        '优化数据库性能',
        '实现评论系统',
        '开发电商平台',
        '设计用户界面',
        '编写单元测试'
      ];

      let extractedCount = 0;

      for (const input of testCases) {
        const response = await request(app)
          .post('/api/brain/intent/parse')
          .send({ input });

        if (response.body.entities.title && response.body.entities.title.length > 0) {
          extractedCount++;
        }
      }

      const coverage = (extractedCount / testCases.length) * 100;
      expect(coverage).toBeGreaterThanOrEqual(70);
    });
  });

  describe('API 响应格式', () => {
    it('返回格式包含 type/entities/confidence', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '添加登录功能' })
        .expect(200);

      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('entities');
      expect(response.body).toHaveProperty('confidence');
      expect(['task', 'goal', 'project', 'query', 'unknown']).toContain(response.body.type);
      expect(typeof response.body.confidence).toBe('number');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);
    });

    it('entities 包含必需字段', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '创建一个项目' })
        .expect(200);

      expect(response.body.entities).toHaveProperty('title');
      expect(response.body.entities).toHaveProperty('description');
      expect(response.body.entities).toHaveProperty('priority');
      expect(response.body.entities).toHaveProperty('timeframe');
    });
  });

  describe('错误处理', () => {
    it('空输入返回 400 错误', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('non-empty');
    });

    it('空格输入返回 400 错误', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: '   ' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('non-empty');
    });

    it('缺少 input 字段返回 400 错误', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    it('input 非字符串返回 400 错误', async () => {
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: 12345 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('string');
    });

    it('超长输入返回 400 错误', async () => {
      const longInput = 'a'.repeat(10001);
      const response = await request(app)
        .post('/api/brain/intent/parse')
        .send({ input: longInput })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('too long');
    });
  });

  describe('性能要求', () => {
    it('API 响应时间 < 500ms (p95)', async () => {
      const responseTimes: number[] = [];

      // 运行 20 次请求
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/brain/intent/parse')
          .send({ input: '添加一个登录功能' });
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // 计算 p95 响应时间
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
      const p95Time = responseTimes[p95Index];

      expect(p95Time).toBeLessThan(500);
    });
  });
});
