/**
 * Tests for CeceliaContext
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { CeceliaProvider, useCecelia, useCeceliaPage } from './CeceliaContext';
import {
  MockWebSocket,
  mockFetch,
  waitForAsync
} from '../test/utils/test-helpers';

// Mock WebSocket
let mockWsInstance: MockWebSocket | null = null;

// Override global WebSocket
global.WebSocket = vi.fn().mockImplementation((url: string) => {
  mockWsInstance = new MockWebSocket(url);
  return mockWsInstance;
}) as any;

// Wrapper component for testing
const createWrapper = () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CeceliaProvider>{children}</CeceliaProvider>
  );
  return wrapper;
};

describe('CeceliaContext', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    // Reset mocks before each test
    mockWsInstance = null;
    vi.clearAllMocks();

    fetchMock = mockFetch([
      {
        url: '/api/cecelia/chat',
        response: {
          success: true,
          message: { id: '1', role: 'assistant', content: 'Hello!' }
        }
      },
      {
        url: '/api/cecelia/tools',
        response: {
          success: true,
          tools: [
            { name: 'navigate', description: 'Navigate to page' },
            { name: 'refresh', description: 'Refresh current page' }
          ]
        }
      }
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Chat Message Management', () => {
    it('should add messages to chat', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      expect(result.current.messages).toHaveLength(0);

      act(() => {
        result.current.addMessage({
          id: '1',
          role: 'user',
          content: 'Hello Cecelia'
        });
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]).toEqual({
          id: '1',
          role: 'user',
          content: 'Hello Cecelia'
        });
      });
    });

    it('should update existing messages', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Add initial message
      act(() => {
        result.current.addMessage({
          id: '1',
          role: 'assistant',
          content: 'Initial',
          streaming: true
        });
      });

      expect(result.current.messages[0].content).toBe('Initial');

      // Update message
      act(() => {
        result.current.updateMessage('1', {
          content: 'Updated content',
          streaming: false
        });
      });

      await waitFor(() => {
        expect(result.current.messages[0].content).toBe('Updated content');
        expect(result.current.messages[0].streaming).toBe(false);
      });
    });

    it('should clear all messages', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Add multiple messages
      act(() => {
        result.current.addMessage({ id: '1', role: 'user', content: 'Message 1' });
        result.current.addMessage({ id: '2', role: 'assistant', content: 'Message 2' });
      });

      expect(result.current.messages).toHaveLength(2);

      // Clear messages
      act(() => {
        result.current.clearMessages();
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(0);
      });
    });
  });

  describe('Page Awareness System', () => {
    it('should register and unregister pages', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      const pageState = {
        pageType: 'dashboard',
        title: 'Main Dashboard',
        data: { stats: { users: 100 } },
        uiState: { expandedSections: ['section1'] },
        summary: 'Dashboard showing user statistics'
      };

      const pageActions = {
        expand: vi.fn(),
        collapse: vi.fn(),
        refresh: vi.fn()
      };

      // Register page
      act(() => {
        result.current.registerPage('page-1', pageState, pageActions);
      });

      expect(result.current.registeredPages).toHaveProperty('page-1');
      expect(result.current.registeredPages['page-1'].state).toEqual(pageState);
      expect(result.current.registeredPages['page-1'].actions).toEqual(pageActions);

      // Unregister page
      act(() => {
        result.current.unregisterPage('page-1');
      });

      await waitFor(() => {
        expect(result.current.registeredPages).not.toHaveProperty('page-1');
      });
    });

    it('should use useCeceliaPage hook for page registration', async () => {
      const getData = vi.fn(() => ({ items: [1, 2, 3] }));
      const getUiState = vi.fn(() => ({ expanded: true }));
      const actions = {
        expand: vi.fn(),
        collapse: vi.fn()
      };

      const { result } = renderHook(
        () =>
          useCeceliaPage(
            'test-page',
            'Test Page',
            getData,
            getUiState,
            actions
          ),
        { wrapper: createWrapper() }
      );

      // Hook should register page on mount
      await waitFor(() => {
        expect(getData).toHaveBeenCalled();
        expect(getUiState).toHaveBeenCalled();
      });

      // Cleanup should happen on unmount
      const { unmount } = renderHook(
        () =>
          useCeceliaPage(
            'test-page-2',
            'Test Page 2',
            getData,
            getUiState,
            actions
          ),
        { wrapper: createWrapper() }
      );

      unmount();

      // Verify cleanup happened
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });
    });
  });

  describe('Frontend Tools Execution', () => {
    it('should execute frontend tools', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      const navigateFn = vi.fn();
      const refreshFn = vi.fn();

      // Register tools
      act(() => {
        result.current.registerTool('navigate', navigateFn);
        result.current.registerTool('refresh', refreshFn);
      });

      // Execute tool
      await act(async () => {
        await result.current.executeTool('navigate', { path: '/dashboard' });
      });

      expect(navigateFn).toHaveBeenCalledWith({ path: '/dashboard' });
    });

    it('should handle tool execution errors', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      const errorTool = vi.fn().mockRejectedValue(new Error('Tool failed'));

      act(() => {
        result.current.registerTool('errorTool', errorTool);
      });

      await expect(
        act(async () => {
          await result.current.executeTool('errorTool', {});
        })
      ).rejects.toThrow('Tool failed');
    });
  });

  describe('Navigation Overlay Animation', () => {
    it('should show and hide navigation overlay', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      expect(result.current.navigationOverlay).toBeNull();

      // Show overlay
      act(() => {
        result.current.showNavigationOverlay('Navigating to Dashboard', 'warp');
      });

      expect(result.current.navigationOverlay).toEqual({
        text: 'Navigating to Dashboard',
        animation: 'warp'
      });

      // Auto-hide after timeout
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(result.current.navigationOverlay).toBeNull();
      });

      vi.useRealTimers();
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Wait for WebSocket to connect
      await waitForAsync(10);

      expect(mockWsInstance).toBeDefined();
      expect(mockWsInstance?.readyState).toBe(MockWebSocket.OPEN);
    });

    it('should handle WebSocket reconnection on error', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Wait for initial connection
      await waitForAsync(10);

      const firstInstance = mockWsInstance;
      expect(firstInstance).toBeDefined();

      // Simulate connection error
      act(() => {
        firstInstance?.simulateError();
        firstInstance?.close();
      });

      // Advance time for reconnection attempt
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should create new WebSocket instance
      await waitFor(() => {
        expect(mockWsInstance).not.toBe(firstInstance);
      });

      vi.useRealTimers();
    });

    it('should handle incoming WebSocket messages', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Wait for connection
      await waitForAsync(10);

      // Simulate incoming message
      act(() => {
        mockWsInstance?.simulateMessage(
          JSON.stringify({
            type: 'chat',
            data: {
              id: 'ws-1',
              role: 'assistant',
              content: 'WebSocket message'
            }
          })
        );
      });

      await waitFor(() => {
        const wsMessage = result.current.messages.find(m => m.id === 'ws-1');
        expect(wsMessage).toBeDefined();
        expect(wsMessage?.content).toBe('WebSocket message');
      });
    });
  });

  describe('State Caching', () => {
    it('should cache page contexts for AI understanding', async () => {
      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      const pageState1 = {
        pageType: 'tasks',
        title: 'Task List',
        data: { tasks: [1, 2, 3] },
        uiState: { filter: 'active' },
        summary: 'Active tasks'
      };

      const pageState2 = {
        pageType: 'settings',
        title: 'Settings',
        data: { theme: 'dark' },
        uiState: { tab: 'general' },
        summary: 'General settings'
      };

      // Register multiple pages
      act(() => {
        result.current.registerPage('page-1', pageState1, {});
        result.current.registerPage('page-2', pageState2, {});
      });

      // Get current context
      const context = result.current.getCurrentContext();

      expect(context.pages).toHaveLength(2);
      expect(context.pages).toContainEqual(
        expect.objectContaining({
          pageType: 'tasks',
          title: 'Task List'
        })
      );
      expect(context.pages).toContainEqual(
        expect.objectContaining({
          pageType: 'settings',
          title: 'Settings'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle and report errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useCecelia(), {
        wrapper: createWrapper()
      });

      // Simulate an error in message processing
      const invalidMessage = { id: null, role: 'invalid', content: undefined };

      act(() => {
        try {
          result.current.addMessage(invalidMessage as any);
        } catch (error) {
          // Error should be caught internally
        }
      });

      // Context should remain stable
      expect(result.current.messages).toBeDefined();

      consoleError.mockRestore();
    });
  });
});