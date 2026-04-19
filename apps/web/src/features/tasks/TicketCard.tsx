import { forwardRef, type HTMLAttributes, type MouseEvent, type PointerEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUserDetail } from '../../hooks/useUserDetail';
import type { Ticket, TicketAssignee } from './types';
import { PRIORITY_COLORS } from './types';

const AVATAR_PALETTES = [
  { bg: 'var(--avatar-1-bg)', text: 'var(--avatar-1-text)' },
  { bg: 'var(--avatar-2-bg)', text: 'var(--avatar-2-text)' },
  { bg: 'var(--avatar-3-bg)', text: 'var(--avatar-3-text)' },
  { bg: 'var(--avatar-4-bg)', text: 'var(--avatar-4-text)' },
  { bg: 'var(--avatar-5-bg)', text: 'var(--avatar-5-text)' },
  { bg: 'var(--avatar-6-bg)', text: 'var(--avatar-6-text)' },
];

const paletteFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]!;
};

function AvatarStack({ assignees, interactive = false }: { assignees: TicketAssignee[]; interactive?: boolean }) {
  // Hook is always called, but openUser is only used when interactive
  const { openUser } = useUserDetail();

  const stopDrag = (e: PointerEvent<HTMLButtonElement>) => {
    // Prevent dnd-kit's PointerSensor from treating this as a drag start
    e.stopPropagation();
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>, userId: string) => {
    e.stopPropagation();
    openUser(userId);
  };

  return (
    <div className="flex -space-x-1.5">
      {assignees.map((a) => {
        const palette = paletteFor(a.user.id);
        const className =
          'flex h-7 w-7 items-center justify-center rounded-full text-[11px] ring-2 ring-surface-primary';
        if (!interactive) {
          return (
            <span
              key={a.user.id}
              title={a.user.name}
              className={className}
              style={{ background: palette.bg, color: palette.text }}
            >
              {a.user.initials}
            </span>
          );
        }
        return (
          <button
            key={a.user.id}
            type="button"
            title={`View ${a.user.name}`}
            aria-label={`View ${a.user.name}`}
            onClick={(e) => handleClick(e, a.user.id)}
            onPointerDown={stopDrag}
            onMouseDown={(e) => e.stopPropagation()}
            className={`${className} cursor-pointer transition-transform duration-fast hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110`}
            style={{ background: palette.bg, color: palette.text }}
          >
            {a.user.initials}
          </button>
        );
      })}
    </div>
  );
}

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
          <span
            title={ticket.priority.toLowerCase()}
            className={`inline-block h-[7px] w-[7px] rounded-full ${PRIORITY_COLORS[ticket.priority]}`}
          />
        </div>
        <p className="mb-3 text-base text-text-primary">{ticket.title}</p>
        {ticket.assignees.length > 0 && (
          <div className="flex items-center justify-between">
            <AvatarStack assignees={ticket.assignees} interactive={!dragging} />
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

export function TicketCard({ ticket }: { ticket: Ticket }) {
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
      {...attributes}
      {...listeners}
    />
  );
}
