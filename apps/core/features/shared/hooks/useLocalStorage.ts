/**
 * Hook for managing localStorage with React state synchronization
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  syncAcrossTabs?: boolean;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncAcrossTabs = true
  } = options;

  // Get initial value from localStorage or use provided initial value
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserializer(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, deserializer, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        // Save state
        setStoredValue(valueToStore);

        // Save to localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, serializer(valueToStore));

          // Dispatch custom event for cross-tab synchronization
          if (syncAcrossTabs) {
            window.dispatchEvent(
              new CustomEvent('local-storage-change', {
                detail: { key, value: valueToStore }
              })
            );
          }
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serializer, storedValue, syncAcrossTabs]
  );

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        setStoredValue(initialValue);

        // Dispatch custom event for cross-tab synchronization
        if (syncAcrossTabs) {
          window.dispatchEvent(
            new CustomEvent('local-storage-change', {
              detail: { key, value: null }
            })
          );
        }
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue, syncAcrossTabs]);

  // Listen for storage changes (cross-tab synchronization)
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserializer(e.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage change for key "${key}":`, error);
        }
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue);
      }
    };

    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === key) {
        if (e.detail.value !== null) {
          setStoredValue(e.detail.value);
        } else {
          setStoredValue(initialValue);
        }
      }
    };

    // Listen to storage events from other tabs
    window.addEventListener('storage', handleStorageChange);
    // Listen to custom events from same tab
    window.addEventListener('local-storage-change', handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-change', handleCustomStorageChange as EventListener);
    };
  }, [key, deserializer, initialValue, syncAcrossTabs]);

  // Sync with localStorage on mount
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  return [storedValue, setValue, removeValue];
}

// Convenience hook for boolean values
export function useLocalStorageBoolean(
  key: string,
  initialValue: boolean = false
): [boolean, () => void, () => void, () => void] {
  const [value, setValue] = useLocalStorage(key, initialValue);

  const setTrue = useCallback(() => setValue(true), [setValue]);
  const setFalse = useCallback(() => setValue(false), [setValue]);
  const toggle = useCallback(() => setValue(v => !v), [setValue]);

  return [value, setTrue, setFalse, toggle];
}

// Convenience hook for array values
export function useLocalStorageArray<T>(
  key: string,
  initialValue: T[] = []
): {
  items: T[];
  add: (item: T) => void;
  remove: (index: number) => void;
  update: (index: number, item: T) => void;
  clear: () => void;
} {
  const [items, setItems] = useLocalStorage(key, initialValue);

  const add = useCallback(
    (item: T) => {
      setItems(prev => [...prev, item]);
    },
    [setItems]
  );

  const remove = useCallback(
    (index: number) => {
      setItems(prev => prev.filter((_, i) => i !== index));
    },
    [setItems]
  );

  const update = useCallback(
    (index: number, item: T) => {
      setItems(prev => {
        const newItems = [...prev];
        newItems[index] = item;
        return newItems;
      });
    },
    [setItems]
  );

  const clear = useCallback(() => {
    setItems([]);
  }, [setItems]);

  return { items, add, remove, update, clear };
}