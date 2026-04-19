import { trpc } from '../../lib/trpc';
import type { TicketStatus } from './types';

type ListArgs = {
  teamId?: string;
  source?: 'INTERNAL' | 'JIRA';
  status?: TicketStatus;
  assigneeId?: string;
};

/**
 * Optimistic status update for a ticket.
 *
 * Four lifecycle phases:
 *   1. onMutate   — cancel in-flight refetches, snapshot the cache, and
 *                   write the new status so the card moves instantly.
 *   2. onError    — restore the snapshot; optionally surface a toast so
 *                   the user knows the change was rejected.
 *   3. onSuccess  — nothing extra: the optimistic value was correct.
 *   4. onSettled  — invalidate the list so the server state replaces the
 *                   optimistic value (handles side-effects like reordering).
 */
export function useUpdateTicketStatus(listArgs: ListArgs) {
  const utils = trpc.useUtils();

  return trpc.tickets.update.useMutation({
    onMutate: async (input) => {
      await utils.tickets.list.cancel(listArgs);
      const previous = utils.tickets.list.getData(listArgs);
      if (input.status) {
        const nextStatus = input.status;
        utils.tickets.list.setData(listArgs, (old) => {
          if (!old) return old;
          return old.map((t) => (t.id === input.ticketId ? { ...t, status: nextStatus } : t));
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) utils.tickets.list.setData(listArgs, ctx.previous);
    },
    onSettled: () => {
      utils.tickets.list.invalidate(listArgs);
    },
  });
}

// ── Plain-fetch variant (kept for reference) ─────────────────────────────
// Use when you want to skip the tRPC client for this one hook and call
// the REST endpoint directly. Remember to replicate the four lifecycle
// phases above by hand (cancel queries, snapshot, write, rollback on
// error, invalidate on settled) using React Query's useMutation.
//
// import { useMutation, useQueryClient } from '@tanstack/react-query';
//
// export function useUpdateTicketStatus(listKey: unknown[]) {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (vars: { ticketId: string; status: TicketStatus }) =>
//       fetch(`/api/tickets/${vars.ticketId}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ status: vars.status }),
//       }).then((r) => {
//         if (!r.ok) throw new Error('update failed');
//         return r.json();
//       }),
//     onMutate: async (vars) => {
//       await qc.cancelQueries({ queryKey: listKey });
//       const previous = qc.getQueryData<Ticket[]>(listKey);
//       qc.setQueryData<Ticket[]>(listKey, (old) =>
//         old?.map((t) => (t.id === vars.ticketId ? { ...t, status: vars.status } : t)) ?? old
//       );
//       return { previous };
//     },
//     onError: (_e, _v, ctx) => {
//       if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
//     },
//     onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
//   });
// }
