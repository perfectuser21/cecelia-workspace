/* global console */
/**
 * Intent Recognition Module (KR1)
 *
 * Parses natural language input and converts it to structured:
 * - OKR (Objective and Key Results)
 * - Projects
 * - Tasks
 * - PRD drafts
 */

import pool from '../task-system/db.js';

/**
 * Intent types that can be recognized
 */
const INTENT_TYPES = {
  CREATE_PROJECT: 'create_project',      // "我想做一个 GMV Dashboard"
  CREATE_FEATURE: 'create_feature',      // "给登录页面加一个忘记密码功能"
  FIX_BUG: 'fix_bug',                    // "修复购物车页面的价格显示问题"
  REFACTOR: 'refactor',                  // "重构用户模块的代码结构"
  EXPLORE: 'explore',                    // "帮我看看这个 API 怎么用"
  QUESTION: 'question',                  // "为什么这里会报错？"
  UNKNOWN: 'unknown'
};

/**
 * Keywords for intent classification
 */
const INTENT_KEYWORDS = {
  [INTENT_TYPES.CREATE_PROJECT]: [
    '做一个', '创建', '开发', '搭建', '新建', '构建', '实现',
    'create', 'build', 'develop', 'make'
  ],
  [INTENT_TYPES.CREATE_FEATURE]: [
    '添加', '加一个', '新增', '增加', '支持', '功能',
    'add', 'feature', 'support', 'implement'
  ],
  [INTENT_TYPES.FIX_BUG]: [
    '修复', '修改', '解决', '问题', 'bug', '错误', '异常',
    'fix', 'resolve', 'error', 'issue'
  ],
  [INTENT_TYPES.REFACTOR]: [
    '重构', '优化', '改进', '整理', '清理',
    'refactor', 'optimize', 'improve', 'cleanup'
  ],
  [INTENT_TYPES.EXPLORE]: [
    '看看', '了解', '分析', '调研', '学习',
    'explore', 'analyze', 'investigate', 'learn'
  ],
  [INTENT_TYPES.QUESTION]: [
    '为什么', '怎么', '如何', '什么', '?', '？',
    'why', 'how', 'what', 'which'
  ]
};

/**
 * Classify intent from natural language input
 * @param {string} input - Natural language input
 * @returns {{ type: string, confidence: number, keywords: string[] }}
 */
function classifyIntent(input) {
  const inputLower = input.toLowerCase();
  const matchedKeywords = {};

  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = keywords.filter(kw => inputLower.includes(kw.toLowerCase()));
    if (matches.length > 0) {
      matchedKeywords[intentType] = matches;
    }
  }

  // Find intent with most keyword matches
  let bestIntent = INTENT_TYPES.UNKNOWN;
  let bestScore = 0;
  let bestKeywords = [];

  for (const [intentType, matches] of Object.entries(matchedKeywords)) {
    if (matches.length > bestScore) {
      bestScore = matches.length;
      bestIntent = intentType;
      bestKeywords = matches;
    }
  }

  // Calculate confidence (0-1)
  const confidence = Math.min(bestScore / 3, 1);

  return {
    type: bestIntent,
    confidence,
    keywords: bestKeywords
  };
}

/**
 * Extract project name from input
 * @param {string} input - Natural language input
 * @param {string} intentType - Classified intent type
 * @returns {string} - Extracted project name
 */
function extractProjectName(input, intentType) {
  // Remove common phrases to get the core topic
  const cleanedInput = input
    .replace(/我想/g, '')
    .replace(/做一个/g, '')
    .replace(/创建/g, '')
    .replace(/开发/g, '')
    .replace(/搭建/g, '')
    .replace(/新建/g, '')
    .replace(/构建/g, '')
    .replace(/实现/g, '')
    .replace(/帮我/g, '')
    .replace(/请/g, '')
    .trim();

  // Convert to kebab-case for project name
  const projectName = cleanedInput
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .toLowerCase();

  return projectName || 'untitled-project';
}

/**
 * Generate tasks for a project based on intent
 * @param {string} projectName - Project name
 * @param {string} intentType - Intent type
 * @param {string} input - Original input
 * @returns {Array<{title: string, description: string, priority: string}>}
 */
function generateTasks(projectName, intentType, input) {
  const tasks = [];

  if (intentType === INTENT_TYPES.CREATE_PROJECT || intentType === INTENT_TYPES.CREATE_FEATURE) {
    // Standard project/feature tasks
    tasks.push(
      {
        title: `设计 ${projectName} 架构`,
        description: `分析需求，设计系统架构和数据模型`,
        priority: 'P0'
      },
      {
        title: `实现 ${projectName} 后端 API`,
        description: `开发后端接口和业务逻辑`,
        priority: 'P0'
      },
      {
        title: `实现 ${projectName} 前端界面`,
        description: `开发前端 UI 组件和交互逻辑`,
        priority: 'P1'
      },
      {
        title: `编写 ${projectName} 测试`,
        description: `编写单元测试和集成测试`,
        priority: 'P1'
      },
      {
        title: `部署 ${projectName}`,
        description: `配置 CI/CD 并部署到生产环境`,
        priority: 'P2'
      }
    );
  } else if (intentType === INTENT_TYPES.FIX_BUG) {
    tasks.push(
      {
        title: `分析问题根因`,
        description: `定位 bug 原因，分析影响范围`,
        priority: 'P0'
      },
      {
        title: `修复问题`,
        description: `实现修复方案`,
        priority: 'P0'
      },
      {
        title: `添加回归测试`,
        description: `编写测试确保问题不再复现`,
        priority: 'P1'
      }
    );
  } else if (intentType === INTENT_TYPES.REFACTOR) {
    tasks.push(
      {
        title: `分析现有代码结构`,
        description: `梳理现有实现，识别优化点`,
        priority: 'P1'
      },
      {
        title: `设计重构方案`,
        description: `制定重构计划，确保向后兼容`,
        priority: 'P1'
      },
      {
        title: `实施重构`,
        description: `按计划重构代码`,
        priority: 'P1'
      },
      {
        title: `验证重构结果`,
        description: `运行测试，确保功能正常`,
        priority: 'P1'
      }
    );
  } else {
    // Default tasks for unknown intent
    tasks.push(
      {
        title: `分析需求`,
        description: `理解需求背景和目标`,
        priority: 'P1'
      },
      {
        title: `制定计划`,
        description: `制定实施计划`,
        priority: 'P1'
      },
      {
        title: `执行任务`,
        description: `按计划执行`,
        priority: 'P1'
      }
    );
  }

  return tasks;
}

/**
 * Generate PRD draft from parsed intent
 * @param {Object} parsedIntent - Parsed intent object
 * @returns {string} - PRD draft in markdown format
 */
function generatePrdDraft(parsedIntent) {
  const { projectName, intentType, tasks, originalInput } = parsedIntent;

  const prdDraft = `# PRD - ${projectName}

## 需求来源

${originalInput}

## 功能描述

基于用户需求，${intentType === INTENT_TYPES.CREATE_PROJECT ? '创建' : '实现'}${projectName}。

## 涉及文件

- src/api/${projectName}/ (后端 API)
- src/pages/${projectName}/ (前端页面)
- tests/${projectName}/ (测试文件)

## 成功标准

${tasks.map((t, i) => `- [ ] ${t.title}`).join('\n')}

## 任务拆解

${tasks.map((t, i) => `### Task ${i + 1}: ${t.title}

**优先级**: ${t.priority}
**描述**: ${t.description}
`).join('\n')}

---
*此 PRD 由 Intent Parser 自动生成，请根据实际需求进行调整。*
`;

  return prdDraft;
}

/**
 * Parse natural language input and generate structured output
 * @param {string} input - Natural language input
 * @returns {Promise<Object>} - Parsed intent with project, tasks, and PRD draft
 */
async function parseIntent(input) {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Input is required and must be a non-empty string');
  }

  const trimmedInput = input.trim();

  // Step 1: Classify intent
  const classification = classifyIntent(trimmedInput);

  // Step 2: Extract project name
  const projectName = extractProjectName(trimmedInput, classification.type);

  // Step 3: Generate tasks
  const tasks = generateTasks(projectName, classification.type, trimmedInput);

  // Step 4: Build parsed intent object
  const parsedIntent = {
    originalInput: trimmedInput,
    intentType: classification.type,
    confidence: classification.confidence,
    keywords: classification.keywords,
    projectName,
    tasks,
    prdDraft: null
  };

  // Step 5: Generate PRD draft
  parsedIntent.prdDraft = generatePrdDraft(parsedIntent);

  return parsedIntent;
}

/**
 * Parse intent and create resources in database
 * @param {string} input - Natural language input
 * @param {Object} options - Options for resource creation
 * @returns {Promise<Object>} - Created resources
 */
async function parseAndCreate(input, options = {}) {
  const { createProject = true, createTasks = true, goalId = null, projectId = null } = options;

  // Parse the intent
  const parsedIntent = await parseIntent(input);

  const result = {
    parsed: parsedIntent,
    created: {
      project: null,
      tasks: []
    }
  };

  // Check if project already exists
  let targetProjectId = projectId;

  if (createProject && !projectId) {
    // Check for existing project with similar name
    const existingProject = await pool.query(`
      SELECT id, name FROM projects
      WHERE LOWER(name) LIKE $1
      LIMIT 1
    `, [`%${parsedIntent.projectName}%`]);

    if (existingProject.rows.length > 0) {
      targetProjectId = existingProject.rows[0].id;
      result.created.project = {
        ...existingProject.rows[0],
        created: false,
        message: 'Using existing project'
      };
    } else {
      // Create new project
      const newProject = await pool.query(`
        INSERT INTO projects (name, description, status)
        VALUES ($1, $2, 'active')
        RETURNING *
      `, [parsedIntent.projectName, `Auto-created from intent: ${input}`]);

      targetProjectId = newProject.rows[0].id;
      result.created.project = {
        ...newProject.rows[0],
        created: true
      };

      console.log(`[Intent] Created project: ${targetProjectId} - ${parsedIntent.projectName}`);
    }
  }

  // Create tasks
  if (createTasks) {
    for (const task of parsedIntent.tasks) {
      const newTask = await pool.query(`
        INSERT INTO tasks (title, description, priority, project_id, goal_id, status)
        VALUES ($1, $2, $3, $4, $5, 'queued')
        RETURNING *
      `, [
        task.title,
        task.description,
        task.priority,
        targetProjectId,
        goalId
      ]);

      result.created.tasks.push(newTask.rows[0]);
      console.log(`[Intent] Created task: ${newTask.rows[0].id} - ${task.title}`);
    }
  }

  return result;
}

export {
  INTENT_TYPES,
  classifyIntent,
  extractProjectName,
  generateTasks,
  generatePrdDraft,
  parseIntent,
  parseAndCreate
};
