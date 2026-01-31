/**
 * Validation Module Tests
 */

import { describe, it, expect } from 'vitest';
import { validatePrd, validateTrd, extractSection, findTbdPatterns } from '../validation.js';
import { generatePrdFromTask, generateTrdFromGoal, generatePrdFromGoalKR } from '../templates.js';

describe('validatePrd', () => {
  it('should pass for a valid PRD with all required sections', () => {
    const prd = generatePrdFromTask({ title: 'Test Feature', description: 'A test feature', type: 'feature' });
    const result = validatePrd(prd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass for a GoalKR-generated PRD', () => {
    const prd = generatePrdFromGoalKR({
      title: 'Test Task',
      description: 'Implement something',
      kr: { title: 'KR1', progress: 50, priority: 'P0' },
      project: { name: 'test-project', repo_path: '/home/test' }
    });
    const result = validatePrd(prd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for empty content', () => {
    const result = validatePrd('');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/i);
  });

  it('should fail for null content', () => {
    const result = validatePrd(null);
    expect(result.valid).toBe(false);
  });

  it('should fail when missing required sections', () => {
    const prd = '# PRD - Test\n\n## 背景\n\nSome background info here.\n';
    const result = validatePrd(prd);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('目标'))).toBe(true);
  });

  it('should warn about TBD placeholders', () => {
    const prd = [
      '# PRD - Test',
      '## 背景',
      'Background info here',
      '## 目标',
      'Goal is TBD',
      '## 功能需求',
      'Some requirements',
      '## 验收标准',
      'Acceptance criteria'
    ].join('\n');
    const result = validatePrd(prd);
    expect(result.warnings.some(w => w.includes('TBD'))).toBe(true);
  });

  it('should warn about short content', () => {
    const result = validatePrd('## 背景\nhi');
    expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
  });

  it('should detect 待定义 as TBD placeholder', () => {
    const prd = [
      '# PRD - Test',
      '## 背景',
      'Background',
      '## 目标',
      'Objective',
      '## 功能需求',
      '待定义。',
      '## 验收标准',
      'Criteria'
    ].join('\n');
    const result = validatePrd(prd);
    expect(result.warnings.some(w => w.includes('待定义'))).toBe(true);
  });

  it('should accept alternative header names (需求来源, 功能描述, 成功标准)', () => {
    const prd = [
      '# PRD - Test',
      '## 需求来源',
      'From user request',
      '## 功能描述',
      'Describe the feature in detail',
      '## 功能需求',
      'Core requirements here',
      '## 成功标准',
      'Acceptance criteria here'
    ].join('\n');
    const result = validatePrd(prd);
    expect(result.valid).toBe(true);
  });
});

describe('validateTrd', () => {
  it('should pass for a valid TRD with all required sections', () => {
    const trd = generateTrdFromGoal({ title: 'Test Goal', description: 'A test goal' });
    const result = validateTrd(trd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for empty content', () => {
    const result = validateTrd('');
    expect(result.valid).toBe(false);
  });

  it('should fail when missing required sections', () => {
    const trd = '# TRD - Test\n\n## 技术背景\n\nSome background.\n';
    const result = validateTrd(trd);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('架构设计'))).toBe(true);
  });

  it('should warn about TBD in sections', () => {
    const trd = [
      '# TRD',
      '## 技术背景',
      'Tech background',
      '## 架构设计',
      'TBD',
      '## API 设计',
      'API spec',
      '## 数据模型',
      'Data model',
      '## 测试策略',
      'Test plan'
    ].join('\n');
    const result = validateTrd(trd);
    expect(result.warnings.some(w => w.includes('TBD'))).toBe(true);
  });
});

describe('extractSection', () => {
  it('should extract section content between headers', () => {
    const content = '## 背景\n\nSome text\n\n## 目标\n\nGoal text';
    const result = extractSection(content, /^##\s+背景/m);
    expect(result).toBe('Some text');
  });

  it('should return null for missing section', () => {
    const content = '## 背景\n\nSome text';
    const result = extractSection(content, /^##\s+目标/m);
    expect(result).toBeNull();
  });

  it('should extract last section (no next header)', () => {
    const content = '## 背景\n\nSome text\n\n## 目标\n\nGoal text here';
    const result = extractSection(content, /^##\s+目标/m);
    expect(result).toBe('Goal text here');
  });
});

describe('findTbdPatterns', () => {
  it('should find TBD', () => {
    expect(findTbdPatterns('This is TBD')).toContain('TBD');
  });

  it('should find 待定义', () => {
    expect(findTbdPatterns('内容待定义')).toContain('待定义');
  });

  it('should find TODO', () => {
    expect(findTbdPatterns('TODO: fix later')).toContain('TODO');
  });

  it('should return empty for clean text', () => {
    expect(findTbdPatterns('All good here')).toHaveLength(0);
  });
});
