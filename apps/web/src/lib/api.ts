import { API_URL } from './env';
import { useAuthStore } from '../store/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(`${status} ${code}`);
  }
}

interface FetchOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<string | null> | null = null;

export async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          useAuthStore.getState().clear();
        }
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      useAuthStore.getState().setTokens(data);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const doFetch = async (token: string | null): Promise<Response> => {
    if (auth && token) headers.authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let token = useAuthStore.getState().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && auth) {
    token = await tryRefresh();
    if (token) res = await doFetch(token);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const errCode =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'request_failed';
    throw new ApiError(res.status, errCode, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<FetchOpts, 'method'>) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
};
