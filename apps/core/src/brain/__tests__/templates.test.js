/**
 * Templates Module Tests
 * Tests for PRD and TRD template rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
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
} from '../templates.js';

describe('Templates Module', () => {
  describe('PRD_TYPE_MAP', () => {
    it('maps feature, bugfix, refactor to intent types', () => {
      expect(PRD_TYPE_MAP.feature).toBe('create_feature');
      expect(PRD_TYPE_MAP.bugfix).toBe('fix_bug');
      expect(PRD_TYPE_MAP.refactor).toBe('refactor');
    });

    it('has exactly 3 types', () => {
      expect(Object.keys(PRD_TYPE_MAP)).toHaveLength(3);
    });
  });

  describe('generatePrdFromTask', () => {
    it('generates PRD with title only', () => {
      const prd = generatePrdFromTask({ title: 'Add login page' });

      expect(prd).toContain('# PRD - Add login page');
      expect(prd).toContain('Add login page');
    });

    it('generates PRD with title and description', () => {
      const prd = generatePrdFromTask({
        title: 'User Auth',
        description: 'Implement user authentication with JWT'
      });

      expect(prd).toContain('# PRD - User Auth');
      expect(prd).toContain('Implement user authentication with JWT');
    });

    it('defaults to feature type', () => {
      const prd = generatePrdFromTask({ title: 'New Feature' });

      expect(prd).toContain('添加');
    });

    it('uses bugfix type correctly', () => {
      const prd = generatePrdFromTask({ title: 'Fix crash', type: 'bugfix' });

      expect(prd).toContain('修复');
    });

    it('uses refactor type correctly', () => {
      const prd = generatePrdFromTask({ title: 'Clean up code', type: 'refactor' });

      expect(prd).toContain('重构和优化');
    });

    it('uses title as originalInput when description is missing', () => {
      const prd = generatePrdFromTask({ title: 'My Task' });

      expect(prd).toContain('## 背景');
      expect(prd).toContain('My Task');
    });

    it('passes rendering options through', () => {
      const prd = generatePrdFromTask(
        { title: 'Test' },
        { includeFrontmatter: false }
      );

      expect(prd).not.toMatch(/^---/);
      expect(prd).toMatch(/^# PRD/);
    });
  });

  describe('PRD_TEMPLATE structure', () => {
    it('has correct name', () => {
      expect(PRD_TEMPLATE.name).toBe('prd');
    });

    it('has required sections', () => {
      const sectionIds = PRD_TEMPLATE.sections.map(s => s.id);
      expect(sectionIds).toContain('background');
      expect(sectionIds).toContain('objectives');
      expect(sectionIds).toContain('functional_requirements');
      expect(sectionIds).toContain('acceptance_criteria');
    });

    it('has 6 sections total', () => {
      expect(PRD_TEMPLATE.sections.length).toBe(6);
    });

    it('marks required sections correctly', () => {
      const required = PRD_TEMPLATE.sections.filter(s => s.required);
      expect(required.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('TRD_TEMPLATE structure', () => {
    it('has correct name', () => {
      expect(TRD_TEMPLATE.name).toBe('trd');
    });

    it('has required sections', () => {
      const sectionIds = TRD_TEMPLATE.sections.map(s => s.id);
      expect(sectionIds).toContain('overview');
      expect(sectionIds).toContain('system_architecture');
      expect(sectionIds).toContain('data_model');
      expect(sectionIds).toContain('api_design');
      expect(sectionIds).toContain('acceptance_criteria');
    });

    it('has 8 sections total', () => {
      expect(TRD_TEMPLATE.sections.length).toBe(8);
    });

    it('has optional sections', () => {
      const sectionIds = TRD_TEMPLATE.sections.map(s => s.id);
      expect(sectionIds).toContain('prd_decomposition');
      expect(sectionIds).toContain('technical_decisions');
      expect(sectionIds).toContain('appendix');
    });
  });

  describe('generateFrontmatter', () => {
    it('generates valid YAML frontmatter', () => {
      const frontmatter = generateFrontmatter({ id: 'test-doc' });

      expect(frontmatter).toContain('---');
      expect(frontmatter).toContain('id: test-doc');
      expect(frontmatter).toContain('version: 1.0.0');
      expect(frontmatter).toContain('changelog:');
    });

    it('uses custom version when provided', () => {
      const frontmatter = generateFrontmatter({ id: 'test', version: '2.0.0' });

      expect(frontmatter).toContain('version: 2.0.0');
      expect(frontmatter).toContain('2.0.0: 初始版本');
    });

    it('uses current date by default', () => {
      const frontmatter = generateFrontmatter({ id: 'test' });
      const today = getCurrentDate();

      expect(frontmatter).toContain(`created: ${today}`);
      expect(frontmatter).toContain(`updated: ${today}`);
    });

    it('accepts custom dates', () => {
      const frontmatter = generateFrontmatter({
        id: 'test',
        created: '2025-01-01',
        updated: '2025-01-15'
      });

      expect(frontmatter).toContain('created: 2025-01-01');
      expect(frontmatter).toContain('updated: 2025-01-15');
    });
  });

  describe('renderPrd', () => {
    const mockParsedIntent = {
      projectName: 'test-project',
      intentType: 'create_project',
      tasks: [
        { title: 'Design architecture', description: 'Create system design', priority: 'P0' },
        { title: 'Implement API', description: 'Build backend API', priority: 'P0' }
      ],
      originalInput: '我想做一个测试项目',
      entities: {}
    };

    it('includes frontmatter by default', () => {
      const prd = renderPrd(mockParsedIntent);

      expect(prd).toMatch(/^---/);
      expect(prd).toContain('id: prd-test-project');
      expect(prd).toContain('version: 1.0.0');
    });

    it('can exclude frontmatter', () => {
      const prd = renderPrd(mockParsedIntent, { includeFrontmatter: false });

      expect(prd).not.toMatch(/^---/);
      expect(prd).toMatch(/^# PRD/);
    });

    it('includes all required sections', () => {
      const prd = renderPrd(mockParsedIntent);

      expect(prd).toContain('# PRD - test-project');
      expect(prd).toContain('## 背景');
      expect(prd).toContain('## 目标');
      expect(prd).toContain('## 功能需求');
      expect(prd).toContain('## 非功能需求');
      expect(prd).toContain('## 验收标准');
      expect(prd).toContain('## 里程碑');
    });

    it('includes original input in background', () => {
      const prd = renderPrd(mockParsedIntent);

      expect(prd).toContain('我想做一个测试项目');
    });

    it('lists tasks in functional requirements', () => {
      const prd = renderPrd(mockParsedIntent);

      expect(prd).toContain('### 1. Design architecture');
      expect(prd).toContain('Create system design');
      expect(prd).toContain('### 2. Implement API');
    });

    it('generates acceptance criteria from tasks', () => {
      const prd = renderPrd(mockParsedIntent);

      expect(prd).toContain('- [ ] Design architecture');
      expect(prd).toContain('- [ ] Implement API');
      expect(prd).toContain('- [ ] 所有测试通过');
    });

    it('handles empty tasks array', () => {
      const intent = { ...mockParsedIntent, tasks: [] };
      const prd = renderPrd(intent);

      expect(prd).toContain('待定义');
    });

    it('uses file path from entities when available', () => {
      const intent = {
        ...mockParsedIntent,
        entities: { filePath: 'src/custom/path.js' }
      };
      const prd = renderPrd(intent);

      expect(prd).toContain('- src/custom/path.js');
    });

    it('uses custom version', () => {
      const prd = renderPrd(mockParsedIntent, { version: '1.2.0' });

      expect(prd).toContain('version: 1.2.0');
    });
  });

  describe('renderTrd', () => {
    const mockParsedIntent = {
      projectName: 'api-service',
      intentType: 'create_project',
      tasks: [
        { title: 'Design database', description: 'Create data model', priority: 'P0' },
        { title: 'Build API', description: 'Implement endpoints', priority: 'P0' }
      ],
      originalInput: '创建一个 API 服务',
      entities: {}
    };

    it('includes frontmatter by default', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toMatch(/^---/);
      expect(trd).toContain('id: trd-api-service');
    });

    it('can exclude frontmatter', () => {
      const trd = renderTrd(mockParsedIntent, { includeFrontmatter: false });

      expect(trd).not.toMatch(/^---/);
      expect(trd).toMatch(/^# TRD/);
    });

    it('includes all 8 sections', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('# TRD: api-service');
      expect(trd).toContain('## 概述');
      expect(trd).toContain('## 系统架构');
      expect(trd).toContain('## 数据模型');
      expect(trd).toContain('## PRD 拆解');
      expect(trd).toContain('## 接口设计');
      expect(trd).toContain('## 技术决策');
      expect(trd).toContain('## 验收标准');
      expect(trd).toContain('## 附录');
    });

    it('includes architecture diagram', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('Client');
      expect(trd).toContain('Server');
      expect(trd).toContain('Database');
    });

    it('generates API table', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('| 方法 | 路径 | 描述 |');
      expect(trd).toContain('GET');
      expect(trd).toContain('POST');
      expect(trd).toContain('/api/api-service');
    });

    it('uses entity apiEndpoint when available', () => {
      const intent = {
        ...mockParsedIntent,
        entities: { apiEndpoint: '/api/custom/endpoint' }
      };
      const trd = renderTrd(intent);

      expect(trd).toContain('/api/custom/endpoint');
    });

    it('generates SQL schema', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('CREATE TABLE api_service');
      expect(trd).toContain('id UUID PRIMARY KEY');
      expect(trd).toContain('created_at TIMESTAMP');
    });

    it('lists acceptance criteria from tasks', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('- [ ] Design database 正常工作');
      expect(trd).toContain('- [ ] Build API 正常工作');
    });

    it('includes PRD decomposition with tasks', () => {
      const trd = renderTrd(mockParsedIntent);

      expect(trd).toContain('PRD-01 (Design database)');
      expect(trd).toContain('PRD-02 (Build API)');
    });

    it('handles empty tasks', () => {
      const intent = { ...mockParsedIntent, tasks: [] };
      const trd = renderTrd(intent);

      expect(trd).toContain('- [ ] 核心功能正常工作');
      expect(trd).toContain('PRD-01 (基础)');
    });

    it('uses module entity in component table', () => {
      const intent = {
        ...mockParsedIntent,
        entities: { module: 'user-auth' }
      };
      const trd = renderTrd(intent);

      expect(trd).toContain('| user-auth |');
    });
  });

  describe('generateTrdFromGoal', () => {
    it('generates TRD with title only', () => {
      const trd = generateTrdFromGoal({ title: 'Brain System v2' });

      expect(trd).toContain('# TRD: Brain System v2');
      expect(trd).toContain('## 概述');
      expect(trd).toContain('## 系统架构');
    });

    it('generates TRD with title and description', () => {
      const trd = generateTrdFromGoal({
        title: 'Task Intelligence',
        description: 'Build an intelligent task management system'
      });

      expect(trd).toContain('# TRD: Task Intelligence');
      expect(trd).toContain('Build an intelligent task management system');
    });

    it('includes milestones as PRD decomposition', () => {
      const trd = generateTrdFromGoal({
        title: 'My Goal',
        description: 'Goal description',
        milestones: [
          { title: 'Phase 1: Setup', description: 'Initial setup' },
          { title: 'Phase 2: Core', description: 'Core features' }
        ]
      });

      expect(trd).toContain('PRD-01 (Phase 1: Setup)');
      expect(trd).toContain('PRD-02 (Phase 2: Core)');
      expect(trd).toContain('- [ ] Phase 1: Setup 正常工作');
      expect(trd).toContain('- [ ] Phase 2: Core 正常工作');
    });

    it('handles empty milestones', () => {
      const trd = generateTrdFromGoal({ title: 'Simple Goal', milestones: [] });

      expect(trd).toContain('- [ ] 核心功能正常工作');
      expect(trd).toContain('PRD-01 (基础)');
    });

    it('uses title as fallback for description', () => {
      const trd = generateTrdFromGoal({ title: 'My Goal' });

      expect(trd).toContain('My Goal');
    });

    it('passes rendering options through', () => {
      const trd = generateTrdFromGoal(
        { title: 'Test' },
        { includeFrontmatter: false }
      );

      expect(trd).not.toMatch(/^---/);
      expect(trd).toMatch(/^# TRD/);
    });
  });

  describe('getTemplate', () => {
    it('returns PRD template for "prd"', () => {
      const template = getTemplate('prd');
      expect(template).toBe(PRD_TEMPLATE);
    });

    it('returns TRD template for "trd"', () => {
      const template = getTemplate('trd');
      expect(template).toBe(TRD_TEMPLATE);
    });

    it('is case insensitive', () => {
      expect(getTemplate('PRD')).toBe(PRD_TEMPLATE);
      expect(getTemplate('TRD')).toBe(TRD_TEMPLATE);
    });

    it('returns null for unknown template', () => {
      expect(getTemplate('unknown')).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('returns list of available templates', () => {
      const templates = listTemplates();

      expect(templates.length).toBe(2);
      expect(templates).toContainEqual({ name: 'prd', sectionCount: 6 });
      expect(templates).toContainEqual({ name: 'trd', sectionCount: 8 });
    });
  });

  describe('getCurrentDate', () => {
    it('returns date in YYYY-MM-DD format', () => {
      const date = getCurrentDate();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('generatePrdFromGoalKR', () => {
    it('generates full PRD with all Goal+KR+Project params', () => {
      const prd = generatePrdFromGoalKR({
        title: 'Implement TRD engine',
        description: 'Build TRD markdown generator from KR context',
        kr: { title: 'TRD 模板完整性', progress: 45, priority: 'P0' },
        project: { name: 'cecelia-workspace', repo_path: '/home/xx/dev/cecelia-workspace' }
      });

      expect(prd).toContain('---');
      expect(prd).toContain('id: prd-auto-');
      expect(prd).toContain('version: 1.0.0');
      expect(prd).toContain('# PRD - Implement TRD engine');
      expect(prd).toContain('KR: TRD 模板完整性 (progress: 45%, priority: P0)');
      expect(prd).toContain('Project: cecelia-workspace');
      expect(prd).toContain('Build TRD markdown generator from KR context');
      expect(prd).toContain('/home/xx/dev/cecelia-workspace');
      expect(prd).toContain('## 非目标');
    });

    it('generates generic PRD without kr/project params', () => {
      const prd = generatePrdFromGoalKR({
        title: 'Simple task',
        description: 'A simple task description'
      });

      expect(prd).toContain('# PRD - Simple task');
      expect(prd).toContain('Auto-generated task');
      expect(prd).not.toContain('KR:');
      expect(prd).toContain('A simple task description');
      expect(prd).toContain('TBD');
      expect(prd).toContain('## 非目标');
    });

    it('handles kr with missing fields gracefully', () => {
      const prd = generatePrdFromGoalKR({
        title: 'Partial KR task',
        description: 'Test partial KR',
        kr: { title: 'Some KR' }
      });

      expect(prd).toContain('KR: Some KR (progress: 0%, priority: P1)');
      expect(prd).toContain('## 非目标');
      expect(prd).not.toContain('undefined');
    });

    it('uses title as description fallback', () => {
      const prd = generatePrdFromGoalKR({ title: 'Fallback test' });

      expect(prd).toContain('## 功能描述');
      expect(prd).toContain('Fallback test');
    });
  });

  describe('validatePrd', () => {
    it('returns valid:true for a complete PRD', () => {
      const prd = generatePrdFromGoalKR({
        title: 'Test',
        description: 'Test desc',
        kr: { title: 'KR1', progress: 50, priority: 'P0' },
        project: { name: 'proj', repo_path: '/repo' }
      });
      const result = validatePrd(prd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid:false when 需求来源 is missing', () => {
      const prd = '## 功能描述\nSomething\n## 成功标准\n- item';
      const result = validatePrd(prd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: 需求来源');
    });

    it('returns valid:false when 功能描述 is missing', () => {
      const prd = '## 需求来源\nSomething\n## 成功标准\n- item';
      const result = validatePrd(prd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: 功能描述');
    });

    it('returns valid:false when 成功标准 is missing', () => {
      const prd = '## 需求来源\nSomething\n## 功能描述\nSomething';
      const result = validatePrd(prd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: 成功标准');
    });

    it('returns valid:false for empty content', () => {
      const result = validatePrd('');
      expect(result.valid).toBe(false);
    });

    it('returns valid:false for null content', () => {
      const result = validatePrd(null);
      expect(result.valid).toBe(false);
    });

    it('warns when 非目标 is missing', () => {
      const prd = '## 需求来源\nX\n## 功能描述\nY\n## 成功标准\n- item\n## 涉及文件\nZ';
      const result = validatePrd(prd);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Missing recommended field: 非目标');
    });

    it('recognizes bold-style field markers', () => {
      const prd = '**需求来源**: X\n**功能描述**: Y\n**成功标准**:\n- item';
      const result = validatePrd(prd);
      expect(result.valid).toBe(true);
    });

    it('accepts renderPrd output as valid', () => {
      const prd = renderPrd({
        projectName: 'test',
        intentType: 'create_feature',
        tasks: [{ title: 'Task 1', description: 'Desc', priority: 'P0' }],
        originalInput: 'Test input',
        entities: {}
      });
      const result = validatePrd(prd);
      // renderPrd uses 背景/功能需求/验收标准 which map to our required fields
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTrd', () => {
    it('returns valid:true for a complete TRD', () => {
      const trd = renderTrd({
        projectName: 'test',
        intentType: 'create_project',
        tasks: [],
        originalInput: 'Test',
        entities: {}
      });
      const result = validateTrd(trd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid:false when required sections are missing', () => {
      const trd = '## 概述\nSomething\n## 系统架构\nSomething';
      const result = validateTrd(trd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required section: 数据模型');
      expect(result.errors).toContain('Missing required section: 接口设计');
      expect(result.errors).toContain('Missing required section: 验收标准');
    });

    it('returns valid:false for empty content', () => {
      const result = validateTrd('');
      expect(result.valid).toBe(false);
    });

    it('returns valid:false for null content', () => {
      const result = validateTrd(null);
      expect(result.valid).toBe(false);
    });

    it('warns when optional sections are missing', () => {
      const trd = '## 概述\nA\n## 系统架构\nB\n## 数据模型\nC\n## 接口设计\nD\n## 验收标准\nE';
      const result = validateTrd(trd);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Missing recommended section: PRD 拆解');
      expect(result.warnings).toContain('Missing recommended section: 技术决策');
      expect(result.warnings).toContain('Missing recommended section: 附录');
    });

    it('accepts generateTrdFromGoal output as valid', () => {
      const trd = generateTrdFromGoal({ title: 'Test Goal', description: 'Desc' });
      const result = validateTrd(trd);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Integration: Document rendering flow', () => {
    it('generates consistent PRD structure', () => {
      const intent = {
        projectName: 'gmv-dashboard',
        intentType: 'create_project',
        tasks: [
          { title: '设计架构', description: '设计系统架构', priority: 'P0' },
          { title: '实现后端', description: '开发后端 API', priority: 'P0' },
          { title: '实现前端', description: '开发前端界面', priority: 'P1' }
        ],
        originalInput: '我想做一个 GMV Dashboard',
        entities: {}
      };

      const prd = renderPrd(intent);

      // Verify structure
      expect(prd).toContain('id: prd-gmv-dashboard');
      expect(prd).toContain('# PRD - gmv-dashboard');
      expect(prd).toContain('我想做一个 GMV Dashboard');
      expect(prd).toContain('创建并实现gmv-dashboard');
      expect(prd).toContain('### 1. 设计架构');
      expect(prd).toContain('- [ ] 设计架构');
      expect(prd).toContain('| M1 | 需求确认 | 待开始 |');
    });

    it('generates consistent TRD structure', () => {
      const intent = {
        projectName: 'user-service',
        intentType: 'create_feature',
        tasks: [
          { title: '设计 API', description: '定义接口规范', priority: 'P0' },
          { title: '实现功能', description: '编码实现', priority: 'P0' }
        ],
        originalInput: '给用户模块添加认证功能',
        entities: { module: 'user' }
      };

      const trd = renderTrd(intent);

      // Verify structure
      expect(trd).toContain('id: trd-user-service');
      expect(trd).toContain('# TRD: user-service');
      expect(trd).toContain('给用户模块添加认证功能');
      expect(trd).toContain('## 概述');
      expect(trd).toContain('CREATE TABLE user_service');
      expect(trd).toContain('| user |');
    });
  });

  describe('extractSection', () => {
    it('extracts section content by header', () => {
      const md = '## 背景\n\n这是背景内容\n\n## 目标\n\n- 目标1';
      expect(extractSection(md, '背景')).toBe('这是背景内容');
      expect(extractSection(md, '目标')).toBe('- 目标1');
    });

    it('returns null for missing section', () => {
      expect(extractSection('## 背景\n\n内容', '目标')).toBeNull();
    });
  });

  describe('validatePrd', () => {
    const validPrd = `# PRD - Test

## 背景

需求来源说明

## 目标

- 实现功能A
- 实现功能B

## 功能需求

This is a sufficiently long functional requirements description that includes detailed implementation specifics and concrete feature specifications to ensure it exceeds fifty characters in length.

## 验收标准

- [ ] 用户能点击登录按钮完成认证
- [ ] 系统显示成功提示消息
`;

    it('passes for valid PRD', () => {
      const result = validatePrd(validPrd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when missing required fields', () => {
      const result = validatePrd('# PRD\n\n## 背景\n\n内容');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing required field'))).toBe(true);
    });

    it('fails when objectives lacks bullet points', () => {
      const prd = `# PRD

## 背景

内容

## 目标

这里没有列表

## 功能需求

${'这是一段足够长的功能需求描述内容'.repeat(5)}

## 验收标准

- [ ] 系统显示结果
`;
      const result = validatePrd(prd);
      expect(result.warnings.some(e => e.includes('bullet point'))).toBe(true);
    });

    it('warns when functional requirements too short', () => {
      const prd = `# PRD

## 背景

内容

## 目标

- 目标1

## 功能需求

短

## 验收标准

- [ ] 系统显示结果
`;
      const result = validatePrd(prd);
      expect(result.warnings.some(e => e.includes('50 characters'))).toBe(true);
    });

    it('warns when acceptance criteria lack action verbs', () => {
      const prd = `# PRD

## 背景

内容

## 目标

- 目标1

## 功能需求

${'这是一段足够长的功能需求描述'.repeat(5)}

## 验收标准

- [ ] 好的代码质量
- [ ] 优雅的架构
`;
      const result = validatePrd(prd);
      expect(result.warnings.some(e => e.includes('action verb'))).toBe(true);
    });
  });

  describe('validateTrd (enhanced)', () => {
    const validTrd = `# TRD: Test

## 概述

目标和背景说明

## 系统架构

微服务架构设计方案

## 数据模型

PostgreSQL

## 接口设计

RESTful 接口

## 验收标准

- [ ] 功能正常
`;

    it('passes for valid TRD', () => {
      const result = validateTrd(validTrd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when missing required sections', () => {
      const result = validateTrd('# TRD\n\n## 接口设计\n\n内容');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('概述'))).toBe(true);
    });

    it('warns when required section is empty', () => {
      const trd = `# TRD

## 概述

## 系统架构

内容

## 数据模型

内容

## 接口设计

内容

## 验收标准

内容
`;
      const result = validateTrd(trd);
      expect(result.warnings.some(e => e.includes('empty'))).toBe(true);
    });

    it('backward compat: accepts old section names', () => {
      const oldTrd = `# TRD

## 技术背景

内容

## 架构设计

内容

## 数据模型

内容

## API 设计

内容

## 测试策略

内容
`;
      const result = validateTrd(oldTrd);
      expect(result.valid).toBe(true);
    });
  });

  describe('prdToJson', () => {
    it('parses PRD markdown into JSON', () => {
      const prd = `# PRD - 用户登录

## 背景

需要用户认证

## 目标

- 实现登录

## 功能需求

实现完整的登录流程

## 验收标准

- [ ] 登录成功
`;
      const result = prdToJson(prd);
      expect(result.title).toBe('用户登录');
      expect(result.sections.background).toContain('需要用户认证');
      expect(result.sections.objectives).toContain('实现登录');
      expect(result.sections.functional_requirements).toContain('登录流程');
      expect(result.sections.acceptance_criteria).toContain('登录成功');
    });

    it('returns empty strings for missing sections', () => {
      const result = prdToJson('# PRD - Test');
      expect(result.sections.background).toBe('');
      expect(result.sections.milestones).toBe('');
    });
  });

  describe('trdToJson', () => {
    it('parses TRD markdown into JSON with 8 sections', () => {
      const trd = `# TRD: 认证系统

## 概述

JWT 认证系统

## 系统架构

微服务

## 数据模型

users 表

## PRD 拆解

PRD-01

## 接口设计

REST API

## 技术决策

使用 JWT

## 验收标准

- 功能正常

## 附录

参考文档
`;
      const result = trdToJson(trd);
      expect(result.title).toBe('认证系统');
      expect(result.sections.overview).toContain('JWT');
      expect(result.sections.system_architecture).toContain('微服务');
      expect(result.sections.data_model).toContain('users');
      expect(result.sections.prd_decomposition).toContain('PRD-01');
      expect(result.sections.api_design).toContain('REST');
      expect(result.sections.technical_decisions).toContain('JWT');
      expect(result.sections.acceptance_criteria).toContain('功能正常');
      expect(result.sections.appendix).toContain('参考文档');
    });
  });

  describe('generateTrdFromGoalKR', () => {
    it('generates full TRD with all Goal+KR+Project params', () => {
      const trd = generateTrdFromGoalKR({
        title: 'Implement TRD engine',
        description: 'Build TRD markdown generator from KR context',
        kr: { title: 'TRD 模板完整性', progress: 45, priority: 'P0' },
        project: { name: 'cecelia-workspace', repo_path: '/home/xx/dev/cecelia-workspace' }
      });

      expect(trd).toContain('---');
      expect(trd).toContain('id: trd-auto-');
      expect(trd).toContain('# TRD: Implement TRD engine');
      expect(trd).toContain('KR: TRD 模板完整性 (progress: 45%, priority: P0)');
      expect(trd).toContain('Project: cecelia-workspace');
      expect(trd).toContain('Build TRD markdown generator from KR context');
      expect(trd).toContain('/home/xx/dev/cecelia-workspace');
      // All 8 sections
      expect(trd).toContain('## 概述');
      expect(trd).toContain('## 系统架构');
      expect(trd).toContain('## 数据模型');
      expect(trd).toContain('## PRD 拆解');
      expect(trd).toContain('## 接口设计');
      expect(trd).toContain('## 技术决策');
      expect(trd).toContain('## 验收标准');
      expect(trd).toContain('## 附录');
    });

    it('generates generic TRD without kr/project params', () => {
      const trd = generateTrdFromGoalKR({
        title: 'Simple feature',
        description: 'A simple feature description'
      });

      expect(trd).toContain('# TRD: Simple feature');
      expect(trd).toContain('Auto-generated TRD');
      expect(trd).not.toContain('KR:');
      expect(trd).toContain('A simple feature description');
    });

    it('handles milestones as PRD decomposition', () => {
      const trd = generateTrdFromGoalKR({
        title: 'Multi-phase',
        milestones: [
          { title: 'Phase 1', description: 'Setup' },
          { title: 'Phase 2', description: 'Build' }
        ]
      });

      expect(trd).toContain('| 01 | Phase 1 |');
      expect(trd).toContain('| 02 | Phase 2 |');
    });

    it('passes validateTrd', () => {
      const trd = generateTrdFromGoalKR({
        title: 'Valid TRD',
        description: 'Should be valid',
        kr: { title: 'KR1', progress: 0, priority: 'P1' }
      });
      const result = validateTrd(trd);
      expect(result.valid).toBe(true);
    });
  });
});
