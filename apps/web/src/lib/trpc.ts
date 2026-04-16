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

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL || ''}/trpc`,
        transformer: superjson,
        headers() {
          const token = getAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
      }),
    ],
  });
}
