/**
 * Intent API Endpoint Tests
 * Tests for the simplified POST /api/brain/intent endpoint
 */

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from '../routes.js';
import { clearContext } from '../context-manager.js';

const app = express();
app.use(express.json());
app.use('/api/brain', router);

describe('POST /api/brain/intent', () => {
  const testSessionId = 'api-test-session';

  afterAll(() => {
    // Clean up test sessions
    clearContext(testSessionId);
  });

  describe('Basic Intent Recognition', () => {
    it('should recognize create_goal intent', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '创建一个高优先级目标：完成用户认证系统',
          context: { session_id: testSessionId }
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.intent).toBe('create_goal');
      expect(response.body.confidence).toBeGreaterThan(0.4);
      expect(response.body.entities).toBeDefined();
      expect(response.body.entities.priority).toBe('P0');
    });

    it('should recognize create_task intent', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '添加一个任务：修复登录超时问题' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('create_task');
      expect(response.body.confidence).toBeGreaterThan(0.4);
    });

    it('should recognize query_status intent', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '当前有哪些进行中的任务？' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('query_status');
    });
  });

  describe('Entity Extraction', () => {
    it('should extract priority and title from text', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建一个 P0 目标：优化 API 性能' });

      expect(response.status).toBe(200);
      expect(response.body.entities).toBeDefined();
      expect(response.body.entities.priority).toBe('P0');
      expect(response.body.entities.title).toContain('优化');
    });

    it('should map Chinese priority keywords to standard values', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建一个紧急目标：修复生产环境 Bug' });

      expect(response.status).toBe(200);
      expect(response.body.entities.priority).toBe('P0');
    });

    it('should extract title after removing intent keywords', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建目标：提升系统稳定性' });

      expect(response.status).toBe(200);
      expect(response.body.entities.title).toContain('提升系统稳定性');
    });
  });

  describe('Confidence Score', () => {
    it('should return high confidence for clear intent', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建一个新的目标：完成用户系统' });

      expect(response.status).toBe(200);
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should return unknown for ambiguous input', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '嗯嗯啊啊' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('unknown');
      expect(response.body.confidence).toBe(0);
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when text is missing', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text is required');
    });

    it('should return 400 when text is not a string', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when text is empty string', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Session Context', () => {
    it('should accept session_id in context', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '创建一个目标',
          context: { session_id: 'custom-session-123' }
        });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBeDefined();

      // Clean up
      clearContext('custom-session-123');
    });

    it('should generate session_id if not provided', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建一个任务' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBeDefined();
    });

    it('should handle empty session_id gracefully', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '创建一个目标',
          context: { session_id: '' }
        });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBeDefined();
      // Should generate new session_id instead of using empty string
    });

    it('should handle whitespace-only session_id', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({
          text: '创建一个目标',
          context: { session_id: '   ' }
        });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: '创建一个目标：测试' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('intent');
      expect(response.body).toHaveProperty('entities');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.intent).toBe('string');
      expect(typeof response.body.entities).toBe('object');
      expect(typeof response.body.confidence).toBe('number');
    });

    it('should include suggestions when intent is unknown', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: 'blah blah blah' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('unknown');
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('English Input', () => {
    it('should recognize English create goal intent', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: 'create a high priority goal: improve system performance' });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('create_goal');
      expect(response.body.confidence).toBeGreaterThan(0.4);
    });

    it('should extract priority from English keywords', async () => {
      const response = await request(app)
        .post('/api/brain/intent')
        .send({ text: 'create an urgent task: fix critical bug' });

      expect(response.status).toBe(200);
      expect(response.body.entities.priority).toBe('P0');
    });
  });
});

describe('GET /api/brain/intent/context-stats', () => {
  it('should return context statistics', async () => {
    const response = await request(app)
      .get('/api/brain/intent/context-stats');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.stats).toBeDefined();
    expect(typeof response.body.stats.totalSessions).toBe('number');
    expect(typeof response.body.stats.activeSessions).toBe('number');
    expect(typeof response.body.stats.totalEntities).toBe('number');
  });
});
