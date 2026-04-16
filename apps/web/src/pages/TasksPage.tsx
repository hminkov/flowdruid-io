import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';

const statusColumns = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
const statusLabels: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};
const priorityDots: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-green-500',
};

export function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceFilter = searchParams.get('source') as 'INTERNAL' | 'JIRA' | null;
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const utils = trpc.useUtils();
  const ticketsQuery = trpc.tickets.list.useQuery({
    teamId: user?.teamId ?? undefined,
    source: sourceFilter ?? undefined,
  });
  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
    },
  });
  const updateMutation = trpc.tickets.update.useMutation({
    onSuccess: () => utils.tickets.list.invalidate(),
  });

  const setSource = (s: string | null) => {
    if (s) searchParams.set('source', s);
    else searchParams.delete('source');
    setSearchParams(searchParams);
  };

  const tickets = ticketsQuery.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          New Task
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex gap-2">
        {[null, 'JIRA', 'INTERNAL'].map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setSource(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              sourceFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {s ?? 'All'}
          </button>
        ))}
      </div>

      {/* Board columns */}
      <div className="grid grid-cols-4 gap-4">
        {statusColumns.map((status) => (
          <div key={status} className="rounded-lg bg-gray-100 p-3">
            <h3 className="mb-3 text-sm font-semibold text-gray-600">{statusLabels[status]}</h3>
            <div className="space-y-2">
              {tickets
                .filter((t) => t.status === status)
                .map((ticket) => (
                  <div key={ticket.id} className="rounded border bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                        ticket.source === 'JIRA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${priorityDots[ticket.priority]}`} />
                    </div>
                    <p className="mb-2 text-sm">{ticket.title}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-1">
                        {ticket.assignees.map((a) => (
                          <span
                            key={a.user.id}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[9px] font-medium text-primary-700 ring-1 ring-white"
                          >
                            {a.user.initials}
                          </span>
                        ))}
                      </div>
                      {status !== 'DONE' && (
                        <button
                          onClick={() => {
                            const nextStatus = statusColumns[statusColumns.indexOf(status) + 1];
                            if (nextStatus) {
                              updateMutation.mutate({ ticketId: ticket.id, status: nextStatus });
                            }
                          }}
                          className="text-xs text-primary-600 hover:text-primary-800"
                        >
                          Move &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Task</h2>
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
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
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
