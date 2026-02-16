/**
 * Tests for useApi hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi, useApiFn } from './useApi';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useApi Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the internal cache between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('SWR Caching Behavior', () => {
    it('should return cached data immediately while revalidating', async () => {
      const mockData = { id: 1, name: 'Test' };

      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const { result, rerender } = renderHook(() =>
        useApi('/api/test', { key: 'test-key', staleTime: 60000 })
      );

      // Initial loading state
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // Wait for first load
      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
        expect(result.current.loading).toBe(false);
      });

      // Second request with updated data
      const updatedData = { id: 1, name: 'Updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData
      });

      // Remount with same key - should get cached data immediately
      rerender();

      // Should have cached data immediately
      expect(result.current.data).toEqual(mockData);
      expect(result.current.refreshing).toBe(true); // But refreshing in background

      // Wait for revalidation
      await waitFor(() => {
        expect(result.current.data).toEqual(updatedData);
        expect(result.current.refreshing).toBe(false);
      });
    });

    it('should respect staleTime for cache invalidation', async () => {
      vi.useFakeTimers();

      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const { result } = renderHook(() =>
        useApi('/api/test', { key: 'stale-test', staleTime: 5000 })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Advance time but not past staleTime
      vi.advanceTimersByTime(4000);

      // Trigger re-render
      act(() => {
        result.current.refresh();
      });

      // Should still use cached data without fetching
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance past staleTime
      vi.advanceTimersByTime(2000);

      // Now refresh should trigger new fetch
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate simultaneous requests with same key', async () => {
      const mockData = { id: 1, name: 'Test' };
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementation(() => promise);

      // Mount two hooks with same key simultaneously
      const { result: result1 } = renderHook(() =>
        useApi('/api/test', { key: 'dedup-test' })
      );

      const { result: result2 } = renderHook(() =>
        useApi('/api/test', { key: 'dedup-test' })
      );

      // Both should be loading
      expect(result1.current.loading).toBe(true);
      expect(result2.current.loading).toBe(true);

      // Only one fetch should be made
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: async () => mockData
      });

      // Both hooks should get the same data
      await waitFor(() => {
        expect(result1.current.data).toEqual(mockData);
        expect(result2.current.data).toEqual(mockData);
      });

      // Still only one fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not deduplicate requests with different keys', async () => {
      const mockData1 = { id: 1, name: 'Test1' };
      const mockData2 = { id: 2, name: 'Test2' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData2
        });

      const { result: result1 } = renderHook(() =>
        useApi('/api/test1', { key: 'key1' })
      );

      const { result: result2 } = renderHook(() =>
        useApi('/api/test2', { key: 'key2' })
      );

      await waitFor(() => {
        expect(result1.current.data).toEqual(mockData1);
        expect(result2.current.data).toEqual(mockData2);
      });

      // Two separate fetches should be made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Polling Mechanism', () => {
    it('should poll at specified interval', async () => {
      vi.useFakeTimers();

      const mockData = { count: 1 };
      let callCount = 0;

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ count: ++callCount })
      }));

      const { result } = renderHook(() =>
        useApi('/api/poll', {
          key: 'poll-test',
          pollInterval: 1000,
          staleTime: 0 // Force refetch on each poll
        })
      );

      // Initial fetch
      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      // Advance time and trigger poll
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 2 });
      });

      // Another poll
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 3 });
      });

      vi.useRealTimers();
    });

    it('should stop polling when component unmounts', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' })
      });

      const { unmount } = renderHook(() =>
        useApi('/api/poll', {
          key: 'unmount-poll-test',
          pollInterval: 1000
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Unmount the hook
      unmount();

      // Advance time - no more fetches should occur
      vi.advanceTimersByTime(5000);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Network error';
      mockFetch.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() =>
        useApi('/api/error', { key: 'error-test' })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe(errorMessage);
        expect(result.current.data).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() =>
        useApi('/api/notfound', { key: 'notfound-test' })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toContain('404');
        expect(result.current.data).toBeNull();
      });
    });

    it('should retry on error with manual refresh', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useApi('/api/retry', { key: 'retry-test' })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      // Manual refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.data).toEqual({ success: true });
      });
    });
  });

  describe('Data Transformation', () => {
    it('should apply transform function to response data', async () => {
      const rawData = { items: [1, 2, 3], total: 3 };
      const transform = (data: typeof rawData) => ({
        ...data,
        average: data.total / data.items.length
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rawData
      });

      const { result } = renderHook(() =>
        useApi('/api/transform', {
          key: 'transform-test',
          transform
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({
          items: [1, 2, 3],
          total: 3,
          average: 1
        });
      });
    });
  });

  describe('Manual Refresh', () => {
    it('should refresh data on manual trigger', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ count: ++callCount })
      }));

      const { result } = renderHook(() =>
        useApi('/api/manual', {
          key: 'manual-test',
          staleTime: 60000 // Long stale time
        })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      // Manual refresh should bypass stale time
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 2 });
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useApiFn Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use custom fetcher function', async () => {
    const customFetcher = vi.fn(async () => ({ custom: 'data' }));

    const { result } = renderHook(() =>
      useApiFn('custom-key', customFetcher, {})
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ custom: 'data' });
      expect(customFetcher).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle custom fetcher errors', async () => {
    const customFetcher = vi.fn(async () => {
      throw new Error('Custom error');
    });

    const { result } = renderHook(() =>
      useApiFn('error-key', customFetcher, {})
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Custom error');
    });
  });

  it('should support enabled option', async () => {
    const customFetcher = vi.fn(async () => ({ data: 'test' }));

    const { result, rerender } = renderHook(
      ({ enabled }) => useApiFn('enabled-key', customFetcher, { enabled }),
      { initialProps: { enabled: false } }
    );

    // Should not fetch when disabled
    expect(customFetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();

    // Enable and trigger fetch
    rerender({ enabled: true });

    await waitFor(() => {
      expect(customFetcher).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual({ data: 'test' });
    });
  });
});