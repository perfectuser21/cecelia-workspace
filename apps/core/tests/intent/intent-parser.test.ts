/**
 * Intent Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/intent/intent-parser.js';

describe('Intent Parser', () => {
  describe('create_task intent', () => {
    it('能够识别 create_task 意图（输入"我想创建一个任务"时返回 create_task）', () => {
      const result = parseIntent('我想创建一个任务');
      expect(result.intent_type).toBe('create_task');
    });

    it('能够提取标题、优先级（P0/P1/P2）', () => {
      const result = parseIntent('创建一个 P0 优先级的登录功能任务');
      expect(result.intent_type).toBe('create_task');

      const titleEntity = result.entities.find(e => e.type === 'title');
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.value).toContain('登录功能');

      const priorityEntity = result.entities.find(e => e.type === 'priority');
      expect(priorityEntity).toBeDefined();
      expect(priorityEntity?.value).toBe('P0');
    });

    it('能够关联当前 Brain 状态中的 current_focus 项目', () => {
      const brainFocus = {
        project: 'cecelia-workspace',
        goal: 'Brain System MVP',
      };

      const result = parseIntent('创建一个新任务', brainFocus);
      expect(result.intent_type).toBe('create_task');

      const projectEntity = result.entities.find(e => e.type === 'project');
      expect(projectEntity?.value).toBe('cecelia-workspace');

      const goalEntity = result.entities.find(e => e.type === 'goal');
      expect(goalEntity?.value).toBe('Brain System MVP');
    });
  });

  describe('query_status intent', () => {
    it('能够识别 query_status 意图（输入"查看当前任务状态"时返回 query_status）', () => {
      const result = parseIntent('查看当前任务状态');
      expect(result.intent_type).toBe('query_status');
    });
  });

  describe('update_progress intent', () => {
    it('能够识别 update_progress 意图（输入"更新任务进度到50%"时返回 update_progress）', () => {
      const result = parseIntent('更新任务进度到50%');
      expect(result.intent_type).toBe('update_progress');

      const progressEntity = result.entities.find(e => e.type === 'progress');
      expect(progressEntity).toBeDefined();
      expect(progressEntity?.value).toBe('50');
    });
  });

  describe('边界情况', () => {
    it('模糊不清的输入（如"帮我做点事"）返回低置信度 + 建议澄清', () => {
      const result = parseIntent('帮我做点事');
      expect(result.confidence).toBeLessThan(0.6);
      expect(result.suggested_action.type).toBe('clarify');
    });

    it('空字符串输入返回低置信度和澄清建议', () => {
      const result = parseIntent('');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggested_action.type).toBe('clarify');
      expect(result.suggested_action.parameters).toHaveProperty('message');
    });

    it('只有空格的输入应该被处理为空输入', () => {
      const result = parseIntent('   ');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggested_action.type).toBe('clarify');
    });
  });

  describe('confidence calculation', () => {
    it('清晰的意图应该有较高的置信度', () => {
      const result = parseIntent('创建一个 P1 任务：实现登录功能');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('模糊的意图应该有较低的置信度', () => {
      const result = parseIntent('做点什么');
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('反例测试：无效输入', () => {
    it('无关内容（如"天气真好"）应该返回低置信度', () => {
      const result = parseIntent('天气真好');
      expect(result.confidence).toBeLessThan(0.6);
    });

    it('输入包含特殊字符不应导致解析异常', () => {
      expect(() => {
        parseIntent("'; DROP TABLE tasks; --");
      }).not.toThrow();
    });

    it('超长输入（>10000字符）不应导致性能问题', () => {
      const longText = 'a'.repeat(10000);
      const start = Date.now();
      const result = parseIntent(longText);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      expect(result).toBeDefined();
    });

    it('brainFocus 为 undefined 时不应崩溃', () => {
      const result = parseIntent('创建一个新任务', undefined);
      expect(result).toBeDefined();
      expect(result.intent_type).toBe('create_task');
      const projectEntity = result.entities.find(e => e.type === 'project');
      expect(projectEntity).toBeUndefined();
    });
  });
});
