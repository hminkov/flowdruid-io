/**
 * Real-time event envelopes.
 *
 * Server pushes these via Server-Sent Events on GET /api/events;
 * clients invalidate matching TanStack Query caches on receipt.
 * Events are deliberately small: they carry the id of the record
 * that changed, not the record itself — the client re-fetches via
 * the normal tRPC endpoint so auth and shaping stay consistent.
 *
 * The discriminated union is shared so FE + BE agree on wire shape.
 */
export type LiveEvent =
  | { type: 'notification.new'; id: string }
  | { type: 'notification.read'; id: string }
  | { type: 'message.new'; conversationId: string; messageId: string }
  | { type: 'ticket.updated'; id: string }
  | { type: 'leave.updated'; id: string }
  | { type: 'user.availability'; userId: string; availability: string };

export type LiveEventType = LiveEvent['type'];
