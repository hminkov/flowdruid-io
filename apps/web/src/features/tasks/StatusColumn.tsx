import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TicketCard } from './TicketCard';
import { SearchIcon, SpinnerIcon } from '../../components/icons';
import { STATUS_LABELS, type Ticket, type TicketStatus } from './types';

// Kept in sync with the server-side caps in tickets.list. When a
// column reaches this many rows the UI shows an expand button.
const OPEN_CAP = 15;
const DONE_CAP = 15;

function StatusColumnInner({
  status,
  tickets,
  onOpenTicket,
  onLoadMore,
  loadingMore,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  onOpenTicket?: (t: Ticket) => void;
  onLoadMore?: (status: TicketStatus) => void;
  loadingMore?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cap = status === 'DONE' ? DONE_CAP : OPEN_CAP;
  const atCap = tickets.length >= cap;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors duration-fast ${
        isOver ? 'border-brand-500 border-dashed bg-brand-50' : 'border-border bg-surface-secondary'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm text-text-secondary">{STATUS_LABELS[status]}</h3>
        <span
          title={atCap ? `Showing the most recent ${cap} — use search to find older ones` : undefined}
          className={`rounded-pill px-2 py-0.5 text-xs ${
            atCap
              ? 'bg-warning-bg text-warning-text'
              : 'bg-surface-primary text-text-tertiary'
          }`}
        >
          {tickets.length}{atCap ? '+' : ''}
        </span>
      </div>

      <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} onOpen={onOpenTicket} />
          ))}
          {tickets.length === 0 && (
            <div className="flex h-16 items-center justify-center rounded border border-dashed border-border text-xs text-text-tertiary">
              Drop here
            </div>
          )}
        </div>
      </SortableContext>

      {atCap && onLoadMore && (
        <button
          type="button"
          onClick={() => onLoadMore(status)}
          disabled={loadingMore}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-border bg-surface-primary px-2 py-1.5 text-xs text-text-secondary transition-colors duration-fast hover:border-border-strong hover:text-text-primary disabled:opacity-60"
        >
          {loadingMore ? (
            <SpinnerIcon className="h-3.5 w-3.5" />
          ) : (
            <SearchIcon className="h-3.5 w-3.5" />
          )}
          {loadingMore ? 'Loading…' : 'See older work items'}
        </button>
      )}
    </div>
  );
}

/**
 * Memoised so column re-renders only when its own ticket list changes.
 * Without this, any drag event or filter toggle re-renders every column
 * — and every ticket card inside each column — which is the difference
 * between a board that feels instant and one that janks visibly.
 */
export const StatusColumn = memo(StatusColumnInner, (prev, next) => {
  if (prev.status !== next.status) return false;
  if (prev.onOpenTicket !== next.onOpenTicket) return false;
  if (prev.onLoadMore !== next.onLoadMore) return false;
  if (prev.loadingMore !== next.loadingMore) return false;
  if (prev.tickets === next.tickets) return true;
  if (prev.tickets.length !== next.tickets.length) return false;
  for (let i = 0; i < prev.tickets.length; i++) {
    const a = prev.tickets[i]!;
    const b = next.tickets[i]!;
    if (a.id !== b.id || a.status !== b.status || a.priority !== b.priority || a.title !== b.title) {
      return false;
    }
  }
  return true;
});
