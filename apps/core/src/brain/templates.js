/**
 * Document Templates Module
 *
 * Provides standardized templates for PRD (Product Requirements Document)
 * and TRD (Technical Requirements Document) generation.
 */

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Current date
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate frontmatter for documents
 * @param {Object} options - Frontmatter options
 * @param {string} options.id - Document ID
 * @param {string} options.version - Document version (default: 1.0.0)
 * @param {string} options.created - Created date (default: today)
 * @param {string} options.updated - Updated date (default: today)
 * @returns {string} Frontmatter string
 */
function generateFrontmatter(options) {
  const {
    id,
    version = '1.0.0',
    created = getCurrentDate(),
    updated = getCurrentDate()
  } = options;

  return `---
id: ${id}
version: ${version}
created: ${created}
updated: ${updated}
changelog:
  - ${version}: 初始版本
---`;
}

/**
 * Standard PRD Template Structure
 */
const PRD_TEMPLATE = {
  name: 'prd',
  sections: [
    {
      id: 'background',
      title: '背景',
      description: '项目背景和需求来源',
      required: true
    },
    {
      id: 'objectives',
      title: '目标',
      description: '项目目标和预期成果',
      required: true
    },
    {
      id: 'functional_requirements',
      title: '功能需求',
      description: '核心功能描述',
      required: true
    },
    {
      id: 'non_functional_requirements',
      title: '非功能需求',
      description: '性能、安全、可用性等要求',
      required: false
    },
    {
      id: 'acceptance_criteria',
      title: '验收标准',
      description: '功能验收检查清单',
      required: true
    },
    {
      id: 'milestones',
      title: '里程碑',
      description: '项目阶段划分',
      required: false
    }
  ]
};

/**
 * Standard TRD Template Structure (aligned with prds/templates/TRD-TEMPLATE.md)
 */
const TRD_TEMPLATE = {
  name: 'trd',
  sections: [
    {
      id: 'overview',
      title: '概述',
      description: '目标、背景、范围',
      required: true
    },
    {
      id: 'system_architecture',
      title: '系统架构',
      description: '架构图和组件说明',
      required: true
    },
    {
      id: 'data_model',
      title: '数据模型',
      description: '数据库变更和数据流',
      required: true
    },
    {
      id: 'prd_decomposition',
      title: 'PRD 拆解',
      description: '依赖图和 PRD 清单',
      required: false
    },
    {
      id: 'api_design',
      title: '接口设计',
      description: '端点定义和请求/响应格式',
      required: true
    },
    {
      id: 'technical_decisions',
      title: '技术决策',
      description: '决策记录和风险缓解',
      required: false
    },
    {
      id: 'acceptance_criteria',
      title: '验收标准',
      description: '功能、技术、集成验收清单',
      required: true
    },
    {
      id: 'appendix',
      title: '附录',
      description: '相关文档和变更日志',
      required: false
    }
  ]
};

/**
 * Render PRD document from parsed intent
 * @param {Object} parsedIntent - Parsed intent object
 * @param {Object} options - Rendering options
 * @returns {string} Rendered PRD markdown
 */
function renderPrd(parsedIntent, options = {}) {
  const {
    projectName,
    intentType,
    tasks = [],
    originalInput,
    entities = {}
  } = parsedIntent;

  const {
    includeFrontmatter = true,
    version = '1.0.0'
  } = options;

  const docId = `prd-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const today = getCurrentDate();

  let prd = '';

  // Frontmatter
  if (includeFrontmatter) {
    prd += generateFrontmatter({ id: docId, version, created: today, updated: today });
    prd += '\n\n';
  }

  // Title
  prd += `# PRD - ${projectName}\n\n`;

  // Background
  prd += `## 背景\n\n`;
  prd += `${originalInput}\n\n`;

  // Objectives
  prd += `## 目标\n\n`;
  const objectiveVerb = getIntentVerb(intentType);
  prd += `${objectiveVerb}${projectName}，满足用户需求。\n\n`;

  // Functional Requirements
  prd += `## 功能需求\n\n`;
  if (tasks.length > 0) {
    tasks.forEach((task, index) => {
      prd += `### ${index + 1}. ${task.title}\n\n`;
      prd += `${task.description}\n\n`;
    });
  } else {
    prd += `待定义。\n\n`;
  }

  // Non-functional Requirements
  prd += `## 非功能需求\n\n`;
  prd += `- 性能：响应时间 < 500ms\n`;
  prd += `- 安全：符合安全编码规范\n`;
  prd += `- 可用性：支持错误恢复\n\n`;

  // Acceptance Criteria
  prd += `## 验收标准\n\n`;
  if (tasks.length > 0) {
    tasks.forEach(task => {
      prd += `- [ ] ${task.title}\n`;
    });
    prd += `- [ ] 所有测试通过\n`;
    prd += `- [ ] 代码审查完成\n\n`;
  } else {
    prd += `待定义。\n\n`;
  }

  // Milestones
  prd += `## 里程碑\n\n`;
  prd += `| 阶段 | 描述 | 状态 |\n`;
  prd += `|------|------|------|\n`;
  prd += `| M1 | 需求确认 | 待开始 |\n`;
  prd += `| M2 | 开发完成 | 待开始 |\n`;
  prd += `| M3 | 测试验收 | 待开始 |\n\n`;

  // Involved files (if entities provide info)
  prd += `## 涉及文件\n\n`;
  if (entities.filePath) {
    prd += `- ${entities.filePath}\n`;
  } else {
    prd += `- src/${projectName}/ (源代码)\n`;
    prd += `- tests/${projectName}/ (测试文件)\n`;
  }
  prd += '\n';

  // Footer
  prd += `---\n*此 PRD 由 Intent Parser 自动生成，请根据实际需求进行调整。*\n`;

  return prd;
}

/**
 * Render TRD document from parsed intent
 * @param {Object} parsedIntent - Parsed intent object
 * @param {Object} options - Rendering options
 * @returns {string} Rendered TRD markdown
 */
function renderTrd(parsedIntent, options = {}) {
  const {
    projectName,
    intentType,
    tasks = [],
    originalInput,
    entities = {}
  } = parsedIntent;

  const {
    includeFrontmatter = true,
    version = '1.0.0'
  } = options;

  const docId = `trd-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const today = getCurrentDate();
  const tableName = projectName.replace(/-/g, '_');

  let trd = '';

  // Frontmatter
  if (includeFrontmatter) {
    trd += generateFrontmatter({ id: docId, version, created: today, updated: today });
    trd += '\n\n';
  }

  // Title
  trd += `# TRD: ${projectName}\n\n`;

  // 1. 概述
  trd += `## 概述\n\n`;
  trd += `### 目标\n\n`;
  const objectiveVerb = getIntentVerb(intentType);
  trd += `${objectiveVerb}${projectName}，满足技术需求。\n\n`;
  trd += `### 背景\n\n`;
  trd += `${originalInput}\n\n`;
  trd += `### 范围\n\n`;
  trd += `- **包含**：${projectName} 核心功能实现\n`;
  trd += `- **不包含**：无关模块的修改\n\n`;

  // 2. 系统架构
  trd += `## 系统架构\n\n`;
  trd += `### 架构图\n\n`;
  trd += '```\n';
  trd += `┌─────────────┐    ┌─────────────┐    ┌─────────────┐\n`;
  trd += `│   Client    │───▶│   Server    │───▶│  Database   │\n`;
  trd += `└─────────────┘    └─────────────┘    └─────────────┘\n`;
  trd += '```\n\n';
  trd += `### 组件说明\n\n`;
  trd += `| 组件 | 职责 | 依赖 |\n`;
  trd += `|------|------|------|\n`;
  if (entities.module) {
    trd += `| ${entities.module} | 核心业务逻辑 | 无 |\n`;
  }
  if (entities.component) {
    trd += `| ${entities.component} | UI 组件 | ${entities.module || '无'} |\n`;
  }
  if (!entities.module && !entities.component) {
    trd += `| ${projectName} | 核心模块 | 无 |\n`;
  }
  trd += '\n';

  // 3. 数据模型
  trd += `## 数据模型\n\n`;
  trd += `### 数据库变更\n\n`;
  trd += '```sql\n';
  trd += `CREATE TABLE ${tableName} (\n`;
  trd += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  trd += `  name VARCHAR(255) NOT NULL,\n`;
  trd += `  status VARCHAR(50) DEFAULT 'pending',\n`;
  trd += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
  trd += `  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  trd += `);\n`;
  trd += '```\n\n';
  trd += `### 数据流\n\n`;
  trd += '```\n';
  trd += `[输入] → [处理] → [存储] → [输出]\n`;
  trd += '```\n\n';

  // 4. PRD 拆解
  trd += `## PRD 拆解\n\n`;
  trd += `### 依赖图\n\n`;
  if (tasks.length > 0) {
    trd += '```\n';
    tasks.forEach((task, i) => {
      trd += `PRD-${String(i + 1).padStart(2, '0')} (${task.title})`;
      trd += i < tasks.length - 1 ? '\n    ↓\n' : '\n';
    });
    trd += '```\n\n';
  } else {
    trd += '```\n';
    trd += `PRD-01 (基础)\n    ↓\nPRD-02 (实现)\n    ↓\nPRD-03 (验收)\n`;
    trd += '```\n\n';
  }
  trd += `### PRD 清单\n\n`;
  trd += `| 序号 | 描述 | 依赖 |\n`;
  trd += `|------|------|------|\n`;
  if (tasks.length > 0) {
    tasks.forEach((task, i) => {
      const dep = i === 0 ? '无' : String(i).padStart(2, '0');
      trd += `| ${String(i + 1).padStart(2, '0')} | ${task.title} | ${dep} |\n`;
    });
  } else {
    trd += `| 01 | 基础实现 | 无 |\n`;
    trd += `| 02 | 功能开发 | 01 |\n`;
    trd += `| 03 | 测试验收 | 02 |\n`;
  }
  trd += '\n';

  // 5. 接口设计
  trd += `## 接口设计\n\n`;
  trd += `### API 端点\n\n`;
  trd += `| 方法 | 路径 | 描述 |\n`;
  trd += `|------|------|------|\n`;
  if (entities.apiEndpoint) {
    trd += `| GET | ${entities.apiEndpoint} | 获取数据 |\n`;
  } else {
    trd += `| GET | /api/${projectName} | 获取列表 |\n`;
    trd += `| POST | /api/${projectName} | 创建记录 |\n`;
    trd += `| PATCH | /api/${projectName}/:id | 更新记录 |\n`;
    trd += `| DELETE | /api/${projectName}/:id | 删除记录 |\n`;
  }
  trd += '\n';
  trd += `### 请求/响应示例\n\n`;
  trd += '```json\n';
  trd += `// POST /api/${projectName}\n`;
  trd += `{\n`;
  trd += `  "name": "example",\n`;
  trd += `  "data": {}\n`;
  trd += `}\n\n`;
  trd += `// Response\n`;
  trd += `{\n`;
  trd += `  "id": "uuid",\n`;
  trd += `  "name": "example",\n`;
  trd += `  "created_at": "${today}T00:00:00Z"\n`;
  trd += `}\n`;
  trd += '```\n\n';

  // 6. 技术决策
  trd += `## 技术决策\n\n`;
  trd += `### 决策记录\n\n`;
  trd += `| 决策点 | 选项 A | 选项 B | 决定 | 原因 |\n`;
  trd += `|--------|--------|--------|------|------|\n`;
  trd += `| 数据存储 | PostgreSQL | MongoDB | PostgreSQL | 已有基础设施 |\n\n`;
  trd += `### 风险与缓解\n\n`;
  trd += `| 风险 | 影响 | 缓解措施 |\n`;
  trd += `|------|------|----------|\n`;
  trd += `| 性能问题 | 中 | 添加索引，分页查询 |\n\n`;

  // 7. 验收标准
  trd += `## 验收标准\n\n`;
  trd += `### 功能验收\n\n`;
  if (tasks.length > 0) {
    tasks.forEach(task => {
      trd += `- [ ] ${task.title} 正常工作\n`;
    });
  } else {
    trd += `- [ ] 核心功能正常工作\n`;
    trd += `- [ ] API 响应符合规范\n`;
  }
  trd += '\n';
  trd += `### 技术验收\n\n`;
  trd += `- [ ] 所有测试通过\n`;
  trd += `- [ ] 无 linting 错误\n`;
  trd += `- [ ] 数据库迁移可回滚\n\n`;
  trd += `### 集成验收\n\n`;
  trd += `- [ ] API 接口联调正常\n`;
  trd += `- [ ] 与现有功能无冲突\n\n`;

  // 8. 附录
  trd += `## 附录\n\n`;
  trd += `### 相关文档\n\n`;
  trd += `- ${projectName} PRD\n\n`;
  trd += `### 变更日志\n\n`;
  trd += `| 版本 | 日期 | 变更 |\n`;
  trd += `|------|------|------|\n`;
  trd += `| ${version} | ${today} | 初始版本 |\n`;

  return trd;
}

/**
 * Get verb based on intent type
 * @param {string} intentType - Intent type
 * @returns {string} Action verb
 */
function getIntentVerb(intentType) {
  const verbs = {
    'create_project': '创建并实现',
    'create_feature': '添加',
    'fix_bug': '修复',
    'refactor': '重构和优化',
    'explore': '探索和分析',
    'question': '解答关于',
    'unknown': '处理'
  };
  return verbs[intentType] || '实现';
}

/**
 * PRD type to intent type mapping
 */
const PRD_TYPE_MAP = {
  feature: 'create_feature',
  bugfix: 'fix_bug',
  refactor: 'refactor'
};

/**
 * Generate a PRD from a task description
 * @param {Object} params - Generation parameters
 * @param {string} params.title - Task title (required)
 * @param {string} params.description - Task description
 * @param {string} params.type - PRD type: feature | bugfix | refactor (default: feature)
 * @param {Object} options - Rendering options
 * @returns {string} Generated PRD markdown
 */
function generatePrdFromTask(params, options = {}) {
  const { title, description = '', type = 'feature' } = params;
  const intentType = PRD_TYPE_MAP[type] || 'create_feature';

  const parsedIntent = {
    projectName: title,
    intentType,
    tasks: [],
    originalInput: description || title,
    entities: {}
  };

  return renderPrd(parsedIntent, options);
}

/**
 * Generate a TRD from a goal description
 * @param {Object} params - Generation parameters
 * @param {string} params.title - Goal title (required)
 * @param {string} params.description - Goal description
 * @param {Array<{title: string, description?: string}>} params.milestones - Optional milestones
 * @param {Object} options - Rendering options
 * @returns {string} Generated TRD markdown
 */
function generateTrdFromGoal(params, options = {}) {
  const { title, description = '', milestones = [] } = params;

  const tasks = milestones.map((m, i) => ({
    title: m.title || `Milestone ${i + 1}`,
    description: m.description || m.title || '',
    priority: `P${Math.min(i, 2)}`
  }));

  const parsedIntent = {
    projectName: title,
    intentType: 'create_project',
    tasks,
    originalInput: description || title,
    entities: {}
  };

  return renderTrd(parsedIntent, options);
}

/**
 * Generate a TRD from Goal + KR context
 * @param {Object} params - Generation parameters
 * @param {string} params.title - Feature title (required)
 * @param {string} [params.description] - Feature description
 * @param {Object} [params.kr] - Key Result context
 * @param {Object} [params.project] - Project context
 * @param {Array<{title: string, description?: string}>} [params.milestones] - Optional milestones
 * @returns {string} Generated TRD markdown with frontmatter
 */
function generateTrdFromGoalKR(params) {
  const { title, description = '', kr, project, milestones = [] } = params;

  const tasks = milestones.map((m, i) => ({
    title: m.title || `Milestone ${i + 1}`,
    description: m.description || m.title || '',
    priority: `P${Math.min(i, 2)}`
  }));

  const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').slice(0, 60);
  const today = getCurrentDate();

  const frontmatter = generateFrontmatter({
    id: `trd-auto-${slug}`,
    version: '1.0.0',
    created: today,
    updated: today
  });

  let trd = frontmatter + '\n\n';
  trd += `# TRD: ${title}\n\n`;

  // 概述
  trd += `## 概述\n\n`;
  trd += `### 目标\n\n`;
  trd += `${description || title}\n\n`;
  trd += `### 背景\n\n`;
  if (kr) {
    trd += `KR: ${kr.title || 'N/A'} (progress: ${kr.progress ?? 0}%, priority: ${kr.priority || 'P1'})\n`;
    if (project) {
      trd += `Project: ${project.name || 'N/A'} (${project.repo_path || 'no repo'})\n`;
    }
    trd += `Auto-generated by Planner V3\n\n`;
  } else {
    trd += `Auto-generated TRD\n\n`;
  }
  trd += `### 范围\n\n`;
  trd += `- **包含**：${title}\n`;
  trd += `- **不包含**：无关模块\n\n`;

  // 系统架构
  trd += `## 系统架构\n\n`;
  trd += `### 架构图\n\n`;
  trd += '```\n';
  trd += `┌─────────────┐    ┌─────────────┐    ┌─────────────┐\n`;
  trd += `│   Client    │───▶│   Server    │───▶│  Database   │\n`;
  trd += `└─────────────┘    └─────────────┘    └─────────────┘\n`;
  trd += '```\n\n';
  trd += `### 组件说明\n\n`;
  trd += `| 组件 | 职责 | 依赖 |\n`;
  trd += `|------|------|------|\n`;
  trd += `| ${title} | 核心模块 | 无 |\n\n`;

  // 数据模型
  trd += `## 数据模型\n\n`;
  trd += `### 数据库变更\n\n`;
  trd += `待定义。\n\n`;
  trd += `### 数据流\n\n`;
  trd += '```\n[输入] → [处理] → [存储] → [输出]\n```\n\n';

  // PRD 拆解
  trd += `## PRD 拆解\n\n`;
  if (tasks.length > 0) {
    trd += `### PRD 清单\n\n`;
    trd += `| 序号 | 描述 | 依赖 |\n`;
    trd += `|------|------|------|\n`;
    tasks.forEach((task, i) => {
      const dep = i === 0 ? '无' : String(i).padStart(2, '0');
      trd += `| ${String(i + 1).padStart(2, '0')} | ${task.title} | ${dep} |\n`;
    });
    trd += '\n';
  } else {
    trd += `待定义。\n\n`;
  }

  // 接口设计
  trd += `## 接口设计\n\n`;
  if (project && project.repo_path) {
    trd += `Project: ${project.repo_path}\n\n`;
  }
  trd += `待定义。\n\n`;

  // 技术决策
  trd += `## 技术决策\n\n`;
  trd += `待定义。\n\n`;

  // 验收标准
  trd += `## 验收标准\n\n`;
  trd += `- [ ] 任务完成并标记为 completed\n`;
  trd += `- [ ] 代码提交并通过 CI\n`;
  trd += `- [ ] 无回归问题\n\n`;

  // 附录
  trd += `## 附录\n\n`;
  trd += `- 不修改无关模块\n`;
  trd += `- 不引入破坏性变更\n`;

  return trd;
}

/**
 * Generate a PRD from Goal + KR context
 * @param {Object} params - Generation parameters
 * @param {string} params.title - Task/feature title (required)
 * @param {string} [params.description] - Task description
 * @param {Object} [params.kr] - Key Result context
 * @param {Object} [params.project] - Project context
 * @returns {string} Generated PRD markdown with frontmatter
 */
function generatePrdFromGoalKR(params) {
  const { title, description = '', kr, project } = params;

  const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').slice(0, 60);
  const today = getCurrentDate();

  const frontmatter = generateFrontmatter({
    id: `prd-auto-${slug}`,
    version: '1.0.0',
    created: today,
    updated: today
  });

  let prd = frontmatter + '\n\n';
  prd += `# PRD - ${title}\n\n`;

  prd += `## 需求来源\n\n`;
  if (kr) {
    prd += `KR: ${kr.title || 'N/A'} (progress: ${kr.progress ?? 0}%, priority: ${kr.priority || 'P1'})\n`;
    if (project) {
      prd += `Project: ${project.name || 'N/A'} (${project.repo_path || 'no repo'})\n`;
    }
    prd += `Auto-generated by Planner V3\n\n`;
  } else {
    prd += `Auto-generated task\n\n`;
  }

  prd += `## 功能描述\n\n${description || title}\n\n`;

  prd += `## 涉及文件\n\n`;
  if (project && project.repo_path) {
    prd += `- Project: ${project.repo_path}\n\n`;
  } else {
    prd += `- TBD\n\n`;
  }

  prd += `## 成功标准\n\n`;
  prd += `- [ ] 任务完成并标记为 completed\n`;
  prd += `- [ ] 代码提交并通过 CI\n`;
  prd += `- [ ] 无回归问题\n\n`;

  prd += `## 非目标\n\n`;
  prd += `- 不修改无关模块\n`;
  prd += `- 不引入破坏性变更\n`;

  return prd;
}

/**
 * Common action verbs for acceptance criteria validation
 */
const ACTION_VERBS = [
  '显示', '返回', '创建', '检查', '支持', '调用', '发送', '接收',
  '验证', '生成', '删除', '更新', '修改', '添加', '移除', '触发',
  '启动', '停止', '重启', '加载', '保存', '导出', '导入', '解析',
  '渲染', '跳转', '提交', '取消', '确认', '拒绝', '通过', '失败',
  '运行', '执行', '完成', '响应', '处理', '过滤', '排序', '搜索',
  '输入', '输出', '点击', '选择', '切换', '展开', '折叠', '刷新',
  'display', 'return', 'create', 'check', 'support', 'call', 'send',
  'receive', 'validate', 'generate', 'delete', 'update', 'modify',
  'add', 'remove', 'trigger', 'start', 'stop', 'load', 'save',
  'export', 'import', 'parse', 'render', 'submit', 'cancel', 'run',
  'execute', 'respond', 'filter', 'sort', 'search', 'click', 'select'
];

/**
 * Extract section content from markdown by header
 * @param {string} content - Markdown content
 * @param {string} header - Section header text
 * @returns {string|null} Section content or null
 */
function extractSection(content, header) {
  const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^##\\s+${escapedHeader}\\s*$`, 'm');
  const match = content.search(regex);
  if (match === -1) return null;

  const afterHeader = content.slice(match);
  const lines = afterHeader.split('\n');
  const bodyLines = lines.slice(1);
  const endIdx = bodyLines.findIndex(line => /^##\s/.test(line));
  const sectionLines = endIdx === -1 ? bodyLines : bodyLines.slice(0, endIdx);
  return sectionLines.join('\n').trim();
}

/**
 * Validate PRD content quality (structure + content checks)
 * @param {string} prdContent - PRD markdown content
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validatePrd(prdContent) {
  const errors = [];
  const warnings = [];

  if (!prdContent || typeof prdContent !== 'string') {
    return { valid: false, errors: ['PRD content is empty or not a string'], warnings: [] };
  }

  // Structure checks
  const requiredFields = [
    { pattern: /##\s*需求来源|##\s*背景|需求来源\s*[:：]|\*\*需求来源\*\*/, label: '需求来源' },
    { pattern: /##\s*功能描述|功能描述\s*[:：]|\*\*功能描述\*\*|##\s*功能需求/, label: '功能描述' },
    { pattern: /##\s*成功标准|成功标准\s*[:：]|\*\*成功标准\*\*|##\s*验收标准/, label: '成功标准' }
  ];

  for (const field of requiredFields) {
    if (!field.pattern.test(prdContent)) {
      errors.push(`Missing required field: ${field.label}`);
    }
  }

  if (!/##\s*非目标|非目标\s*[:：]|\*\*非目标\*\*/.test(prdContent)) {
    warnings.push('Missing recommended field: 非目标');
  }

  if (!/##\s*涉及文件|涉及文件\s*[:：]|\*\*涉及文件\*\*/.test(prdContent)) {
    warnings.push('Missing recommended field: 涉及文件');
  }

  // Content quality - objectives bullet points
  const objectives = extractSection(prdContent, '目标');
  if (objectives !== null && !/^[-*]\s/m.test(objectives)) {
    warnings.push('目标 section should contain at least 1 bullet point');
  }

  // Content quality - functional requirements length
  const funcReq = extractSection(prdContent, '功能需求') || extractSection(prdContent, '功能描述');
  if (funcReq !== null && funcReq.length < 50) {
    warnings.push('功能需求 section should be at least 50 characters');
  }

  // Content quality - acceptance criteria
  const successMatch = prdContent.match(/(?:##\s*(?:成功标准|验收标准)|\*\*成功标准\*\*)([\s\S]*?)(?=\n##|\n\*\*[^*]|\n---|\n$)/);
  if (successMatch) {
    const section = successMatch[1];
    if (!/[-*]\s|^\d+\./m.test(section)) {
      warnings.push('成功标准 section has no list items');
    }
    const bullets = section.split('\n').filter(line => /^[-*]\s|\[.\]/.test(line.trim()));
    for (const bullet of bullets) {
      const hasVerb = ACTION_VERBS.some(verb => bullet.includes(verb));
      if (!hasVerb) {
        warnings.push(`Acceptance criterion lacks action verb: "${bullet.trim().slice(0, 60)}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate TRD content quality (structure + content checks)
 * @param {string} trdContent - TRD markdown content
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateTrd(trdContent) {
  const errors = [];
  const warnings = [];

  if (!trdContent || typeof trdContent !== 'string') {
    return { valid: false, errors: ['TRD content is empty or not a string'], warnings: [] };
  }

  // Required sections (new 8-section standard + backward compat)
  const requiredSections = [
    { pattern: /##\s*概述|##\s*技术背景/, label: '概述' },
    { pattern: /##\s*系统架构|##\s*架构设计/, label: '系统架构' },
    { pattern: /##\s*数据模型/, label: '数据模型' },
    { pattern: /##\s*接口设计|##\s*API\s*设计/, label: '接口设计' },
    { pattern: /##\s*验收标准|##\s*测试策略/, label: '验收标准' }
  ];

  for (const section of requiredSections) {
    if (!section.pattern.test(trdContent)) {
      errors.push(`Missing required section: ${section.label}`);
    }
  }

  // Content non-empty checks for key sections
  const keyHeaders = ['概述', '系统架构', '数据模型'];
  for (const header of keyHeaders) {
    const content = extractSection(trdContent, header);
    if (content !== null && content.trim().length === 0) {
      warnings.push(`Section is empty: ${header}`);
    }
  }

  // Optional but recommended sections
  if (!/##\s*PRD\s*拆解/.test(trdContent)) {
    warnings.push('Missing recommended section: PRD 拆解');
  }
  if (!/##\s*技术决策/.test(trdContent)) {
    warnings.push('Missing recommended section: 技术决策');
  }
  if (!/##\s*附录/.test(trdContent)) {
    warnings.push('Missing recommended section: 附录');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parse PRD markdown into structured JSON
 * @param {string} prdContent - PRD markdown content
 * @returns {Object} Structured PRD object
 */
function prdToJson(prdContent) {
  const titleMatch = prdContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/^PRD\s*-\s*/, '') : '';

  const sections = {};
  for (const section of PRD_TEMPLATE.sections) {
    sections[section.id] = extractSection(prdContent, section.title) || '';
  }

  return { title, sections };
}

/**
 * Parse TRD markdown into structured JSON
 * @param {string} trdContent - TRD markdown content
 * @returns {Object} Structured TRD object
 */
function trdToJson(trdContent) {
  const titleMatch = trdContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/^TRD[\s:：-]*/, '').trim() : '';

  const sections = {};
  for (const section of TRD_TEMPLATE.sections) {
    sections[section.id] = extractSection(trdContent, section.title) || '';
  }

  return { title, sections };
}

/**
 * Get template by name
 * @param {string} templateName - Template name ('prd' or 'trd')
 * @returns {Object|null} Template object
 */
function getTemplate(templateName) {
  const templates = {
    prd: PRD_TEMPLATE,
    trd: TRD_TEMPLATE
  };
  return templates[templateName.toLowerCase()] || null;
}

/**
 * List all available templates
 * @returns {Array<{name: string, sectionCount: number}>}
 */
function listTemplates() {
  return [
    { name: 'prd', sectionCount: PRD_TEMPLATE.sections.length },
    { name: 'trd', sectionCount: TRD_TEMPLATE.sections.length }
  ];
}

export {
  PRD_TEMPLATE,
  TRD_TEMPLATE,
  PRD_TYPE_MAP,
  generateFrontmatter,
  renderPrd,
  renderTrd,
  generatePrdFromTask,
  generatePrdFromGoalKR,
  generateTrdFromGoal,
  generateTrdFromGoalKR,
  validatePrd,
  validateTrd,
  getTemplate,
  listTemplates,
  getCurrentDate,
  prdToJson,
  trdToJson,
  extractSection
};
