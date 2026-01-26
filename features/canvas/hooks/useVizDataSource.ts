import { useState, useEffect, useRef, useCallback } from 'react';

export interface DataSourceConfig {
  url: string;
  params?: Record<string, string>;
  interval?: number; // 刷新间隔(ms)，0 = 不自动刷新
}

interface UseVizDataSourceReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

export function useVizDataSource<T = any>(
  config: DataSourceConfig
): UseVizDataSourceReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const buildUrl = useCallback(() => {
    if (!config.url) {
      throw new Error('Data source URL is required');
    }
    try {
      const url = new URL(config.url);
      if (config.params) {
        Object.entries(config.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }
      return url.toString();
    } catch (err) {
      throw new Error(`Invalid data source URL: ${config.url}`);
    }
  }, [config.url, config.params]);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!config.url) return; // Skip fetch if no URL provided

    setLoading(true);
    setError(null);

    try {
      const url = buildUrl();
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newData = await response.json();

      if (!isMountedRef.current) return;

      // 深度比较，只在数据真正变化时更新
      setData((prevData) => {
        if (deepEqual(prevData, newData)) {
          return prevData;
        }
        return newData;
      });

      retryCountRef.current = 0; // 重置重试计数
      setLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      const fetchError = err instanceof Error ? err : new Error(String(err));

      // 错误重试机制
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchData();
          }
        }, RETRY_DELAY * retryCountRef.current);
      } else {
        setError(fetchError);
        setLoading(false);
        retryCountRef.current = 0;
      }
    }
  }, [buildUrl]);

  const refresh = useCallback(() => {
    retryCountRef.current = 0;
    fetchData();
  }, [fetchData]);

  // 初始化数据获取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 轮询机制
  useEffect(() => {
    if (config.interval && config.interval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, config.interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [config.interval, fetchData]);

  // 清理函数
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { data, loading, error, refresh };
}
