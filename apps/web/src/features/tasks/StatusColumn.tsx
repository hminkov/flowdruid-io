import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TicketCard } from './TicketCard';
import { STATUS_LABELS, type Ticket, type TicketStatus } from './types';

function StatusColumnInner({
  status,
  tickets,
  onOpenTicket,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  onOpenTicket?: (t: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors duration-fast ${
        isOver ? 'border-brand-500 border-dashed bg-brand-50' : 'border-border bg-surface-secondary'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm text-text-secondary">{STATUS_LABELS[status]}</h3>
        <span className="rounded-pill bg-surface-primary px-2 py-0.5 text-xs text-text-tertiary">
          {tickets.length}
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
