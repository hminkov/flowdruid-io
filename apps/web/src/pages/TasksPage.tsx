import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { TaskBoard } from '../features/tasks/TaskBoard';
import type { Ticket } from '../features/tasks/types';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

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

  const setSource = (s: string | null) => {
    if (s) searchParams.set('source', s);
    else searchParams.delete('source');
    setSearchParams(searchParams);
  };

  const tickets = (ticketsQuery.data ?? []) as Ticket[];

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

      <TaskBoard tickets={tickets} listArgs={listArgs} />

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
