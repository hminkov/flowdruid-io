import { forwardRef, memo, type HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUserDetail } from '../../hooks/useUserDetail';
import { AvatarStack, PriorityDot } from '../../components/ui';
import type { Ticket } from './types';

type DisplayProps = HTMLAttributes<HTMLDivElement> & {
  ticket: Ticket;
  dragging?: boolean;
};

export const TicketCardDisplay = forwardRef<HTMLDivElement, DisplayProps>(
  function TicketCardDisplay({ ticket, dragging, className = '', ...rest }, ref) {
    return (
      <div
        ref={ref}
        {...rest}
        className={`rounded border bg-surface-primary p-3 ${
          dragging ? 'border-brand-500 shadow-float' : 'border-border'
        } ${className}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded px-1 py-0.5 font-mono text-xs ${
              ticket.source === 'JIRA'
                ? 'bg-info-bg text-info-text'
                : 'bg-neutral-bg text-neutral-text'
            }`}
          >
            {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
          </span>
          <PriorityDot priority={ticket.priority} />
        </div>
        <p className="mb-3 text-base text-text-primary">{ticket.title}</p>
        {ticket.assignees.length > 0 && (
          <div className="flex items-center justify-between">
            <AvatarStackForCard assignees={ticket.assignees} interactive={!dragging} />
            {ticket.assignees.length > 1 && (
              <span className="text-xs text-text-tertiary">
                {ticket.assignees.length} assignees
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

function AvatarStackForCard({
  assignees,
  interactive,
}: {
  assignees: Ticket['assignees'];
  interactive: boolean;
}) {
  const { openUser } = useUserDetail();
  const users = assignees.map((a) => a.user);
  return <AvatarStack users={users} size={28} onClickUser={interactive ? openUser : undefined} />;
}

function TicketCardInner({
  ticket,
  onOpen,
}: {
  ticket: Ticket;
  onOpen?: (t: Ticket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TicketCardDisplay
      ref={setNodeRef}
      style={style}
      ticket={ticket}
      dragging={isDragging}
      className="cursor-grab active:cursor-grabbing"
      onClick={() => {
        if (!isDragging) onOpen?.(ticket);
      }}
      {...attributes}
      {...listeners}
    />
  );
}

/**
 * Memoised so card re-renders only when the ticket shape actually changes.
 * Dragging/pointer events in dnd-kit would otherwise force a re-render of
 * every card in the same column on every mousemove.
 */
export const TicketCard = memo(TicketCardInner, (prev, next) => {
  if (prev.onOpen !== next.onOpen) return false;
  const a = prev.ticket;
  const b = next.ticket;
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (a.status !== b.status) return false;
  if (a.priority !== b.priority) return false;
  if (a.title !== b.title) return false;
  if (a.source !== b.source) return false;
  if ((a.jiraKey ?? null) !== (b.jiraKey ?? null)) return false;
  if (a.assignees.length !== b.assignees.length) return false;
  for (let i = 0; i < a.assignees.length; i++) {
    if (a.assignees[i]!.user.id !== b.assignees[i]!.user.id) return false;
  }
  return true;
});
