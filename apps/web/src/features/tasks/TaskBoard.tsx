import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { StatusColumn } from './StatusColumn';
import { TicketCardDisplay } from './TicketCard';
import {
  INTERNAL_ALLOWED_STATUSES,
  STATUS_COLUMNS,
  STATUS_LABELS,
  isStatusAllowed,
  type Ticket,
  type TicketStatus,
} from './types';
import { useUpdateTicketStatus } from './useUpdateTicketStatus';
import { useToast } from '../../components/ui';

// Kanban collision detection: always resolve to a column, never to
// an individual card in a different column. Corner-based detectors
// compete card-vs-column by raw pixel distance, which biases toward
// whichever column has more cards reaching toward the pointer — the
// reason dropping near IN_REVIEW / DONE boundary was landing in DONE.
//
// Strategy: pointerWithin first (exact containment — the pointer is
// literally inside this column). Fall back to rectIntersection against
// columns only, ignoring card droppables entirely for container
// resolution.
function makeColumnFirstDetection(): CollisionDetection {
  return (args) => {
    const columnContainers = args.droppableContainers.filter((c) =>
      (STATUS_COLUMNS as readonly string[]).includes(String(c.id)),
    );

    const pointerHits = pointerWithin({ ...args, droppableContainers: columnContainers });
    if (pointerHits.length > 0) return pointerHits;

    const rectHits = rectIntersection({ ...args, droppableContainers: columnContainers });
    return rectHits;
  };
}

// Lazy-load the detail modal — not needed until the user clicks a card.
const TicketDetailModal = lazy(() =>
  import('./TicketDetailModal').then((m) => ({ default: m.TicketDetailModal }))
);

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
  /** Fired when a column hits its cap and the user clicks 'See older'. */
  onLoadMore?: (status: TicketStatus) => void;
  /** Which column (if any) is currently loading more. Drives the spinner. */
  loadingMoreStatus?: TicketStatus | null;
};

export function TaskBoard({ tickets, listArgs, initialOpenId, onLoadMore, loadingMoreStatus }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [, setSearchParams] = useSearchParams();
  const toast = useToast();

  // Internal tickets use only the canonical 4 statuses. Collapse the
  // board to that set when the user has filtered to Internal only;
  // in All / Jira views show every column so Jira-native columns
  // (BLOCKED, READY_FOR_VERIFICATION) remain visible.
  const visibleColumns: readonly TicketStatus[] =
    listArgs.source === 'INTERNAL' ? INTERNAL_ALLOWED_STATUSES : STATUS_COLUMNS;

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
      BLOCKED: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      READY_FOR_VERIFICATION: [],
      DONE: [],
    };
    for (const t of tickets) map[t.status].push(t);
    return map;
  }, [tickets]);

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  // Columns that reject the currently-dragged ticket. Drives the red
  // outline on the column + the toast when the user releases over one.
  const forbiddenStatuses = useMemo(() => {
    if (!activeTicket) return new Set<TicketStatus>();
    if (activeTicket.source === 'JIRA') return new Set<TicketStatus>();
    return new Set<TicketStatus>(
      STATUS_COLUMNS.filter((s) => !isStatusAllowed('INTERNAL', s)),
    );
  }, [activeTicket]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // useMemo so the detector identity stays stable across renders.
  const collisionDetection = useMemo(() => makeColumnFirstDetection(), []);

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

    // Internal tickets can't live in Jira-only columns. Short-circuit
    // before the mutation fires so optimistic update doesn't flicker.
    if (!isStatusAllowed(current.source, destination)) {
      toast.push({
        kind: 'error',
        title: 'Column not available',
        message: `Internal tickets don't use "${STATUS_LABELS[destination]}". Only Jira tickets do.`,
      });
      return;
    }

    updateStatus.mutate({ ticketId, status: destination });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Horizontal-scroll kanban so all columns sit on one row —
          matches the Jira-native layout. Each column has a fixed
          minWidth so cards stay readable; the row scrolls sideways
          when the viewport can't fit every column.  */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {visibleColumns.map((status) => (
          <div key={status} className="min-w-[18rem] flex-1">
            <StatusColumn
              status={status}
              tickets={byStatus[status]}
              onOpenTicket={setOpenTicket}
              onLoadMore={onLoadMore}
              loadingMore={loadingMoreStatus === status}
              forbidden={forbiddenStatuses.has(status)}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? <TicketCardDisplay ticket={activeTicket} dragging /> : null}
      </DragOverlay>

      {currentOpen && (
        <Suspense fallback={null}>
          <TicketDetailModal
            ticket={currentOpen}
            onClose={() => {
              setOpenTicket(null);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('open');
                return next;
              }, { replace: true });
            }}
          />
        </Suspense>
      )}
    </DndContext>
  );
}

function resolveStatus(overId: string, tickets: Ticket[]): TicketStatus | undefined {
  if ((STATUS_COLUMNS as readonly string[]).includes(overId)) {
    return overId as TicketStatus;
  }
  return tickets.find((t) => t.id === overId)?.status;
}
