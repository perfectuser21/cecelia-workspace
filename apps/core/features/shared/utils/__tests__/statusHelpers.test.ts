/**
 * Tests for statusHelpers.ts
 * Tests status normalization, color mapping, icon generation, and labels
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import {
  normalizeStatus,
  getStatusColor,
  getStatusTextColor,
  getStatusBgColor,
  getStatusIcon,
  getStatusLabel,
  getPercentageColor,
  STATUS_COLORS,
  STATUS_TEXT_COLORS,
  STATUS_BG_COLORS,
  STATUS_LABELS,
  EXTENDED_STATUS_LABELS,
  type NormalizedStatus,
} from '../statusHelpers.js';

// Mock React.createElement for testing icons
vi.mock('react', () => ({
  default: {
    createElement: vi.fn((component, props) => ({
      type: component,
      props,
    })),
  },
}));

describe('statusHelpers', () => {
  describe('normalizeStatus()', () => {
    describe('Success variants', () => {
      it.each([
        ['success', 'success'],
        ['completed', 'success'],
        ['done', 'success'],
        ['passed', 'success'],
        ['merged', 'success'],
        ['online', 'success'],
        ['Success', 'success'],
        ['COMPLETED', 'success'],
        ['Up 2 hours', 'success'],
        ['up 1 day', 'success'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });

    describe('Error variants', () => {
      it.each([
        ['error', 'error'],
        ['failed', 'error'],
        ['crashed', 'error'],
        ['offline', 'error'],
        ['stopped', 'error'],
        ['ERROR', 'error'],
        ['FAILED', 'error'],
        ['Exited (1)', 'error'],
        ['exited (0)', 'error'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });

    describe('Running variants', () => {
      it.each([
        ['running', 'running'],
        ['in_progress', 'running'],
        ['active', 'running'],
        ['executing', 'running'],
        ['waiting', 'running'],
        ['Running', 'running'],
        ['IN_PROGRESS', 'running'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });

    describe('Pending variants', () => {
      it.each([
        ['pending', 'pending'],
        ['queued', 'pending'],
        ['scheduled', 'pending'],
        ['idle', 'pending'],
        ['PENDING', 'pending'],
        ['Queued', 'pending'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });

    describe('Warning variants', () => {
      it.each([
        ['warning', 'warning'],
        ['skipped', 'warning'],
        ['partial', 'warning'],
        ['WARNING', 'warning'],
        ['Skipped', 'warning'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });

    describe('Unknown status', () => {
      it.each([
        ['unknown_status', 'unknown'],
        ['random', 'unknown'],
        ['', 'unknown'],
        ['123', 'unknown'],
        ['something else', 'unknown'],
      ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeStatus(input)).toBe(expected);
      });
    });
  });

  describe('getStatusColor()', () => {
    it('returns correct color classes for each normalized status', () => {
      expect(getStatusColor('success')).toBe(STATUS_COLORS.success);
      expect(getStatusColor('error')).toBe(STATUS_COLORS.error);
      expect(getStatusColor('running')).toBe(STATUS_COLORS.running);
      expect(getStatusColor('pending')).toBe(STATUS_COLORS.pending);
      expect(getStatusColor('warning')).toBe(STATUS_COLORS.warning);
      expect(getStatusColor('unknown')).toBe(STATUS_COLORS.unknown);
    });

    it('normalizes status before returning color', () => {
      expect(getStatusColor('completed')).toBe(STATUS_COLORS.success);
      expect(getStatusColor('failed')).toBe(STATUS_COLORS.error);
      expect(getStatusColor('in_progress')).toBe(STATUS_COLORS.running);
    });

    it('returns correct tailwind classes with dark mode support', () => {
      const successColor = getStatusColor('success');
      expect(successColor).toContain('bg-green-100');
      expect(successColor).toContain('dark:bg-green-900/30');
      expect(successColor).toContain('text-green-700');
      expect(successColor).toContain('dark:text-green-400');
    });
  });

  describe('getStatusTextColor()', () => {
    it('returns text-only color classes for each status', () => {
      expect(getStatusTextColor('success')).toBe(STATUS_TEXT_COLORS.success);
      expect(getStatusTextColor('error')).toBe(STATUS_TEXT_COLORS.error);
      expect(getStatusTextColor('running')).toBe(STATUS_TEXT_COLORS.running);
      expect(getStatusTextColor('pending')).toBe(STATUS_TEXT_COLORS.pending);
      expect(getStatusTextColor('warning')).toBe(STATUS_TEXT_COLORS.warning);
      expect(getStatusTextColor('unknown')).toBe(STATUS_TEXT_COLORS.unknown);
    });

    it('normalizes status before returning text color', () => {
      expect(getStatusTextColor('completed')).toBe(STATUS_TEXT_COLORS.success);
      expect(getStatusTextColor('failed')).toBe(STATUS_TEXT_COLORS.error);
    });

    it('returns correct text-only tailwind classes', () => {
      const successColor = getStatusTextColor('success');
      expect(successColor).toBe('text-green-600 dark:text-green-400');
      expect(successColor).not.toContain('bg-');
    });
  });

  describe('getStatusBgColor()', () => {
    it('returns background color classes for progress bars', () => {
      expect(getStatusBgColor('success')).toBe('bg-green-500');
      expect(getStatusBgColor('error')).toBe('bg-red-500');
      expect(getStatusBgColor('running')).toBe('bg-blue-500');
      expect(getStatusBgColor('pending')).toBe('bg-gray-400');
      expect(getStatusBgColor('warning')).toBe('bg-yellow-500');
      expect(getStatusBgColor('unknown')).toBe('bg-gray-300');
    });

    it('normalizes status before returning background color', () => {
      expect(getStatusBgColor('completed')).toBe('bg-green-500');
      expect(getStatusBgColor('Up 2 hours')).toBe('bg-green-500');
    });
  });

  describe('getStatusIcon()', () => {
    it('returns correct icon components for each status', () => {
      const successIcon = getStatusIcon('success');
      expect(successIcon.type).toBeTruthy();
      expect(successIcon.props.className).toBe('w-4 h-4');

      const errorIcon = getStatusIcon('error');
      expect(errorIcon.type).toBeTruthy();

      const runningIcon = getStatusIcon('running');
      expect(runningIcon.type).toBeTruthy();
      expect(runningIcon.props.className).toContain('animate-pulse');

      const pendingIcon = getStatusIcon('pending');
      expect(pendingIcon.type).toBeTruthy();

      const warningIcon = getStatusIcon('warning');
      expect(warningIcon.type).toBeTruthy();
    });

    it('accepts custom className', () => {
      const icon = getStatusIcon('success', 'w-6 h-6');
      expect(icon.props.className).toBe('w-6 h-6');
    });

    it('adds animation to running status icon', () => {
      const icon = getStatusIcon('running', 'w-4 h-4');
      expect(icon.props.className).toContain('animate-pulse');
    });

    it('normalizes status before selecting icon', () => {
      const completedIcon = getStatusIcon('completed');
      expect(completedIcon.type).toBeTruthy();
      expect(completedIcon.props.className).toBe('w-4 h-4');

      const failedIcon = getStatusIcon('failed');
      expect(failedIcon.type).toBeTruthy();
      expect(failedIcon.props.className).toBe('w-4 h-4');
    });
  });

  describe('getStatusLabel()', () => {
    describe('Chinese labels for normalized status', () => {
      it.each([
        ['success', '成功'],
        ['error', '失败'],
        ['running', '运行中'],
        ['pending', '等待中'],
        ['warning', '警告'],
        ['unknown', '未知'],
      ])('returns "%s" for status "%s"', (status, expected) => {
        expect(getStatusLabel(status)).toBe(expected);
      });
    });

    describe('Extended status labels', () => {
      it.each([
        ['completed', '已完成'],
        ['done', '已完成'],
        ['passed', '通过'],
        ['merged', '已合并'],
        ['online', '在线'],
        ['failed', '失败'],
        ['crashed', '崩溃'],
        ['offline', '离线'],
        ['stopped', '已停止'],
        ['in_progress', '进行中'],
        ['active', '活跃'],
        ['executing', '执行中'],
        ['waiting', '等待中'],
        ['queued', '排队中'],
        ['scheduled', '已计划'],
        ['idle', '空闲'],
        ['skipped', '已跳过'],
        ['partial', '部分'],
        ['open', '开放'],
        ['closed', '关闭'],
      ])('returns "%s" for status "%s"', (status, expected) => {
        expect(getStatusLabel(status)).toBe(expected);
      });
    });

    it('handles case-insensitive input', () => {
      expect(getStatusLabel('COMPLETED')).toBe('已完成');
      expect(getStatusLabel('Failed')).toBe('失败');
      expect(getStatusLabel('IN_PROGRESS')).toBe('进行中');
    });

    it('falls back to normalized status label for unknown values', () => {
      expect(getStatusLabel('some_unknown_status')).toBe('未知');
      expect(getStatusLabel('')).toBe('未知');
    });
  });

  describe('getPercentageColor()', () => {
    describe('Color thresholds', () => {
      it('returns green for low percentages (< 60%)', () => {
        expect(getPercentageColor(0)).toBe('bg-green-500');
        expect(getPercentageColor(30)).toBe('bg-green-500');
        expect(getPercentageColor(59)).toBe('bg-green-500');
      });

      it('returns yellow for medium percentages (60-79%)', () => {
        expect(getPercentageColor(60)).toBe('bg-yellow-500');
        expect(getPercentageColor(70)).toBe('bg-yellow-500');
        expect(getPercentageColor(79)).toBe('bg-yellow-500');
      });

      it('returns red for high percentages (>= 80%)', () => {
        expect(getPercentageColor(80)).toBe('bg-red-500');
        expect(getPercentageColor(90)).toBe('bg-red-500');
        expect(getPercentageColor(100)).toBe('bg-red-500');
      });
    });

    describe('Edge cases', () => {
      it('handles boundary values', () => {
        expect(getPercentageColor(59.9)).toBe('bg-green-500');
        expect(getPercentageColor(60.0)).toBe('bg-yellow-500');
        expect(getPercentageColor(79.9)).toBe('bg-yellow-500');
        expect(getPercentageColor(80.0)).toBe('bg-red-500');
      });

      it('handles extreme values', () => {
        expect(getPercentageColor(-100)).toBe('bg-green-500');
        expect(getPercentageColor(200)).toBe('bg-red-500');
      });
    });
  });

  describe('Constants', () => {
    it('STATUS_COLORS has all normalized statuses', () => {
      const statuses: NormalizedStatus[] = ['success', 'error', 'running', 'pending', 'warning', 'unknown'];
      statuses.forEach(status => {
        expect(STATUS_COLORS).toHaveProperty(status);
        expect(STATUS_COLORS[status]).toBeTruthy();
        expect(STATUS_COLORS[status]).toContain('bg-');
        expect(STATUS_COLORS[status]).toContain('text-');
      });
    });

    it('STATUS_TEXT_COLORS has all normalized statuses', () => {
      const statuses: NormalizedStatus[] = ['success', 'error', 'running', 'pending', 'warning', 'unknown'];
      statuses.forEach(status => {
        expect(STATUS_TEXT_COLORS).toHaveProperty(status);
        expect(STATUS_TEXT_COLORS[status]).toBeTruthy();
        expect(STATUS_TEXT_COLORS[status]).toContain('text-');
        expect(STATUS_TEXT_COLORS[status]).not.toContain('bg-');
      });
    });

    it('STATUS_BG_COLORS has all normalized statuses', () => {
      const statuses: NormalizedStatus[] = ['success', 'error', 'running', 'pending', 'warning', 'unknown'];
      statuses.forEach(status => {
        expect(STATUS_BG_COLORS).toHaveProperty(status);
        expect(STATUS_BG_COLORS[status]).toBeTruthy();
        expect(STATUS_BG_COLORS[status]).toContain('bg-');
        expect(STATUS_BG_COLORS[status]).not.toContain('text-');
      });
    });

    it('STATUS_LABELS has all normalized statuses in Chinese', () => {
      const statuses: NormalizedStatus[] = ['success', 'error', 'running', 'pending', 'warning', 'unknown'];
      statuses.forEach(status => {
        expect(STATUS_LABELS).toHaveProperty(status);
        expect(STATUS_LABELS[status]).toBeTruthy();
        // Verify Chinese characters
        expect(STATUS_LABELS[status]).toMatch(/[\u4e00-\u9fa5]/);
      });
    });
  });
});