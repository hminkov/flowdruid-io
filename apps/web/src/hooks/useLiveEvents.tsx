import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LiveEvent } from '@flowdruid/shared';
import { useAuth } from './useAuth';
import { getAuthToken } from '../lib/trpc';

/**
 * Subscribes to the server's /api/events SSE stream whenever a user is
 * signed in, and invalidates TanStack Query caches so the UI re-fetches
 * on the next render. Keeps the existing 30-second polls as a safety
 * net — if EventSource fails (CORS, proxy, corporate firewall), the
 * app degrades to polling rather than going silent.
 *
 * Mount once at the app root, inside the QueryClientProvider + AuthProvider.
 */
export function useLiveEvents(): void {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    const base = import.meta.env.VITE_API_URL || '';
    // EventSource can't send an Authorization header, so the access
    // token rides in the query string. Access tokens are short-lived
    // (15 min) so exposure is bounded; production should strip query
    // strings from access logs on this route.
    const url = `${base}/api/events?token=${encodeURIComponent(token)}`;
    const src = new EventSource(url, { withCredentials: true });

    src.addEventListener('message', (e) => {
      let evt: LiveEvent;
      try {
        evt = JSON.parse(e.data) as LiveEvent;
      } catch {
        return;
      }
      switch (evt.type) {
        case 'notification.new':
        case 'notification.read':
          queryClient.invalidateQueries({ queryKey: [['notifications']] });
          break;
        case 'message.new':
          queryClient.invalidateQueries({ queryKey: [['messages']] });
          queryClient.invalidateQueries({ queryKey: [['notifications']] });
          break;
        case 'ticket.updated':
          queryClient.invalidateQueries({ queryKey: [['tickets']] });
          break;
        case 'leave.updated':
          queryClient.invalidateQueries({ queryKey: [['leaves']] });
          queryClient.invalidateQueries({ queryKey: [['notifications']] });
          break;
        case 'user.availability':
          queryClient.invalidateQueries({ queryKey: [['teams']] });
          break;
      }
    });

    src.addEventListener('error', () => {
      // The browser's EventSource auto-reconnects with a built-in
      // backoff. Nothing to do here other than let it.
    });

    return () => {
      src.close();
    };
  }, [user, queryClient]);
}

/**
 * Wrapper component — same effect as calling the hook, lets the app
 * compose providers without turning App into a function that needs
 * to be called post-auth.
 */
export function LiveEventsBridge() {
  useLiveEvents();
  return null;
}
