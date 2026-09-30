import { getToken } from './auth';
import { USE_DEMO_DATA } from './data-source';
import { demoRequest } from './demo-data';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown };

/** Fetch wrapper: adds the JWT, JSON-encodes `json`, unwraps `{ error }` responses. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  if (USE_DEMO_DATA) return demoRequest<T>(path, init);

  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText || 'Request failed';
    let details: unknown;
    try {
      const data = await res.json();
      message = data?.error?.message ?? message;
      details = data?.error?.details;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** SWR fetcher: keys are API paths, e.g. useSWR('/troughs'). */
export const fetcher = <T,>(path: string) => api<T>(path);

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
};
