/**
 * Tests for useDataFetch hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataFetch, usePolledData } from './useDataFetch';

describe('useDataFetch Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Dependency-based Refetching', () => {
    it('should refetch when dependencies change', async () => {
      let callCount = 0;
      const fetcher = vi.fn(async () => {
        callCount++;
        return { count: callCount };
      });

      const { result, rerender } = renderHook(
        ({ deps }) => useDataFetch(fetcher, { dependencies: deps }),
        { initialProps: { deps: [1] } }
      );

      // Initial fetch
      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      // Change dependencies
      rerender({ deps: [2] });

      // Should trigger refetch
      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 2 });
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should not refetch when dependencies are the same', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }));

      const { result, rerender } = renderHook(
        ({ deps }) => useDataFetch(fetcher, { dependencies: deps }),
        { initialProps: { deps: [1, 'test'] } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' });
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      // Rerender with same dependencies
      rerender({ deps: [1, 'test'] });

      // Should not trigger refetch
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should handle empty dependencies array', async () => {
      const fetcher = vi.fn(async () => ({ data: 'once' }));

      const { result, rerender } = renderHook(() =>
        useDataFetch(fetcher, { dependencies: [] })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'once' });
      });

      // Rerender multiple times
      rerender();
      rerender();

      // Should only fetch once
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Transformation', () => {
    it('should apply transform function to fetched data', async () => {
      const rawData = { items: [1, 2, 3], total: 3 };
      const fetcher = vi.fn(async () => rawData);
      const transform = (data: typeof rawData) => ({
        ...data,
        average: data.total / data.items.length,
        doubled: data.items.map(x => x * 2)
      });

      const { result } = renderHook(() =>
        useDataFetch(fetcher, { transform })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({
          items: [1, 2, 3],
          total: 3,
          average: 1,
          doubled: [2, 4, 6]
        });
      });
    });

    it('should handle transform function errors', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }));
      const transform = () => {
        throw new Error('Transform error');
      };

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDataFetch(fetcher, { transform })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe('Transform error');
      });

      consoleError.mockRestore();
    });
  });

  describe('Success/Error Callbacks', () => {
    it('should call onSuccess callback with fetched data', async () => {
      const fetcher = vi.fn(async () => ({ success: true }));
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useDataFetch(fetcher, { onSuccess, onError })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ success: true });
      });

      expect(onSuccess).toHaveBeenCalledWith({ success: true });
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onError callback on fetch failure', async () => {
      const error = new Error('Fetch failed');
      const fetcher = vi.fn(async () => {
        throw error;
      });
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useDataFetch(fetcher, { onSuccess, onError })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(onError).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }));
      const onSuccess = vi.fn(() => {
        throw new Error('Callback error');
      });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDataFetch(fetcher, { onSuccess })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' });
      });

      // Data should still be set even if callback fails
      expect(result.current.data).toEqual({ data: 'test' });
      expect(onSuccess).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Manual Refresh', () => {
    it('should refresh data on manual trigger', async () => {
      let callCount = 0;
      const fetcher = vi.fn(async () => ({
        count: ++callCount
      }));

      const { result } = renderHook(() =>
        useDataFetch(fetcher, {})
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      // Manual refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 2 });
      });

      // Another refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 3 });
      });

      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('should track loading state during refresh', async () => {
      const fetcher = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: 'refreshed' };
      });

      const { result } = renderHook(() =>
        useDataFetch(fetcher, {})
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start refresh
      act(() => {
        result.current.refresh();
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toEqual({ data: 'refreshed' });
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset data and error states', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }));

      const { result } = renderHook(() =>
        useDataFetch(fetcher, {})
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' });
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.lastUpdated).toBeNull();
    });

    it('should not trigger fetch after reset', async () => {
      const fetcher = vi.fn(async () => ({ data: 'test' }));

      const { result } = renderHook(() =>
        useDataFetch(fetcher, {})
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' });
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Should not trigger another fetch
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});

describe('usePolledData Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should poll data at specified interval', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fetcher = vi.fn(async () => ({
      count: ++callCount
    }));

    const { result } = renderHook(() =>
      usePolledData(fetcher, 1000)
    );

    // Initial fetch
    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 1 });
    });

    // Advance time for first poll
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 2 });
    });

    // Advance time for second poll
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 3 });
    });

    vi.useRealTimers();
  });

  it('should stop polling on unmount', async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn(async () => ({ data: 'test' }));

    const { unmount } = renderHook(() =>
      usePolledData(fetcher, 1000)
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Advance time after unmount
    vi.advanceTimersByTime(5000);

    // Should not fetch after unmount
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should restart polling when dependencies change', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fetcher = vi.fn(async () => ({
      count: ++callCount
    }));

    const { result, rerender } = renderHook(
      ({ deps }) => usePolledData(fetcher, 1000, deps),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 1 });
    });

    // Change dependencies
    rerender({ deps: [2] });

    // Should immediately refetch
    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 2 });
    });

    // Continue polling with new dependencies
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 3 });
    });

    vi.useRealTimers();
  });
});