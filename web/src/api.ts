import type { FeedResponse, SessionInfo } from './types.ts';

export class AuthError extends Error {
  constructor() {
    super('unauthenticated');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) throw new AuthError();

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getSession(): Promise<SessionInfo> {
  return request<SessionInfo>('/api/session');
}

export function startLogin(handle: string): Promise<{ redirectUrl: string }> {
  return request<{ redirectUrl: string }>('/api/oauth/login', {
    method: 'POST',
    body: JSON.stringify({ handle }),
  });
}

export function logout(): Promise<void> {
  return request<void>('/api/logout', { method: 'POST' });
}

export function getFeed(url: string, cursor?: string): Promise<FeedResponse> {
  const params = new URLSearchParams({ url });
  if (cursor) params.set('cursor', cursor);
  return request<FeedResponse>(`/api/feed?${params.toString()}`);
}
