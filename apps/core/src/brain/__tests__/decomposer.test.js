/**
 * Decomposer Module Tests
 * Tests for TRD decomposition into milestones, PRDs, and tasks
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../task-system/db.js', () => ({
  default: { query: vi.fn() }
}));

import {
  parseTRDSections,
  extractMilestones,
  generatePRD,
  createTasksFromPRD,
  establishDependencies
} from '../decomposer.js';

describe('Decomposer', () => {
  describe('parseTRDSections', () => {
    it('should parse headers and list items', () => {
      const content = '# Title\n\n## Section 1\n\n- Item A\n- Item B\n\n## Section 2\n\n- Item C\n';
      const sections = parseTRDSections(content);
      expect(sections.length).toBe(3);
      expect(sections[1].title).toBe('Section 1');
      expect(sections[1].items).toEqual(['Item A', 'Item B']);
    });

    it('should return empty for empty content', () => {
      expect(parseTRDSections('')).toEqual([]);
    });
  });

  describe('extractMilestones', () => {
    it('should extract level-2 headers as milestones', () => {
      const sections = [
        { level: 1, title: 'TRD', items: [], content: [] },
        { level: 2, title: 'Milestone 1', items: ['Task A'], content: [] },
        { level: 3, title: 'Sub', items: ['Sub task'], content: [] },
        { level: 2, title: 'Milestone 2', items: ['Task B'], content: [] }
      ];
      const milestones = extractMilestones(sections);
      expect(milestones.length).toBe(2);
      expect(milestones[0].title).toBe('Milestone 1');
      expect(milestones[0].items).toContain('Task A');
      expect(milestones[0].items).toContain('Sub task');
      expect(milestones[1].title).toBe('Milestone 2');
    });
  });

  describe('generatePRD', () => {
    it('should generate PRD with standard template structure (frontmatter + 6 sections)', () => {
      const milestone = {
        id: 'milestone-test',
        title: 'Test Feature',
        items: ['Implement login', 'Add validation'],
        sections: []
      };
      const prd = generatePRD(milestone, 0);

      expect(prd.title).toBe('Test Feature');
      expect(prd.content).toContain('---');
      expect(prd.content).toContain('id: prd-');
      expect(prd.content).toContain('version: 1.0.0');
      expect(prd.content).toContain('## 背景');
      expect(prd.content).toContain('## 目标');
      expect(prd.content).toContain('## 功能需求');
      expect(prd.content).toContain('## 验收标准');
      expect(prd.content).toContain('## 里程碑');
      expect(prd.content).toContain('Implement login');
      expect(prd.content).toContain('Add validation');
    });

    it('should include milestone items as tasks in PRD', () => {
      const milestone = {
        id: 'ms-1',
        title: 'API Setup',
        items: ['Create endpoints', 'Add auth'],
        sections: []
      };
      const prd = generatePRD(milestone, 1);
      expect(prd.content).toContain('Create endpoints');
      expect(prd.content).toContain('Add auth');
      expect(prd.content).toContain('milestone 2');
    });
  });

  describe('createTasksFromPRD', () => {
    it('should create tasks from PRD items', () => {
      const prd = {
        id: 'prd-1',
        title: 'Feature',
        items: ['Task 1', 'Task 2'],
        milestoneId: 'ms-1'
      };
      const tasks = createTasksFromPRD(prd, 0);
      expect(tasks.length).toBe(2);
      expect(tasks[0].priority).toBe('P1');
      expect(tasks[1].depends_on).toContain(tasks[0].id);
    });
  });

  describe('establishDependencies', () => {
    it('should link last task of milestone to first task of next', () => {
      const m1Tasks = [
        { id: 't1', depends_on: [] },
        { id: 't2', depends_on: ['t1'] }
      ];
      const m2Tasks = [
        { id: 't3', depends_on: [] },
        { id: 't4', depends_on: ['t3'] }
      ];
      const result = establishDependencies([m1Tasks, m2Tasks]);
      expect(result.length).toBe(4);
      expect(result[2].depends_on).toContain('t2');
    });
  });
});
