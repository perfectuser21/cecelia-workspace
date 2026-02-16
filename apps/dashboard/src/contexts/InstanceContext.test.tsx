/**
 * Tests for InstanceContext
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { InstanceProvider, useInstance } from './InstanceContext';
import { mockFetch, waitForAsync } from '../test/utils/test-helpers';

// Mock configuration
const mockCoreConfig = {
  features: {
    tasks: { enabled: true, priority: 1 },
    okr: { enabled: true, priority: 2 },
    brain: { enabled: true, priority: 3 }
  },
  navigation: [
    { id: 'tasks', label: 'Tasks', path: '/tasks' },
    { id: 'okr', label: 'OKR', path: '/okr' }
  ]
};

const mockInstanceConfig = {
  id: 'instance-1',
  name: 'Test Instance',
  theme: {
    primaryColor: '#3B82F6',
    backgroundColor: '#1F2937',
    textColor: '#F3F4F6',
    accentColor: '#10B981'
  },
  features: {
    advancedMode: true,
    experimentalFeatures: false
  }
};

// Wrapper component for testing
const createWrapper = (config = mockInstanceConfig) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <InstanceProvider config={config}>{children}</InstanceProvider>
  );
  return wrapper;
};

describe('InstanceContext', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock document.documentElement.style.setProperty
    const mockSetProperty = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: {
        setProperty: mockSetProperty,
        removeProperty: vi.fn()
      },
      writable: true
    });

    fetchMock = mockFetch([
      {
        url: '/api/core/config',
        response: mockCoreConfig
      },
      {
        url: '/api/instance/config',
        response: mockInstanceConfig
      }
    ]);
  });

  describe('Instance Configuration Loading', () => {
    it('should load instance configuration on mount', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      expect(result.current.config).toEqual(mockInstanceConfig);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle missing instance configuration gracefully', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper(undefined)
      });

      // Should use default config
      expect(result.current.config).toEqual({
        id: 'default',
        name: 'Default Instance',
        theme: {},
        features: {}
      });
    });

    it('should merge instance config with Core config', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      // Wait for Core config to load
      await waitFor(() => {
        expect(result.current.coreConfig).toBeDefined();
      });

      expect(result.current.coreConfig).toEqual(mockCoreConfig);

      // Check merged features
      expect(result.current.isFeatureEnabled('tasks')).toBe(true);
      expect(result.current.isFeatureEnabled('okr')).toBe(true);
    });
  });

  describe('Theme Variable Injection', () => {
    it('should inject CSS variables for theme', async () => {
      const mockSetProperty = vi.fn();
      document.documentElement.style.setProperty = mockSetProperty;

      renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--primary-color',
          '#3B82F6'
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--background-color',
          '#1F2937'
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--text-color',
          '#F3F4F6'
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--accent-color',
          '#10B981'
        );
      });
    });

    it('should update CSS variables when theme changes', async () => {
      const mockSetProperty = vi.fn();
      document.documentElement.style.setProperty = mockSetProperty;

      const { result, rerender } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      // Update theme
      const updatedConfig = {
        ...mockInstanceConfig,
        theme: {
          primaryColor: '#FF0000',
          backgroundColor: '#000000'
        }
      };

      // Create new wrapper with updated config
      const UpdatedWrapper = ({ children }: { children: ReactNode }) => (
        <InstanceProvider config={updatedConfig}>{children}</InstanceProvider>
      );

      rerender({ wrapper: UpdatedWrapper });

      await waitFor(() => {
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--primary-color',
          '#FF0000'
        );
        expect(mockSetProperty).toHaveBeenCalledWith(
          '--background-color',
          '#000000'
        );
      });
    });
  });

  describe('Feature Flag Management', () => {
    it('should check feature flags correctly', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      // Wait for Core config to load
      await waitFor(() => {
        expect(result.current.coreConfig).toBeDefined();
      });

      // Core features
      expect(result.current.isFeatureEnabled('tasks')).toBe(true);
      expect(result.current.isFeatureEnabled('brain')).toBe(true);
      expect(result.current.isFeatureEnabled('nonexistent')).toBe(false);

      // Instance features
      expect(result.current.getFeatureFlag('advancedMode')).toBe(true);
      expect(result.current.getFeatureFlag('experimentalFeatures')).toBe(false);
    });

    it('should handle feature flag updates', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      expect(result.current.getFeatureFlag('advancedMode')).toBe(true);

      // Update feature flag
      act(() => {
        result.current.updateFeatureFlag('advancedMode', false);
      });

      await waitFor(() => {
        expect(result.current.getFeatureFlag('advancedMode')).toBe(false);
      });
    });
  });

  describe('Dynamic Core Config Loading', () => {
    it('should load Core config dynamically', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoadingCore).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingCore).toBe(false);
        expect(result.current.coreConfig).toEqual(mockCoreConfig);
      });
    });

    it('should handle Core config loading errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchMock = mockFetch([
        {
          url: '/api/core/config',
          response: { error: 'Failed to load config' },
          status: 500
        }
      ]);

      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoadingCore).toBe(false);
        expect(result.current.coreConfig).toBeNull();
        expect(result.current.error).toBeDefined();
      });

      consoleError.mockRestore();
    });
  });

  describe('Instance Switching', () => {
    it('should switch between instances', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      expect(result.current.config.id).toBe('instance-1');

      const newInstanceConfig = {
        id: 'instance-2',
        name: 'Second Instance',
        theme: {},
        features: {}
      };

      // Switch instance
      act(() => {
        result.current.switchInstance(newInstanceConfig);
      });

      await waitFor(() => {
        expect(result.current.config.id).toBe('instance-2');
        expect(result.current.config.name).toBe('Second Instance');
      });
    });

    it('should persist instance selection', async () => {
      const mockSetItem = vi.fn();
      Storage.prototype.setItem = mockSetItem;

      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper()
      });

      const newInstance = {
        id: 'instance-2',
        name: 'Persisted Instance',
        theme: {},
        features: {}
      };

      act(() => {
        result.current.switchInstance(newInstance);
      });

      await waitFor(() => {
        expect(mockSetItem).toHaveBeenCalledWith(
          'selected_instance',
          JSON.stringify(newInstance)
        );
      });
    });
  });

  describe('Default Instance Handling', () => {
    it('should use default instance when none provided', async () => {
      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper(undefined)
      });

      expect(result.current.config.id).toBe('default');
      expect(result.current.config.name).toBe('Default Instance');
    });

    it('should restore saved instance from localStorage', async () => {
      const savedInstance = {
        id: 'saved-instance',
        name: 'Saved Instance',
        theme: { primaryColor: '#00FF00' },
        features: { saved: true }
      };

      Storage.prototype.getItem = vi.fn(() => JSON.stringify(savedInstance));

      const { result } = renderHook(() => useInstance(), {
        wrapper: createWrapper(undefined)
      });

      await waitFor(() => {
        expect(result.current.config.id).toBe('saved-instance');
        expect(result.current.config.name).toBe('Saved Instance');
      });
    });
  });
});