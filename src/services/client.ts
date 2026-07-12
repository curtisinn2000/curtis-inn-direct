const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';
const TOKEN_KEY = 'curtis_admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(options.headers);
  const isMultipartBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isMultipartBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const error = new Error(data?.error?.message ?? `Request failed: ${response.status}`) as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }

  return data as T;
}

export function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
  };
}
