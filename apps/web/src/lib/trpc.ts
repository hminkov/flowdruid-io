import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function setAuthToken(token: string) {
  localStorage.setItem('accessToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('accessToken');
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// Coalesce concurrent 401s — if ten requests fail auth at once, we
// should only hit /auth.refresh once and have the others wait for it.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      // Batched tRPC POST. superjson serialises a null/undefined input
      // as `{"json":null}`; no meta wrapper is needed for that case.
      const res = await fetch(`${API_BASE}/trpc/auth.refresh?batch=1`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 0: { json: null } }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as Array<{
        result?: { data?: { json?: { accessToken?: string } } };
      }>;
      const accessToken = body[0]?.result?.data?.json?.accessToken ?? null;
      if (accessToken) setAuthToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      // Release the latch on next tick so late awaiters still see the result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

// Wrap fetch so every 401 response triggers a refresh + one retry
// before bubbling the failure up to the UI. Avoids infinite loops by
// only retrying once per original call.
async function fetchWithRefresh(
  url: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status !== 401) return res;

  // Don't recurse on the refresh call itself.
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.includes('/auth.refresh')) return res;

  const fresh = await refreshAccessToken();
  if (!fresh) {
    // Refresh failed — session is truly dead. Drop the stale token so
    // the UI's auth effect boots the user to login on next render.
    clearAuthToken();
    return res;
  }

  // Swap in the new token and replay the original request once.
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${fresh}`);
  return fetch(url, { ...options, headers, credentials: 'include' });
}

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_BASE}/trpc`,
        transformer: superjson,
        headers() {
          const token = getAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch: fetchWithRefresh,
      }),
    ],
  });
}
