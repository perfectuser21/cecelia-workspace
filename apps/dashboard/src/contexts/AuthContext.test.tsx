/**
 * Tests for AuthContext
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import {
  mockLocalStorage,
  mockFetch,
  createMockUser,
  TestErrorBoundary
} from '../test/utils/test-helpers';

// Wrapper component for testing
const createWrapper = () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return wrapper;
};

describe('AuthContext', () => {
  let localStorageMock: ReturnType<typeof mockLocalStorage>;
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    // Reset mocks before each test
    localStorageMock = mockLocalStorage();
    fetchMock = mockFetch([
      {
        url: '/api/auth/login',
        response: {
          success: true,
          token: 'test-token-123',
          user: createMockUser({ username: 'admin', role: 'admin' })
        }
      },
      {
        url: '/api/auth/refresh',
        response: {
          success: true,
          token: 'refreshed-token-456',
          user: createMockUser({ username: 'admin', role: 'admin' })
        }
      },
      {
        url: '/api/auth/logout',
        response: { success: true }
      },
      {
        url: '/api/auth/verify',
        response: {
          success: true,
          user: createMockUser({ username: 'admin', role: 'admin' })
        }
      }
    ]);
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuperAdmin).toBe(false);
    });

    it('should throw error when used outside of AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponent = () => {
        useAuth();
        return null;
      };

      expect(() => {
        const { result } = renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('Login Flow', () => {
    it('should handle successful login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.login('admin', 'password');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(
          expect.objectContaining({
            username: 'admin',
            role: 'admin'
          })
        );
        expect(result.current.token).toBe('test-token-123');
      });

      // Verify localStorage was updated
      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'auth_token',
        'test-token-123'
      );
      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(createMockUser({ username: 'admin', role: 'admin' }))
      );
    });

    it('should handle failed login', async () => {
      fetchMock = mockFetch([
        {
          url: '/api/auth/login',
          response: { error: 'Invalid credentials' },
          status: 401
        }
      ]);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      await expect(
        act(async () => {
          await result.current.login('admin', 'wrong-password');
        })
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  describe('Logout Flow', () => {
    it('should clear auth state on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      // First login
      await act(async () => {
        await result.current.login('admin', 'password');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.token).toBeNull();
      });

      // Verify localStorage was cleared
      expect(localStorageMock.mock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.mock.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      // Set initial token
      await act(async () => {
        await result.current.login('admin', 'password');
      });

      expect(result.current.token).toBe('test-token-123');

      // Refresh token
      await act(async () => {
        await result.current.refreshToken();
      });

      await waitFor(() => {
        expect(result.current.token).toBe('refreshed-token-456');
      });

      // Verify localStorage was updated
      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'auth_token',
        'refreshed-token-456'
      );
    });

    it('should handle token refresh failure', async () => {
      fetchMock = mockFetch([
        {
          url: '/api/auth/login',
          response: {
            success: true,
            token: 'test-token-123',
            user: createMockUser()
          }
        },
        {
          url: '/api/auth/refresh',
          response: { error: 'Token expired' },
          status: 401
        }
      ]);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      // Set initial token
      await act(async () => {
        await result.current.login('admin', 'password');
      });

      // Try to refresh token
      await expect(
        act(async () => {
          await result.current.refreshToken();
        })
      ).rejects.toThrow();

      // Should logout user on refresh failure
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.token).toBeNull();
      });
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions correctly for admin', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.login('admin', 'password');
      });

      await waitFor(() => {
        expect(result.current.hasPermission('admin')).toBe(true);
        expect(result.current.hasPermission('user')).toBe(true);
        expect(result.current.isSuperAdmin).toBe(true);
      });
    });

    it('should check permissions correctly for regular user', async () => {
      fetchMock = mockFetch([
        {
          url: '/api/auth/login',
          response: {
            success: true,
            token: 'test-token-123',
            user: createMockUser({ username: 'user', role: 'user' })
          }
        }
      ]);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.login('user', 'password');
      });

      await waitFor(() => {
        expect(result.current.hasPermission('admin')).toBe(false);
        expect(result.current.hasPermission('user')).toBe(true);
        expect(result.current.isSuperAdmin).toBe(false);
      });
    });
  });

  describe('Session Expiry', () => {
    it('should handle session expiry gracefully', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      // Login
      await act(async () => {
        await result.current.login('admin', 'password');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Mock session expiry check
      fetchMock = mockFetch([
        {
          url: '/api/auth/verify',
          response: { error: 'Session expired' },
          status: 401
        }
      ]);

      // Fast forward time to trigger session check
      await act(async () => {
        vi.advanceTimersByTime(1000 * 60 * 30); // 30 minutes
      });

      // Should detect expired session
      await act(async () => {
        await result.current.verifySession();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });

      vi.useRealTimers();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should handle auth errors within error boundary', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingComponent = () => {
        const auth = useAuth();
        throw new Error('Auth error');
      };

      const TestComponent = () => (
        <TestErrorBoundary>
          <AuthProvider>
            <ThrowingComponent />
          </AuthProvider>
        </TestErrorBoundary>
      );

      const { container } = renderHook(() => null, {
        wrapper: TestComponent
      });

      expect(container.textContent).toContain('Error occurred');

      consoleError.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should manage loading states during async operations', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoading).toBe(false);

      // Start login
      const loginPromise = act(async () => {
        await result.current.login('admin', 'password');
      });

      // Check loading state immediately
      expect(result.current.isLoading).toBe(true);

      await loginPromise;

      // Loading should be false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});