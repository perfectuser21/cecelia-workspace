/**
 * Tests for useLocalStorage hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalStorage, useLocalStorageBoolean, useLocalStorageArray } from './useLocalStorage';

describe('useLocalStorage Hook', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock localStorage
    const store: { [key: string]: string } = {};

    localStorageMock = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      })
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    vi.clearAllMocks();
  });

  describe('Read/Write Synchronization', () => {
    it('should read initial value from localStorage', () => {
      localStorageMock.setItem('test-key', JSON.stringify('stored-value'));

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default-value')
      );

      expect(result.current[0]).toBe('stored-value');
    });

    it('should use default value when localStorage is empty', () => {
      const { result } = renderHook(() =>
        useLocalStorage('empty-key', 'default-value')
      );

      expect(result.current[0]).toBe('default-value');
    });

    it('should write to localStorage when value changes', () => {
      const { result } = renderHook(() =>
        useLocalStorage('write-key', 'initial')
      );

      act(() => {
        result.current[1]('updated');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'write-key',
        JSON.stringify('updated')
      );
      expect(result.current[0]).toBe('updated');
    });

    it('should support function updater', () => {
      const { result } = renderHook(() =>
        useLocalStorage('counter', 0)
      );

      act(() => {
        result.current[1](prev => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1](prev => prev * 2);
      });

      expect(result.current[0]).toBe(2);
    });

    it('should remove value from localStorage', () => {
      const { result } = renderHook(() =>
        useLocalStorage('remove-key', 'value')
      );

      act(() => {
        result.current[1]('stored');
      });

      expect(result.current[0]).toBe('stored');

      act(() => {
        result.current[2](); // removeValue
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('remove-key');
      expect(result.current[0]).toBe('value'); // Back to initial value
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize and deserialize objects', () => {
      const testObject = { name: 'Test', value: 123, nested: { deep: true } };

      const { result } = renderHook(() =>
        useLocalStorage('object-key', testObject)
      );

      expect(result.current[0]).toEqual(testObject);

      const newObject = { name: 'Updated', value: 456 };
      act(() => {
        result.current[1](newObject);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'object-key',
        JSON.stringify(newObject)
      );
      expect(result.current[0]).toEqual(newObject);
    });

    it('should handle arrays correctly', () => {
      const testArray = [1, 2, 3, { id: 1 }];

      const { result } = renderHook(() =>
        useLocalStorage('array-key', testArray)
      );

      expect(result.current[0]).toEqual(testArray);

      act(() => {
        result.current[1]([...testArray, 4]);
      });

      expect(result.current[0]).toEqual([1, 2, 3, { id: 1 }, 4]);
    });

    it('should support custom serializers', () => {
      const customSerializer = (value: Date) => value.toISOString();
      const customDeserializer = (value: string) => new Date(value);

      const testDate = new Date('2024-01-01');

      const { result } = renderHook(() =>
        useLocalStorage('date-key', testDate, {
          serializer: customSerializer,
          deserializer: customDeserializer
        })
      );

      expect(result.current[0]).toEqual(testDate);

      const newDate = new Date('2024-12-31');
      act(() => {
        result.current[1](newDate);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'date-key',
        newDate.toISOString()
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted localStorage data gracefully', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorageMock.setItem('corrupted-key', 'not-valid-json');

      const { result } = renderHook(() =>
        useLocalStorage('corrupted-key', { default: 'value' })
      );

      // Should fall back to initial value
      expect(result.current[0]).toEqual({ default: 'value' });
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });

    it('should handle localStorage quota exceeded', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() =>
        useLocalStorage('quota-key', 'initial')
      );

      act(() => {
        result.current[1]('too-much-data');
      });

      // Value should still update in state even if localStorage fails
      expect(result.current[0]).toBe('too-much-data');
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });

    it('should handle localStorage access denied', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() =>
        useLocalStorage('secure-key', 'fallback')
      );

      // Should use initial value when localStorage throws
      expect(result.current[0]).toBe('fallback');
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });
  });

  describe('Cross-tab Synchronization', () => {
    it('should sync changes across tabs via storage event', async () => {
      const { result } = renderHook(() =>
        useLocalStorage('sync-key', 'initial', { syncAcrossTabs: true })
      );

      expect(result.current[0]).toBe('initial');

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'sync-key',
        newValue: JSON.stringify('from-other-tab'),
        oldValue: JSON.stringify('initial'),
        storageArea: window.localStorage
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      await waitFor(() => {
        expect(result.current[0]).toBe('from-other-tab');
      });
    });

    it('should handle removal in other tabs', async () => {
      const { result } = renderHook(() =>
        useLocalStorage('sync-remove-key', 'value', { syncAcrossTabs: true })
      );

      act(() => {
        result.current[1]('stored');
      });

      expect(result.current[0]).toBe('stored');

      // Simulate removal from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'sync-remove-key',
        newValue: null,
        oldValue: JSON.stringify('stored'),
        storageArea: window.localStorage
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      await waitFor(() => {
        expect(result.current[0]).toBe('value'); // Back to initial
      });
    });

    it('should dispatch custom events for same-tab updates', async () => {
      const eventListener = vi.fn();
      window.addEventListener('local-storage-change', eventListener);

      const { result } = renderHook(() =>
        useLocalStorage('custom-event-key', 'initial', { syncAcrossTabs: true })
      );

      act(() => {
        result.current[1]('updated');
      });

      await waitFor(() => {
        expect(eventListener).toHaveBeenCalled();
      });

      const event = eventListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({
        key: 'custom-event-key',
        value: 'updated'
      });

      window.removeEventListener('local-storage-change', eventListener);
    });
  });

  describe('Initial Value Setting', () => {
    it('should set initial value if key does not exist', () => {
      const { result } = renderHook(() =>
        useLocalStorage('new-key', 'initial-value')
      );

      expect(result.current[0]).toBe('initial-value');
    });

    it('should not overwrite existing value with initial value', () => {
      localStorageMock.setItem('existing-key', JSON.stringify('existing'));

      const { result } = renderHook(() =>
        useLocalStorage('existing-key', 'initial')
      );

      expect(result.current[0]).toBe('existing');
    });

    it('should handle complex initial values', () => {
      const complexInitial = {
        user: { id: 1, name: 'Test' },
        settings: { theme: 'dark', notifications: true },
        data: [1, 2, 3]
      };

      const { result } = renderHook(() =>
        useLocalStorage('complex-key', complexInitial)
      );

      expect(result.current[0]).toEqual(complexInitial);
    });
  });
});

describe('useLocalStorageBoolean Hook', () => {
  beforeEach(() => {
    const store: { [key: string]: string } = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn()
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });

  it('should provide boolean convenience methods', () => {
    const { result } = renderHook(() =>
      useLocalStorageBoolean('bool-key', false)
    );

    const [value, setTrue, setFalse, toggle] = result.current;

    expect(value).toBe(false);

    act(() => {
      setTrue();
    });

    expect(result.current[0]).toBe(true);

    act(() => {
      setFalse();
    });

    expect(result.current[0]).toBe(false);

    act(() => {
      toggle();
    });

    expect(result.current[0]).toBe(true);

    act(() => {
      toggle();
    });

    expect(result.current[0]).toBe(false);
  });
});

describe('useLocalStorageArray Hook', () => {
  beforeEach(() => {
    const store: { [key: string]: string } = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn()
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });

  it('should provide array convenience methods', () => {
    interface Item {
      id: number;
      name: string;
    }

    const { result } = renderHook(() =>
      useLocalStorageArray<Item>('array-key', [])
    );

    expect(result.current.items).toEqual([]);

    // Add item
    act(() => {
      result.current.add({ id: 1, name: 'Item 1' });
    });

    expect(result.current.items).toEqual([{ id: 1, name: 'Item 1' }]);

    // Add another item
    act(() => {
      result.current.add({ id: 2, name: 'Item 2' });
    });

    expect(result.current.items).toHaveLength(2);

    // Update item
    act(() => {
      result.current.update(0, { id: 1, name: 'Updated Item 1' });
    });

    expect(result.current.items[0].name).toBe('Updated Item 1');

    // Remove item
    act(() => {
      result.current.remove(1);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(1);

    // Clear all
    act(() => {
      result.current.clear();
    });

    expect(result.current.items).toEqual([]);
  });
});