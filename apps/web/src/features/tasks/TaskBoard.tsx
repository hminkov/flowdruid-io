import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { StatusColumn } from './StatusColumn';
import { TicketCardDisplay } from './TicketCard';
import { TicketDetailModal } from './TicketDetailModal';
import { STATUS_COLUMNS, STATUS_LABELS, type Ticket, type TicketStatus } from './types';
import { useUpdateTicketStatus } from './useUpdateTicketStatus';

type Props = {
  tickets: Ticket[];
  listArgs: {
    teamId?: string;
    source?: 'INTERNAL' | 'JIRA';
    status?: TicketStatus;
    assigneeId?: string;
  };
  /** When set on mount, auto-opens the ticket with this id (deep-link / shared URL). */
  initialOpenId?: string | null;
};

export function TaskBoard({ tickets, listArgs, initialOpenId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [, setSearchParams] = useSearchParams();

  // Auto-open from ?open=<id> exactly once, as soon as the ticket is in the loaded list.
  const hasAutoOpened = useState({ done: false })[0];
  useEffect(() => {
    if (hasAutoOpened.done) return;
    if (!initialOpenId) return;
    const t = tickets.find((x) => x.id === initialOpenId);
    if (t) {
      setOpenTicket(t);
      hasAutoOpened.done = true;
    }
  }, [initialOpenId, tickets, hasAutoOpened]);

  const updateStatus = useUpdateTicketStatus(listArgs);

  // Re-read the latest version of the open ticket after optimistic updates land
  const currentOpen = openTicket ? tickets.find((t) => t.id === openTicket.id) ?? null : null;

  // useMemo keeps the column grouping stable across re-renders triggered
  // by drag events — without this, every pointer move rebuilds the object.
  const byStatus = useMemo(() => {
    const map: Record<TicketStatus, Ticket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of tickets) map[t.status].push(t);
    return map;
  }, [tickets]);

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const t = tickets.find((x) => x.id === active.id);
      return t ? `Picked up ${t.title}. Current column: ${STATUS_LABELS[t.status]}.` : '';
    },
    onDragOver: ({ active, over }) => {
      if (!over) return '';
      const destStatus = resolveStatus(String(over.id), tickets);
      const t = tickets.find((x) => x.id === active.id);
      if (!t || !destStatus) return '';
      return `${t.title} is over ${STATUS_LABELS[destStatus]}.`;
    },
    onDragEnd: ({ active, over }) => {
      const t = tickets.find((x) => x.id === active.id);
      if (!over || !t) return 'Drag cancelled.';
      const destStatus = resolveStatus(String(over.id), tickets);
      if (!destStatus || destStatus === t.status) return 'Drag cancelled.';
      return `Moved ${t.title} to ${STATUS_LABELS[destStatus]}.`;
    },
    onDragCancel: ({ active }) => {
      const t = tickets.find((x) => x.id === active.id);
      return t ? `Dragging ${t.title} cancelled.` : 'Drag cancelled.';
    },
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = String(active.id);
    const current = tickets.find((t) => t.id === ticketId);
    if (!current) return;

    const destination = resolveStatus(String(over.id), tickets);
    if (!destination || destination === current.status) return;

    updateStatus.mutate({ ticketId, status: destination });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_COLUMNS.map((status) => (
          <StatusColumn
            key={status}
            status={status}
            tickets={byStatus[status]}
            onOpenTicket={setOpenTicket}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? <TicketCardDisplay ticket={activeTicket} dragging /> : null}
      </DragOverlay>

      <TicketDetailModal
        ticket={currentOpen}
        onClose={() => {
          setOpenTicket(null);
          // Also strip ?open= from the URL so a reload doesn't re-open it
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('open');
            return next;
          }, { replace: true });
        }}
      />
    </DndContext>
  );
}

function resolveStatus(overId: string, tickets: Ticket[]): TicketStatus | undefined {
  if ((STATUS_COLUMNS as readonly string[]).includes(overId)) {
    return overId as TicketStatus;
  }
  return tickets.find((t) => t.id === overId)?.status;
}
