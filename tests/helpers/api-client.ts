const DEFAULT_BASE_URL = process.env.TEST_API_URL || 'http://localhost:5220';

interface TestClientOptions {
  baseURL?: string;
}

interface TestClient {
  baseURL: string;
  get(path: string): Promise<Response>;
  post(path: string, body?: unknown): Promise<Response>;
  patch(path: string, body?: unknown): Promise<Response>;
  delete(path: string): Promise<Response>;
}

export function createTestClient(options?: TestClientOptions): TestClient {
  const baseURL = options?.baseURL || DEFAULT_BASE_URL;

  return {
    baseURL,
    get(path: string) {
      return fetch(`${baseURL}${path}`);
    },
    post(path: string, body?: unknown) {
      return fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    patch(path: string, body?: unknown) {
      return fetch(`${baseURL}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    delete(path: string) {
      return fetch(`${baseURL}${path}`, { method: 'DELETE' });
    },
  };
}
