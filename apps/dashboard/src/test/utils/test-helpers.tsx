/**
 * Test utility helpers for Context and Hook testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock localStorage
export const mockLocalStorage = () => {
  const store: { [key: string]: string } = {};

  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });

  return { store, mock: localStorageMock };
};

// Mock sessionStorage
export const mockSessionStorage = () => {
  const store: { [key: string]: string } = {};

  const sessionStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true
  });

  return { store, mock: sessionStorageMock };
};

// Mock WebSocket
export class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;

    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = vi.fn((data: string | ArrayBuffer | Blob) => {
    // Mock send
  });

  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  });

  // Helper method to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Helper method to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock fetch responses
export const mockFetch = (responses: Array<{ url: string | RegExp; response: any; status?: number }>) => {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const matchedResponse = responses.find(r => {
      if (typeof r.url === 'string') {
        return url.includes(r.url);
      }
      return r.url.test(url);
    });

    if (!matchedResponse) {
      return Promise.reject(new Error(`No mock found for ${url}`));
    }

    const status = matchedResponse.status || 200;
    const ok = status >= 200 && status < 300;

    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: async () => matchedResponse.response,
      text: async () => JSON.stringify(matchedResponse.response),
      headers: new Headers({
        'content-type': 'application/json'
      })
    } as Response;
  });

  global.fetch = fetchMock;
  return fetchMock;
};

// Create a custom render function with providers
export interface AllTheProvidersProps {
  children: React.ReactNode;
}

export const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  // Add any global providers here
  return <>{children}</>;
};

export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Async utilities
export const waitForAsync = (ms: number = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Mock system time
export const mockSystemTime = (date: Date | string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(date));
  return {
    restore: () => vi.useRealTimers(),
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers()
  };
};

// Mock matchMedia for theme detection
export const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Mock IntersectionObserver
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  });
  window.IntersectionObserver = mockIntersectionObserver as any;
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  });
  window.ResizeObserver = mockResizeObserver as any;
};

// Create mock API response
export function createMockApiResponse<T>(data: T, delay: number = 0): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  ...overrides
});

export const createMockTask = (overrides = {}) => ({
  id: '1',
  title: 'Test Task',
  description: 'Test Description',
  status: 'pending',
  priority: 'P1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

export const createMockGoal = (overrides = {}) => ({
  id: '1',
  title: 'Test Goal',
  description: 'Test Goal Description',
  status: 'active',
  progress: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Error boundary for testing
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Error occurred</div>;
    }

    return this.props.children;
  }
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';