import { forwardRef, type HTMLAttributes } from 'react';
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

export function TicketCard({
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
