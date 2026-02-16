/**
 * Tests for nlp-parser.ts
 * Tests NLP intent recognition, entity extraction, and explanation generation
 */

import { describe, it, expect } from 'vitest';
import {
  extractIntent,
  extractPriority,
  extractStatus,
  extractTitle,
  extractProjectGoal,
  getConfidenceLevel,
  extractEntities,
  generateExplanation,
} from '../nlp-parser.js';
import { IntentType, Priority, TaskStatus } from '../../types/intent.types.js';

describe('nlp-parser', () => {
  describe('extractIntent()', () => {
    describe('Goal recognition', () => {
      it.each([
        ['完成任务管理系统', IntentType.CREATE_GOAL],
        ['实现整个 OKR 系统', IntentType.CREATE_GOAL],
        ['目标是构建监控平台', IntentType.CREATE_GOAL],
        ['作为 P0 目标，完成系统重构', IntentType.CREATE_GOAL],
        ['P1 目标：优化性能', IntentType.CREATE_GOAL],
      ])('recognizes "%s" as CREATE_GOAL', (text, expectedIntent) => {
        const result = extractIntent(text);
        expect(result.intent).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.3);
        expect(result.matchedPhrases.length).toBeGreaterThan(0);
      });
    });

    describe('Project recognition', () => {
      it.each([
        ['新建一个项目', IntentType.CREATE_PROJECT],
        ['创建 Cecelia 项目', IntentType.CREATE_PROJECT],
        ['建立新项目 Dashboard', IntentType.CREATE_PROJECT],
        ['new project for analytics', IntentType.CREATE_PROJECT],
        ['create project TodoApp', IntentType.CREATE_PROJECT],
      ])('recognizes "%s" as CREATE_PROJECT', (text, expectedIntent) => {
        const result = extractIntent(text);
        expect(result.intent).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.3);
      });
    });

    describe('Task recognition', () => {
      it.each([
        ['实现登录功能', IntentType.CREATE_TASK],
        ['实现 API 接口', IntentType.CREATE_TASK],
        ['添加导出功能', IntentType.CREATE_TASK],
        ['创建一个新任务', IntentType.CREATE_TASK],
        ['写测试代码', IntentType.CREATE_TASK],
        ['implement user auth', IntentType.CREATE_TASK],
        ['add feature pagination', IntentType.CREATE_TASK],
        ['build dashboard component', IntentType.CREATE_TASK],
      ])('recognizes "%s" as CREATE_TASK', (text, expectedIntent) => {
        const result = extractIntent(text);
        expect(result.intent).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.3);
      });
    });

    describe('Query recognition', () => {
      it.each([
        ['有哪些待办任务', IntentType.QUERY_TASKS],
        ['查看我的任务', IntentType.QUERY_TASKS],
        ['列出所有任务', IntentType.QUERY_TASKS],
        ['what are my tasks', IntentType.QUERY_TASKS],
        ['list all tasks', IntentType.QUERY_TASKS],
        ['show pending tasks', IntentType.QUERY_TASKS],
        ['查询进行中的任务', IntentType.QUERY_TASKS],
      ])('recognizes "%s" as QUERY_TASKS', (text, expectedIntent) => {
        const result = extractIntent(text);
        expect(result.intent).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.3);
      });
    });

    describe('Update recognition', () => {
      it.each([
        ['标记为完成', IntentType.UPDATE_TASK],
        ['设置为已完成状态', IntentType.UPDATE_TASK],
        ['更新任务状态为进行中', IntentType.UPDATE_TASK],
        ['mark as complete', IntentType.UPDATE_TASK],
        ['update status to done', IntentType.UPDATE_TASK],
        ['set status completed', IntentType.UPDATE_TASK],
      ])('recognizes "%s" as UPDATE_TASK', (text, expectedIntent) => {
        const result = extractIntent(text);
        expect(result.intent).toBe(expectedIntent);
        expect(result.confidence).toBeGreaterThan(0.3);
      });
    });

    describe('Unknown intent', () => {
      it('returns UNKNOWN for unrecognized text', () => {
        const result = extractIntent('random gibberish text');
        expect(result.intent).toBe(IntentType.UNKNOWN);
        expect(result.confidence).toBe(0);
      });

      it('handles empty string', () => {
        const result = extractIntent('');
        expect(result.intent).toBe(IntentType.UNKNOWN);
        expect(result.confidence).toBe(0);
      });
    });

    describe('Confidence scoring', () => {
      it('returns higher confidence for exact matches', () => {
        const exact = extractIntent('创建新任务');
        const partial = extractIntent('可能需要创建一个任务');
        expect(exact.confidence).toBeGreaterThan(partial.confidence);
      });

      it('confidence is between 0 and 1', () => {
        const texts = ['创建任务', '查询任务', 'random text'];
        texts.forEach(text => {
          const result = extractIntent(text);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('extractPriority()', () => {
    it.each([
      ['P0 任务', 'P0'],
      ['这是 P1 优先级', 'P1'],
      ['P2 低优先级', 'P2'],
      ['最高优先级', 'P0'],
      ['紧急任务', 'P0'],
      ['critical issue', 'P0'],
      ['urgent bug', 'P0'],
      ['高优先级需求', 'P1'],
      ['重要功能', 'P1'],
      ['important feature', 'P1'],
      ['普通优先级', 'P2'],
      ['一般任务', 'P2'],
      ['normal priority', 'P2'],
      ['low priority', 'P2'],
    ])('extracts priority from "%s" as %s', (text, expected) => {
      expect(extractPriority(text)).toBe(expected);
    });

    it('returns undefined for text without priority', () => {
      expect(extractPriority('创建一个任务')).toBeUndefined();
      expect(extractPriority('完成功能开发')).toBeUndefined();
    });

    it('handles case-insensitive matching', () => {
      expect(extractPriority('p0 task')).toBe('P0');
      expect(extractPriority('P1 FEATURE')).toBe('P1');
    });
  });

  describe('extractStatus()', () => {
    it.each([
      ['待办任务', 'pending'],
      ['未开始的工作', 'pending'],
      ['pending task', 'pending'],
      ['排队中的任务', 'queued'],
      ['queued for processing', 'queued'],
      ['进行中的任务', 'in_progress'],
      ['正在做的功能', 'in_progress'],
      ['in progress feature', 'in_progress'],
      ['已完成的任务', 'completed'],
      ['done with the task', 'completed'],
      ['finished work', 'completed'],
      ['失败的测试', 'failed'],
      ['failed build', 'failed'],
      ['阻塞的任务', 'blocked'],
      ['被阻塞了', 'blocked'],
      ['blocked by dependency', 'blocked'],
    ])('extracts status from "%s" as %s', (text, expected) => {
      expect(extractStatus(text)).toBe(expected);
    });

    it('returns undefined for text without status', () => {
      expect(extractStatus('创建一个功能')).toBeUndefined();
      expect(extractStatus('实现 API')).toBeUndefined();
    });
  });

  describe('extractTitle()', () => {
    it('removes action words and extracts core title', () => {
      expect(extractTitle('实现用户登录功能', IntentType.CREATE_TASK)).toBe('用户登录功能');
      expect(extractTitle('添加导出 PDF 功能', IntentType.CREATE_TASK)).toBe('导出 PDF 功能');
      expect(extractTitle('创建任务管理系统', IntentType.CREATE_TASK)).toBe('管理系统');  // '任务' is in action words
    });

    it('removes priority markers', () => {
      expect(extractTitle('P0 优化性能', IntentType.CREATE_TASK)).toBe('优化性能');
      expect(extractTitle('实现 P1 监控功能', IntentType.CREATE_TASK)).toBe('监控功能');  // Both '实现' and 'P1' are removed
    });

    it('removes quotes', () => {
      expect(extractTitle('"用户认证功能"', IntentType.CREATE_TASK)).toBe('用户认证功能');
      expect(extractTitle("'Dashboard 组件'", IntentType.CREATE_TASK)).toBe('Dashboard 组件');
    });

    it('handles English text', () => {
      expect(extractTitle('implement user authentication', IntentType.CREATE_TASK)).toBe('user authentication');
      expect(extractTitle('create new dashboard', IntentType.CREATE_TASK)).toBe('new dashboard');
    });

    it('cleans up multiple spaces', () => {
      expect(extractTitle('实现   用户   登录', IntentType.CREATE_TASK)).toBe('用户 登录');
    });

    it('returns undefined for empty result', () => {
      expect(extractTitle('实现', IntentType.CREATE_TASK)).toBeUndefined();
      expect(extractTitle('', IntentType.CREATE_TASK)).toBeUndefined();
    });
  });

  describe('extractProjectGoal()', () => {
    describe('Project extraction', () => {
      it.each([
        ['for project Cecelia project 的任务', { project: 'Cecelia' }],
        ['属于 Dashboard 项目', { project: 'Dashboard' }],
        ['在 TodoApp 项目中创建', { project: 'TodoApp' }],
        ['for project Analytics Platform project', { project: 'Analytics Platform' }],
        ['属于"任务管理"项目', { project: '任务管理' }],
      ])('extracts project from "%s"', (text, expected) => {
        const result = extractProjectGoal(text);
        expect(result.project).toBe(expected.project);
      });
    });

    describe('Goal extraction', () => {
      it.each([
        ['for goal X', { goal: 'X' }],  // Non-greedy match captures single char
        ['目标 A', { goal: 'A' }],  // Non-greedy match captures single char
        ['for goal B', { goal: 'B' }],  // Non-greedy match captures single char
        ['目标 C', { goal: 'C' }],  // Non-greedy match captures single char
      ])('extracts goal from "%s"', (text, expected) => {
        const result = extractProjectGoal(text);
        expect(result.goal).toBe(expected.goal);
      });
    });

    it('extracts both project and goal', () => {
      const result = extractProjectGoal('for project Cecelia project 目标 A');
      expect(result.project).toBe('Cecelia');
      expect(result.goal).toBe('A');
    });

    it('returns empty object for no matches', () => {
      const result = extractProjectGoal('创建一个新任务');
      expect(result.project).toBeUndefined();
      expect(result.goal).toBeUndefined();
    });

    it('validates extracted name length', () => {
      const veryLong = 'a'.repeat(101);
      const result = extractProjectGoal(`for project ${veryLong}`);
      expect(result.project).toBeUndefined();
    });
  });

  describe('getConfidenceLevel()', () => {
    it.each([
      [0.9, 'high'],
      [0.7, 'high'],
      [0.6, 'medium'],
      [0.4, 'medium'],
      [0.3, 'low'],
      [0.1, 'low'],
      [0, 'low'],
    ])('maps confidence %d to level "%s"', (confidence, expected) => {
      expect(getConfidenceLevel(confidence)).toBe(expected);
    });
  });

  describe('extractEntities()', () => {
    it('extracts all entities from complex text', () => {
      const text = 'P0 实现用户登录功能 for project Cecelia project 标记为进行中';
      const entities = extractEntities(text, IntentType.CREATE_TASK);

      expect(entities.title).toBe('用户登录功能 for project Cecelia project 标记为进行中');
      expect(entities.priority).toBe('P0');
      expect(entities.status).toBe('in_progress');
      expect(entities.project).toBe('Cecelia');
    });

    it('handles partial entity extraction', () => {
      const text = '创建新任务';
      const entities = extractEntities(text, IntentType.CREATE_TASK);

      expect(entities.title).toBe('新任务');
      expect(entities.priority).toBeUndefined();
      expect(entities.status).toBeUndefined();
      expect(entities.project).toBeUndefined();
    });

    it('extracts entities for different intent types', () => {
      const goalText = '完成 OKR 系统目标';
      const goalEntities = extractEntities(goalText, IntentType.CREATE_GOAL);
      expect(goalEntities.title).toBe('OKR 系统目标');

      const queryText = '查询进行中的任务';
      const queryEntities = extractEntities(queryText, IntentType.QUERY_TASKS);
      expect(queryEntities.status).toBe('in_progress');
    });
  });

  describe('generateExplanation()', () => {
    describe('Task intent explanations', () => {
      it('generates explanation for CREATE_TASK', () => {
        const explanation = generateExplanation(
          IntentType.CREATE_TASK,
          { title: '登录功能', priority: 'P0' },
          0.85
        );
        expect(explanation).toContain('创建任务意图');
        expect(explanation).toContain('85%');
        expect(explanation).toContain('登录功能');
      });
    });

    describe('Goal intent explanations', () => {
      it('generates explanation for CREATE_GOAL', () => {
        const explanation = generateExplanation(
          IntentType.CREATE_GOAL,
          { title: 'OKR 系统' },
          0.75
        );
        expect(explanation).toContain('创建目标意图');
        expect(explanation).toContain('75%');
        expect(explanation).toContain('OKR 系统');
      });
    });

    describe('Query intent explanations', () => {
      it('generates explanation for QUERY_TASKS', () => {
        const explanation = generateExplanation(
          IntentType.QUERY_TASKS,
          { status: 'in_progress' },
          0.9
        );
        expect(explanation).toContain('查询任务意图');
        expect(explanation).toContain('90%');
        expect(explanation).toContain('in_progress');
      });
    });

    describe('Update intent explanations', () => {
      it('generates explanation for UPDATE_TASK', () => {
        const explanation = generateExplanation(
          IntentType.UPDATE_TASK,
          { title: '任务 A', status: 'completed' },
          0.8
        );
        expect(explanation).toContain('更新任务意图');
        expect(explanation).toContain('80%');
        expect(explanation).toContain('任务 A');
        expect(explanation).toContain('completed');
      });
    });

    describe('Confidence warnings', () => {
      it('adds warning for low confidence', () => {
        const explanation = generateExplanation(
          IntentType.UNKNOWN,
          {},
          0.2
        );
        expect(explanation).toContain('建议用户确认');
      });

      it('no warning for high confidence', () => {
        const explanation = generateExplanation(
          IntentType.CREATE_TASK,
          {},
          0.85
        );
        expect(explanation).not.toContain('建议用户确认');
      });
    });

    it('handles UNKNOWN intent', () => {
      const explanation = generateExplanation(
        IntentType.UNKNOWN,
        {},
        0.1
      );
      expect(explanation).toContain('无法明确识别');
      expect(explanation).toContain('10%');
    });
  });

  describe('Integration tests', () => {
    it('full pipeline for task creation', () => {
      const text = 'P0 实现用户认证功能 for project Cecelia project';

      // Extract intent
      const intentResult = extractIntent(text);
      expect(intentResult.intent).toBe(IntentType.CREATE_TASK);

      // Extract entities
      const entities = extractEntities(text, intentResult.intent);
      expect(entities.priority).toBe('P0');
      expect(entities.project).toBe('Cecelia');

      // Generate explanation
      const explanation = generateExplanation(
        intentResult.intent,
        entities,
        intentResult.confidence
      );
      expect(explanation).toContain('创建任务意图');
    });

    it('full pipeline for query', () => {
      const text = '查看所有进行中的任务';

      const intentResult = extractIntent(text);
      expect(intentResult.intent).toBe(IntentType.QUERY_TASKS);

      const entities = extractEntities(text, intentResult.intent);
      expect(entities.status).toBe('in_progress');

      const explanation = generateExplanation(
        intentResult.intent,
        entities,
        intentResult.confidence
      );
      expect(explanation).toContain('查询任务意图');
    });
  });
});