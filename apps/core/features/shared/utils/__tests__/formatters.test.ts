/**
 * Tests for formatters.ts
 * Tests date/time, duration, bytes, and number formatting utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDateTime,
  formatTimeOnly,
  formatDuration,
  formatUptime,
  formatRelativeTime,
  formatBytes,
  formatTokens,
  formatNumber,
} from '../formatters.js';

describe('formatters', () => {
  describe('formatDateTime()', () => {
    describe('Valid dates', () => {
      it('formats Date object with default options', () => {
        const date = new Date('2026-02-16T14:30:00');
        const result = formatDateTime(date);
        expect(result).toMatch(/02.*16.*14.*30/); // Contains month, day, hour, minute
      });

      it('formats timestamp with default options', () => {
        const timestamp = new Date('2026-02-16T14:30:00').getTime();
        const result = formatDateTime(timestamp);
        expect(result).toMatch(/02.*16.*14.*30/);
      });

      it('formats date string with default options', () => {
        const result = formatDateTime('2026-02-16T14:30:00');
        expect(result).toMatch(/02.*16.*14.*30/);
      });

      it.each([
        ['short', 'short'],
        ['medium', 'medium'],
        ['long', 'long'],
        ['full', 'full'],
      ])('formats with dateStyle="%s" and timeStyle="%s"', (dateStyle, timeStyle) => {
        const date = new Date('2026-02-16T14:30:00');
        const result = formatDateTime(date, {
          dateStyle: dateStyle as any,
          timeStyle: timeStyle as any,
        });
        expect(result).toBeTruthy();
        expect(result).not.toBe('-');
      });
    });

    describe('Invalid dates', () => {
      it('returns "-" for invalid date string', () => {
        expect(formatDateTime('invalid')).toBe('-');
      });

      it('returns "-" for NaN', () => {
        expect(formatDateTime(NaN)).toBe('-');
      });

      it('returns "-" for null-like values', () => {
        // Note: new Date(null) returns Jan 1 1970, new Date(undefined) returns invalid
        expect(formatDateTime('invalid-date-string')).toBe('-');
      });
    });

    describe('Locale support', () => {
      it('uses zh-CN locale by default', () => {
        const date = new Date('2026-02-16T14:30:00');
        const result = formatDateTime(date);
        // Chinese format uses forward slashes or Chinese characters
        expect(result).toBeTruthy();
      });

      it('accepts custom locale', () => {
        const date = new Date('2026-02-16T14:30:00');
        const result = formatDateTime(date, { locale: 'en-US' });
        expect(result).toBeTruthy();
      });
    });
  });

  describe('formatTimeOnly()', () => {
    describe('Valid times', () => {
      it('formats time without seconds by default', () => {
        const date = new Date('2026-02-16T14:30:45');
        const result = formatTimeOnly(date);
        expect(result).toMatch(/14.*30/);
        expect(result).not.toMatch(/45/);
      });

      it('formats time with seconds when specified', () => {
        const date = new Date('2026-02-16T14:30:45');
        const result = formatTimeOnly(date, true);
        expect(result).toMatch(/14.*30.*45/);
      });

      it('formats timestamp', () => {
        const timestamp = new Date('2026-02-16T09:05:00').getTime();
        const result = formatTimeOnly(timestamp);
        expect(result).toMatch(/09.*05/);
      });
    });

    describe('Invalid times', () => {
      it('returns "--:--" for invalid date', () => {
        expect(formatTimeOnly('invalid')).toBe('--:--');
        expect(formatTimeOnly(NaN)).toBe('--:--');
      });
    });

    describe('Locale support', () => {
      it('uses custom locale', () => {
        const date = new Date('2026-02-16T14:30:00');
        const result = formatTimeOnly(date, false, 'en-US');
        expect(result).toBeTruthy();
        expect(result).not.toBe('--:--');
      });
    });
  });

  describe('formatDuration()', () => {
    describe('Standard formatting', () => {
      it.each([
        [0, '0秒'],
        [1000, '1秒'],
        [59000, '59秒'],
        [60000, '1分钟'],
        [61000, '1分钟 1秒'],
        [3600000, '1小时'],
        [3661000, '1小时 1分钟 1秒'],
        [86400000, '1天'],
        [90061000, '1天 1小时 1分钟'],
      ])('formats %d ms as "%s"', (ms, expected) => {
        expect(formatDuration(ms)).toBe(expected);
      });
    });

    describe('Compact formatting', () => {
      it.each([
        [0, '0s'],
        [1000, '1s'],
        [60000, '1m 0s'],  // Fixed: should include 0s
        [61000, '1m 1s'],
        [3600000, '1h 0m'],
        [86400000, '1d 0h'],
        [90000000, '1d 1h'],
      ])('formats %d ms as "%s" (compact)', (ms, expected) => {
        expect(formatDuration(ms, { compact: true })).toBe(expected);
      });
    });

    describe('Without seconds', () => {
      it('hides seconds when showSeconds is false', () => {
        expect(formatDuration(59000, { showSeconds: false })).toBe('<1分钟');
        expect(formatDuration(61000, { showSeconds: false })).toBe('1分钟');
        expect(formatDuration(3661000, { showSeconds: false })).toBe('1小时 1分钟');
      });

      it('hides seconds in compact mode when specified', () => {
        expect(formatDuration(59000, { compact: true, showSeconds: false })).toBe('<1m');
        expect(formatDuration(61000, { compact: true, showSeconds: false })).toBe('1m');
      });
    });

    describe('Edge cases', () => {
      it('handles negative values', () => {
        expect(formatDuration(-1000)).toBe('-');
      });

      it('handles NaN', () => {
        expect(formatDuration(NaN)).toBe('-');
      });

      it('handles large values', () => {
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        expect(formatDuration(threeDays)).toBe('3天');
      });
    });
  });

  describe('formatUptime()', () => {
    it.each([
      [0, '0分钟'],
      [59, '0分钟'],
      [60, '1分钟'],
      [3599, '59分钟'],
      [3600, '1小时 0分钟'],
      [7200, '2小时 0分钟'],
      [86400, '1天 0小时'],
      [90000, '1天 1小时'],
    ])('formats %d seconds as "%s"', (seconds, expected) => {
      expect(formatUptime(seconds)).toBe(expected);
    });

    it('handles invalid input', () => {
      expect(formatUptime(-1)).toBe('-');
      expect(formatUptime(NaN)).toBe('-');
    });
  });

  describe('formatRelativeTime()', () => {
    beforeEach(() => {
      // Mock current time to 2026-02-16T12:00:00
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-16T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['2026-02-16T11:59:31', '刚刚'], // 29 seconds ago
      ['2026-02-16T11:59:00', '1分钟前'], // 1 minute ago
      ['2026-02-16T11:00:00', '1小时前'], // 1 hour ago (function shows as hours)
      ['2026-02-16T10:00:00', '2小时前'], // 2 hours ago
      ['2026-02-15T12:00:00', '1天前'], // 1 day ago
      ['2026-02-10T12:00:00', '6天前'], // 6 days ago
    ])('formats %s as "%s"', (date, expected) => {
      expect(formatRelativeTime(date)).toBe(expected);
    });

    it('formats dates older than 7 days', () => {
      const result = formatRelativeTime('2026-01-01T12:00:00');
      expect(result).toMatch(/1月.*1/); // Contains month and day
    });

    it('handles future dates', () => {
      const result = formatRelativeTime('2026-02-16T12:00:30');
      expect(result).toBe('刚刚'); // Future times show as "just now"
    });

    it('handles invalid dates', () => {
      expect(formatRelativeTime('invalid')).toBe('-');
      expect(formatRelativeTime(NaN as any)).toBe('-');
    });
  });

  describe('formatBytes()', () => {
    describe('Standard formatting', () => {
      it.each([
        [0, '0 B'],
        [1, '1.0 B'],
        [1023, '1023.0 B'],
        [1024, '1.0 KB'],
        [1536, '1.5 KB'],
        [1048576, '1.0 MB'],
        [1073741824, '1.0 GB'],
        [1099511627776, '1.0 TB'],
      ])('formats %d bytes as "%s"', (bytes, expected) => {
        expect(formatBytes(bytes)).toBe(expected);
      });
    });

    describe('Custom decimals', () => {
      it.each([
        [1536, 0, '2 KB'],
        [1536, 1, '1.5 KB'],
        [1536, 2, '1.50 KB'],
        [1536, 3, '1.500 KB'],
      ])('formats %d bytes with %d decimals as "%s"', (bytes, decimals, expected) => {
        expect(formatBytes(bytes, decimals)).toBe(expected);
      });
    });

    describe('Edge cases', () => {
      it('handles negative values', () => {
        expect(formatBytes(-1)).toBe('-');
      });

      it('handles NaN', () => {
        expect(formatBytes(NaN)).toBe('-');
      });

      it('handles very large values', () => {
        const result = formatBytes(1099511627776 * 1000);
        expect(result).toMatch(/TB/);
      });
    });
  });

  describe('formatTokens()', () => {
    it.each([
      [0, '0'],
      [999, '999'],
      [1000, '1.0K'],
      [1500, '1.5K'],
      [999999, '1000.0K'],
      [1000000, '1.00M'],
      [1500000, '1.50M'],
      [10000000, '10.00M'],
    ])('formats %d tokens as "%s"', (tokens, expected) => {
      expect(formatTokens(tokens)).toBe(expected);
    });

    it('handles invalid input', () => {
      expect(formatTokens(-1)).toBe('-');
      expect(formatTokens(NaN)).toBe('-');
    });
  });

  describe('formatNumber()', () => {
    it('formats with default zh-CN locale', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(1234567.89)).toBe('1,234,567.89');
    });

    it('accepts custom locale', () => {
      const result = formatNumber(1000, 'en-US');
      expect(result).toBeTruthy();
      expect(result).not.toBe('-');
    });

    it('handles edge cases', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(NaN)).toBe('-');
    });

    it('handles decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
      expect(formatNumber(0.123)).toBe('0.123');
    });
  });

  describe('Performance', () => {
    it('formatDateTime executes in less than 1ms', () => {
      const start = performance.now();
      formatDateTime(new Date());
      const end = performance.now();
      expect(end - start).toBeLessThan(1);
    });

    it('formatDuration executes in less than 1ms', () => {
      const start = performance.now();
      formatDuration(3661000);
      const end = performance.now();
      expect(end - start).toBeLessThan(1);
    });

    it('formatBytes executes in less than 1ms', () => {
      const start = performance.now();
      formatBytes(1048576);
      const end = performance.now();
      expect(end - start).toBeLessThan(1);
    });
  });
});