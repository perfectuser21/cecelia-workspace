/**
 * Tests for usePolling hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling, usePollingWithRefresh, useCountdown } from './usePolling';

describe('usePolling Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Interval Execution', () => {
    it('should execute callback at specified intervals', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();

      renderHook(() =>
        usePolling(callback, {
          interval: 1000,
          enabled: true
        })
      );

      // Initial execution if immediate is true (default)
      expect(callback).toHaveBeenCalledTimes(0);

      // First interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Second interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(2);

      // Third interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should handle async callbacks correctly', async () => {
      vi.useFakeTimers();

      let resolvePromise: () => void;
      const callback = vi.fn(async () => {
        await new Promise(resolve => {
          resolvePromise = resolve;
        });
      });

      renderHook(() =>
        usePolling(callback, {
          interval: 1000,
          enabled: true
        })
      );

      // Trigger first execution
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Advance time while async callback is still running
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not call again while previous is running
      expect(callback).toHaveBeenCalledTimes(1);

      // Resolve the async callback
      resolvePromise!();
      await waitFor(() => {});

      // Now advance time again
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should call again after previous completed
      expect(callback).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Enable/Disable Toggle', () => {
    it('should start and stop polling based on enabled prop', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) =>
          usePolling(callback, {
            interval: 1000,
            enabled
          }),
        { initialProps: { enabled: true } }
      );

      // Advance time - should execute
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Disable polling
      rerender({ enabled: false });

      // Advance time - should not execute
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(callback).toHaveBeenCalledTimes(1); // Still 1

      // Re-enable polling
      rerender({ enabled: true });

      // Advance time - should execute again
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should cleanup interval on unmount', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();

      const { unmount } = renderHook(() =>
        usePolling(callback, {
          interval: 1000,
          enabled: true
        })
      );

      // First execution
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Advance time after unmount
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not execute after unmount
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Immediate Execution Option', () => {
    it('should execute immediately when immediate is true', async () => {
      const callback = vi.fn();

      renderHook(() =>
        usePolling(callback, {
          interval: 1000,
          enabled: true,
          immediate: true
        })
      );

      // Should execute immediately
      await waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it('should not execute immediately when immediate is false', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();

      renderHook(() =>
        usePolling(callback, {
          interval: 1000,
          enabled: true,
          immediate: false
        })
      );

      // Should not execute immediately
      expect(callback).toHaveBeenCalledTimes(0);

      // Wait for first interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Now should have executed
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Countdown Timer', () => {
    it('should countdown to target time', async () => {
      vi.useFakeTimers();

      const now = new Date('2024-01-01 12:00:00');
      vi.setSystemTime(now);

      const targetTime = new Date('2024-01-01 12:00:10'); // 10 seconds from now

      const { result } = renderHook(() =>
        useCountdown(targetTime, 1000)
      );

      // Initial state - 10 seconds remaining
      expect(result.current.remainingTime).toBe(10000);
      expect(result.current.isExpired).toBe(false);
      expect(result.current.display).toMatch(/0:10/);

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.remainingTime).toBe(5000);
      expect(result.current.isExpired).toBe(false);
      expect(result.current.display).toMatch(/0:05/);

      // Advance to expiry
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.remainingTime).toBe(0);
      expect(result.current.isExpired).toBe(true);
      expect(result.current.display).toBe('Expired');

      vi.useRealTimers();
    });

    it('should handle already expired target time', async () => {
      vi.useFakeTimers();

      const now = new Date('2024-01-01 12:00:00');
      vi.setSystemTime(now);

      const targetTime = new Date('2024-01-01 11:00:00'); // 1 hour ago

      const { result } = renderHook(() =>
        useCountdown(targetTime, 1000)
      );

      expect(result.current.remainingTime).toBe(0);
      expect(result.current.isExpired).toBe(true);
      expect(result.current.display).toBe('Expired');

      vi.useRealTimers();
    });
  });
});

describe('usePollingWithRefresh Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provide manual refresh capability', async () => {
    vi.useFakeTimers();

    const callback = vi.fn();

    const { result } = renderHook(() =>
      usePollingWithRefresh(callback, {
        interval: 5000,
        enabled: true
      })
    );

    expect(callback).toHaveBeenCalledTimes(0);

    // Manual refresh
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    // Manual refresh again
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(2);
    });

    // Also continues polling
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('should track refreshing state', async () => {
    const callback = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const { result } = renderHook(() =>
      usePollingWithRefresh(callback, {
        interval: 5000,
        enabled: true
      })
    );

    expect(result.current.isRefreshing).toBe(false);

    // Start refresh
    act(() => {
      result.current.refresh();
    });

    // Should be refreshing
    expect(result.current.isRefreshing).toBe(true);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });
  });

  it('should handle refresh errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const callback = vi.fn(async () => {
      throw new Error('Refresh failed');
    });

    const { result } = renderHook(() =>
      usePollingWithRefresh(callback, {
        interval: 5000,
        enabled: true
      })
    );

    // Trigger refresh
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });

    // Should have called callback despite error
    expect(callback).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});