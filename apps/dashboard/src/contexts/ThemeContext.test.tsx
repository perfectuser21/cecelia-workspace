/**
 * Tests for ThemeContext
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';
import {
  mockLocalStorage,
  mockMatchMedia,
  mockSystemTime
} from '../test/utils/test-helpers';

// Wrapper component for testing
const createWrapper = () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );
  return wrapper;
};

describe('ThemeContext', () => {
  let localStorageMock: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    // Reset mocks before each test
    localStorageMock = mockLocalStorage();
    vi.clearAllMocks();

    // Mock CSS variables on document
    const mockSetProperty = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: {
        setProperty: mockSetProperty,
        removeProperty: vi.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Theme Switching', () => {
    it('should switch between light and dark themes', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      // Default should be auto
      expect(result.current.theme).toBe('auto');

      // Switch to light
      act(() => {
        result.current.setTheme('light');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
        expect(result.current.isDark).toBe(false);
      });

      // Switch to dark
      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
        expect(result.current.isDark).toBe(true);
      });
    });

    it('should toggle theme correctly', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      // Set initial theme to light
      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.isDark).toBe(false);

      // Toggle theme
      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
        expect(result.current.isDark).toBe(true);
      });

      // Toggle again
      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
        expect(result.current.isDark).toBe(false);
      });
    });
  });

  describe('Auto Mode (Time-based)', () => {
    it('should use dark theme during night hours (18:00-7:00)', async () => {
      // Set time to 20:00 (8 PM)
      const timeMock = mockSystemTime('2024-01-01 20:00:00');

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      // Set to auto mode
      act(() => {
        result.current.setTheme('auto');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('auto');
        expect(result.current.isDark).toBe(true); // Should be dark at 20:00
      });

      timeMock.restore();
    });

    it('should use light theme during day hours (7:00-18:00)', async () => {
      // Set time to 12:00 (noon)
      const timeMock = mockSystemTime('2024-01-01 12:00:00');

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      // Set to auto mode
      act(() => {
        result.current.setTheme('auto');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('auto');
        expect(result.current.isDark).toBe(false); // Should be light at 12:00
      });

      timeMock.restore();
    });

    it('should update theme when time changes in auto mode', async () => {
      const timeMock = mockSystemTime('2024-01-01 17:59:00');

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('auto');
      });

      expect(result.current.isDark).toBe(false); // Light at 17:59

      // Advance time to 18:01
      act(() => {
        timeMock.advance(2 * 60 * 1000); // 2 minutes
        vi.setSystemTime(new Date('2024-01-01 18:01:00'));
      });

      // Trigger theme check (would normally happen via interval)
      act(() => {
        result.current.setTheme('auto'); // Re-trigger auto mode check
      });

      await waitFor(() => {
        expect(result.current.isDark).toBe(true); // Dark at 18:01
      });

      timeMock.restore();
    });
  });

  describe('localStorage Persistence', () => {
    it('should persist theme preference to localStorage', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
          'theme_preference',
          'dark'
        );
      });

      act(() => {
        result.current.setTheme('light');
      });

      await waitFor(() => {
        expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
          'theme_preference',
          'light'
        );
      });
    });

    it('should load theme preference from localStorage on mount', async () => {
      localStorageMock.store['theme_preference'] = 'dark';

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
        expect(result.current.isDark).toBe(true);
      });
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      localStorageMock.store['theme_preference'] = 'invalid-theme';

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      // Should fall back to auto
      await waitFor(() => {
        expect(result.current.theme).toBe('auto');
      });
    });
  });

  describe('CSS Variable Application', () => {
    it('should apply CSS variables for dark theme', async () => {
      const mockSetProperty = vi.fn();
      document.documentElement.style.setProperty = mockSetProperty;

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--background',
          expect.stringContaining('#')
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--text-primary',
          expect.stringContaining('#')
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--border',
          expect.stringContaining('#')
        );
      });
    });

    it('should apply CSS variables for light theme', async () => {
      const mockSetProperty = vi.fn();
      document.documentElement.style.setProperty = mockSetProperty;

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('light');
      });

      await waitFor(() => {
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--background',
          expect.stringContaining('#')
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--text-primary',
          expect.stringContaining('#')
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--border',
          expect.stringContaining('#')
        );
      });
    });
  });

  describe('System Theme Detection', () => {
    it('should detect system dark mode preference', async () => {
      mockMatchMedia(true); // System prefers dark

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('system');
      });

      await waitFor(() => {
        expect(result.current.isDark).toBe(true);
      });
    });

    it('should detect system light mode preference', async () => {
      mockMatchMedia(false); // System prefers light

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('system');
      });

      await waitFor(() => {
        expect(result.current.isDark).toBe(false);
      });
    });

    it('should respond to system theme changes', async () => {
      let darkModeListeners: Array<(e: any) => void> = [];

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: false, // Start with light
          media: query,
          addEventListener: vi.fn((event, listener) => {
            if (event === 'change') {
              darkModeListeners.push(listener);
            }
          }),
          removeEventListener: vi.fn()
        }))
      });

      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper()
      });

      act(() => {
        result.current.setTheme('system');
      });

      expect(result.current.isDark).toBe(false);

      // Simulate system theme change to dark
      act(() => {
        darkModeListeners.forEach(listener => {
          listener({ matches: true });
        });
      });

      await waitFor(() => {
        expect(result.current.isDark).toBe(true);
      });
    });
  });
});