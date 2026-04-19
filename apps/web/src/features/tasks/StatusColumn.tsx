import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TicketCard } from './TicketCard';
import { STATUS_LABELS, type Ticket, type TicketStatus } from './types';

export function StatusColumn({
  status,
  tickets,
}: {
  status: TicketStatus;
  tickets: Ticket[];
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
            <TicketCard key={t.id} ticket={t} />
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
