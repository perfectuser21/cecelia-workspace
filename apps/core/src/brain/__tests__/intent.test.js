/**
 * Intent Recognition Module Tests (KR1)
 * Tests for natural language → structured intent parsing
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import {
  INTENT_TYPES,
  classifyIntent,
  extractProjectName,
  generateTasks,
  generatePrdDraft,
  parseIntent,
  parseAndCreate
} from '../intent.js';

const { Pool } = pg;

// Use test database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cecelia_tasks',
  user: process.env.DB_USER || 'n8n_user',
  password: process.env.DB_PASSWORD || 'n8n_password_2025'
});

// Track created resources for cleanup
let createdProjectIds = [];
let createdTaskIds = [];

describe('Intent Recognition Module', () => {
  beforeAll(async () => {
    // Verify database connection
    const result = await pool.query('SELECT 1');
    expect(result.rows[0]['?column?']).toBe(1);
  });

  afterAll(async () => {
    await pool.end();
  });

  afterEach(async () => {
    // Cleanup test data
    for (const taskId of createdTaskIds) {
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]).catch(() => {});
    }
    for (const projectId of createdProjectIds) {
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]).catch(() => {});
    }
    createdTaskIds = [];
    createdProjectIds = [];
  });

  describe('classifyIntent', () => {
    it('classifies create project intent correctly', () => {
      const result = classifyIntent('我想做一个 GMV Dashboard');

      expect(result.type).toBe(INTENT_TYPES.CREATE_PROJECT);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('classifies create feature intent correctly', () => {
      const result = classifyIntent('给登录页面添加一个忘记密码功能');

      expect(result.type).toBe(INTENT_TYPES.CREATE_FEATURE);
      expect(result.keywords).toContain('添加');
    });

    it('classifies fix bug intent correctly', () => {
      const result = classifyIntent('修复购物车页面的价格显示问题');

      expect(result.type).toBe(INTENT_TYPES.FIX_BUG);
      expect(result.keywords).toContain('修复');
    });

    it('classifies refactor intent correctly', () => {
      const result = classifyIntent('重构用户模块的代码结构');

      expect(result.type).toBe(INTENT_TYPES.REFACTOR);
      expect(result.keywords).toContain('重构');
    });

    it('classifies explore intent correctly', () => {
      const result = classifyIntent('帮我看看这个 API 怎么用');

      expect(result.type).toBe(INTENT_TYPES.EXPLORE);
      expect(result.keywords).toContain('看看');
    });

    it('classifies question intent correctly', () => {
      const result = classifyIntent('为什么这里会报错？');

      expect(result.type).toBe(INTENT_TYPES.QUESTION);
      expect(result.keywords.some(k => k === '为什么' || k === '？')).toBe(true);
    });

    it('returns lower confidence for ambiguous input', () => {
      const result = classifyIntent('hello world');

      // Input without clear intent keywords should have low/zero confidence
      expect(result.confidence).toBeLessThanOrEqual(0.33);
    });

    it('handles English keywords', () => {
      const result = classifyIntent('I want to create a new project');

      expect(result.type).toBe(INTENT_TYPES.CREATE_PROJECT);
      expect(result.keywords).toContain('create');
    });
  });

  describe('extractProjectName', () => {
    it('extracts project name from Chinese input', () => {
      const name = extractProjectName('我想做一个 GMV Dashboard', INTENT_TYPES.CREATE_PROJECT);

      expect(name).toBe('gmv-dashboard');
    });

    it('removes common phrases', () => {
      const name = extractProjectName('请帮我创建一个用户系统', INTENT_TYPES.CREATE_PROJECT);

      // After removing 帮我 and 创建, should have: "请一个用户系统"
      expect(name).toContain('用户系统');
    });

    it('converts spaces to dashes', () => {
      const name = extractProjectName('做一个 user authentication system', INTENT_TYPES.CREATE_PROJECT);

      expect(name).toBe('user-authentication-system');
    });

    it('returns default name for empty input', () => {
      const name = extractProjectName('做一个', INTENT_TYPES.CREATE_PROJECT);

      expect(name).toBe('untitled-project');
    });
  });

  describe('generateTasks', () => {
    it('generates 5 tasks for create project intent', () => {
      const tasks = generateTasks('test-project', INTENT_TYPES.CREATE_PROJECT, 'test');

      expect(tasks.length).toBe(5);
      expect(tasks[0].priority).toBe('P0');
      expect(tasks[0].title).toContain('设计');
      expect(tasks[1].title).toContain('后端');
      expect(tasks[2].title).toContain('前端');
      expect(tasks[3].title).toContain('测试');
      expect(tasks[4].title).toContain('部署');
    });

    it('generates 3 tasks for fix bug intent', () => {
      const tasks = generateTasks('bug-fix', INTENT_TYPES.FIX_BUG, 'fix bug');

      expect(tasks.length).toBe(3);
      expect(tasks[0].title).toContain('分析');
      expect(tasks[1].title).toContain('修复');
      expect(tasks[2].title).toContain('回归');
    });

    it('generates 4 tasks for refactor intent', () => {
      const tasks = generateTasks('refactor', INTENT_TYPES.REFACTOR, 'refactor');

      expect(tasks.length).toBe(4);
    });

    it('generates 3 default tasks for unknown intent', () => {
      const tasks = generateTasks('unknown', INTENT_TYPES.UNKNOWN, 'something');

      expect(tasks.length).toBe(3);
    });
  });

  describe('generatePrdDraft', () => {
    it('generates valid PRD markdown', () => {
      const parsedIntent = {
        projectName: 'test-project',
        intentType: INTENT_TYPES.CREATE_PROJECT,
        tasks: [
          { title: 'Task 1', description: 'Desc 1', priority: 'P0' },
          { title: 'Task 2', description: 'Desc 2', priority: 'P1' }
        ],
        originalInput: 'Create a test project'
      };

      const prd = generatePrdDraft(parsedIntent);

      expect(prd).toContain('# PRD - test-project');
      expect(prd).toContain('Create a test project');
      expect(prd).toContain('Task 1');
      expect(prd).toContain('Task 2');
      expect(prd).toContain('**优先级**: P0');
    });
  });

  describe('parseIntent', () => {
    it('parses complete intent structure', async () => {
      const result = await parseIntent('我想做一个 GMV Dashboard');

      expect(result.originalInput).toBe('我想做一个 GMV Dashboard');
      expect(result.intentType).toBe(INTENT_TYPES.CREATE_PROJECT);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.projectName).toBe('gmv-dashboard');
      expect(result.tasks.length).toBeGreaterThanOrEqual(3);
      expect(result.prdDraft).toContain('# PRD');
    });

    it('throws error for empty input', async () => {
      await expect(parseIntent('')).rejects.toThrow('Input is required');
    });

    it('throws error for non-string input', async () => {
      await expect(parseIntent(123)).rejects.toThrow('Input is required');
    });

    it('trims whitespace from input', async () => {
      const result = await parseIntent('  做一个测试项目  ');

      expect(result.originalInput).toBe('做一个测试项目');
    });
  });

  describe('parseAndCreate', () => {
    it('creates project and tasks in database', async () => {
      const result = await parseAndCreate('我想做一个测试项目 Test Project');

      expect(result.parsed).toBeDefined();
      expect(result.created.project).toBeDefined();
      expect(result.created.tasks.length).toBeGreaterThan(0);

      // Track for cleanup
      if (result.created.project?.id && result.created.project.created) {
        createdProjectIds.push(result.created.project.id);
      }
      for (const task of result.created.tasks) {
        createdTaskIds.push(task.id);
      }

      // Verify project was created
      const projectQuery = await pool.query(
        'SELECT * FROM projects WHERE id = $1',
        [result.created.project.id]
      );
      expect(projectQuery.rows.length).toBe(1);

      // Verify tasks were created
      for (const task of result.created.tasks) {
        const taskQuery = await pool.query(
          'SELECT * FROM tasks WHERE id = $1',
          [task.id]
        );
        expect(taskQuery.rows.length).toBe(1);
        expect(taskQuery.rows[0].status).toBe('queued');
      }
    });

    it('reuses existing project with similar name', async () => {
      // First create a project
      const firstResult = await parseAndCreate('做一个 Widget Dashboard');
      if (firstResult.created.project?.id && firstResult.created.project.created) {
        createdProjectIds.push(firstResult.created.project.id);
      }
      for (const task of firstResult.created.tasks) {
        createdTaskIds.push(task.id);
      }

      // Then try to create with similar name
      const secondResult = await parseAndCreate('做一个 Widget Dashboard 增强版', {
        createProject: true,
        createTasks: true
      });
      for (const task of secondResult.created.tasks) {
        createdTaskIds.push(task.id);
      }

      // Should reuse existing project
      expect(secondResult.created.project.created).toBe(false);
      expect(secondResult.created.project.message).toBe('Using existing project');
    });

    it('skips project creation when createProject is false', async () => {
      const result = await parseAndCreate('测试功能', {
        createProject: false,
        createTasks: false
      });

      expect(result.created.project).toBeNull();
      expect(result.created.tasks.length).toBe(0);
    });

    it('links tasks to specified goal', async () => {
      // Create a test goal first
      const goalResult = await pool.query(
        `INSERT INTO goals (title, type, priority, status) VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Test Goal', 'objective', 'P1', 'pending']
      );
      const goalId = goalResult.rows[0].id;

      try {
        const result = await parseAndCreate('做一个关联目标的任务', {
          goalId,
          createProject: false
        });

        for (const task of result.created.tasks) {
          createdTaskIds.push(task.id);
          expect(task.goal_id).toBe(goalId);
        }
      } finally {
        // Cleanup goal
        await pool.query('DELETE FROM goals WHERE id = $1', [goalId]);
      }
    });
  });

  describe('Integration: End-to-end intent parsing', () => {
    it('processes "我想做一个 GMV Dashboard" correctly', async () => {
      const result = await parseIntent('我想做一个 GMV Dashboard');

      // Verify intent type
      expect(result.intentType).toBe('create_project');

      // Verify project name extraction
      expect(result.projectName).toBe('gmv-dashboard');

      // Verify tasks generated (3-6 as per PRD)
      expect(result.tasks.length).toBeGreaterThanOrEqual(3);
      expect(result.tasks.length).toBeLessThanOrEqual(6);

      // Verify PRD draft generated
      expect(result.prdDraft).toContain('GMV Dashboard');
      expect(result.prdDraft).toContain('成功标准');
      expect(result.prdDraft).toContain('任务拆解');
    });
  });
});
