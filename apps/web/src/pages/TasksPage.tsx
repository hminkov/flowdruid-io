import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';

type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const statusColumns: TicketStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const statusLabels: Record<TicketStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

const priorityDots: Record<Priority, string> = {
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};

type Ticket = {
  id: string;
  status: TicketStatus;
  priority: Priority;
  source: 'INTERNAL' | 'JIRA';
  jiraKey: string | null;
  title: string;
  assignees: { user: { id: string; initials: string; name: string } }[];
};

export function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceFilter = searchParams.get('source') as 'INTERNAL' | 'JIRA' | null;
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');

  const utils = trpc.useUtils();
  const listArgs = {
    teamId: user?.teamId ?? undefined,
    source: sourceFilter ?? undefined,
  };
  const ticketsQuery = trpc.tickets.list.useQuery(listArgs);

  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
    },
  });

  const updateMutation = trpc.tickets.update.useMutation({
    onMutate: async (input) => {
      await utils.tickets.list.cancel(listArgs);
      const previous = utils.tickets.list.getData(listArgs);
      utils.tickets.list.setData(listArgs, (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === input.ticketId && input.status ? { ...t, status: input.status } : t
        );
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) utils.tickets.list.setData(listArgs, ctx.previous);
    },
    onSettled: () => utils.tickets.list.invalidate(listArgs),
  });

  const setSource = (s: string | null) => {
    if (s) searchParams.set('source', s);
    else searchParams.delete('source');
    setSearchParams(searchParams);
  };

  const tickets = (ticketsQuery.data ?? []) as Ticket[];

  const byStatus = useMemo(() => {
    const map = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] } as Record<
      TicketStatus,
      Ticket[]
    >;
    for (const t of tickets) map[t.status].push(t);
    return map;
  }, [tickets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = String(active.id);
    const current = tickets.find((t) => t.id === ticketId);
    if (!current) return;

    const overId = String(over.id);
    let destination: TicketStatus | undefined;

    if ((statusColumns as readonly string[]).includes(overId)) {
      destination = overId as TicketStatus;
    } else {
      const overTicket = tickets.find((t) => t.id === overId);
      destination = overTicket?.status;
    }

    if (!destination || destination === current.status) return;

    updateMutation.mutate({ ticketId, status: destination });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>Tasks</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="min-h-input rounded bg-brand-600 px-3 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98]"
        >
          New task
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {([null, 'JIRA', 'INTERNAL'] as const).map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setSource(s)}
            className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
              sourceFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            {s ? (s === 'JIRA' ? 'Jira' : 'Internal') : 'All'}
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statusColumns.map((status) => (
            <Column
              key={status}
              status={status}
              label={statusLabels[status]}
              tickets={byStatus[status]}
            />
          ))}
        </div>
      </DndContext>

      {showCreate && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)]"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-modal rounded-lg bg-surface-primary p-5 shadow-float animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4">New task</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!user?.teamId) return;
                createMutation.mutate({ title, description, priority, teamId: user.teamId });
              }}
              className="space-y-3"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="min-h-input rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  status,
  label,
  tickets,
}: {
  status: TicketStatus;
  label: string;
  tickets: Ticket[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors duration-fast ${
        isOver ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface-secondary'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm text-text-secondary">{label}</h3>
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

function TicketCard({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded border bg-surface-primary p-3 active:cursor-grabbing ${
        isDragging ? 'border-brand-500 shadow-float' : 'border-border'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded px-1 py-0.5 font-mono text-xs ${
            ticket.source === 'JIRA' ? 'bg-info-bg text-info-text' : 'bg-neutral-bg text-neutral-text'
          }`}
        >
          {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
        </span>
        <span
          className={`inline-block h-[7px] w-[7px] rounded-full ${priorityDots[ticket.priority]}`}
          title={ticket.priority.toLowerCase()}
        />
      </div>
      <p className="mb-2 text-base text-text-primary">{ticket.title}</p>
      <div className="flex -space-x-1">
        {ticket.assignees.map((a) => (
          <span
            key={a.user.id}
            title={a.user.name}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)] ring-2 ring-surface-primary"
          >
            {a.user.initials}
          </span>
        ))}
      </div>
    </div>
  );
}
