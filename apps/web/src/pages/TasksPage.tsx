import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { usePersistedState } from '../hooks/usePersistedState';
import { useToast } from '../components/ui';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { SearchIcon, XIcon, PlusIcon } from '../components/icons';
import type { Ticket } from '../features/tasks/types';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Source = 'JIRA' | 'INTERNAL';

const PRIORITY_CHIPS: readonly Priority[] = ['HIGH', 'MEDIUM', 'LOW'];
const PRIORITY_LABEL: Record<Priority, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export function TasksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Create-task modal state (local)
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<Priority>('MEDIUM');

  // Filters — URL-persisted so links are shareable
  const [sourceFilter, setSourceFilter] = usePersistedState('source', '');
  const [priorityFilter, setPriorityFilter] = usePersistedState('priority', '');
  const [assigneeFilter, setAssigneeFilter] = usePersistedState('assignee', '');
  const [mineOnly, setMineOnly] = usePersistedState('mine', '');
  const [unassignedOnly, setUnassignedOnly] = usePersistedState('unassigned', '');
  const [search, setSearch] = usePersistedState('q', '');
  // Admin-only team picker. Admins see all teams by default (empty =
  // whole org). Non-admins are always scoped to their own team.
  const [adminTeam, setAdminTeam] = usePersistedState('team', '');
  const isAdmin = user?.role === 'ADMIN';

  const utils = trpc.useUtils();

  // Admins: adminTeam (empty string = no team filter = whole org).
  // Non-admins: always pinned to their assigned team.
  const listArgs = {
    teamId: isAdmin ? (adminTeam || undefined) : (user?.teamId ?? undefined),
    source: (sourceFilter || undefined) as Source | undefined,
  };
  const ticketsQuery = trpc.tickets.list.useQuery(listArgs);
  const teamsQuery = trpc.teams.list.useQuery();

  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
      toast.push({ kind: 'success', title: 'Task created' });
    },
    onError: (e) => toast.push({ kind: 'error', title: 'Create failed', message: e.message }),
  });

  const allTickets = (ticketsQuery.data ?? []) as Ticket[];

  // Apply client-side filters
  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTickets.filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (mineOnly === '1') {
        if (!user || !t.assignees.some((a) => a.user.id === user.id)) return false;
      }
      if (unassignedOnly === '1') {
        if (t.assignees.length > 0) return false;
      }
      if (assigneeFilter) {
        if (!t.assignees.some((a) => a.user.id === assigneeFilter)) return false;
      }
      if (q) {
        const extended = t as Ticket & { description?: string | null };
        const hay =
          `${t.title} ${t.jiraKey ?? ''} ${extended.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTickets, priorityFilter, mineOnly, unassignedOnly, assigneeFilter, search, user]);

  const assigneeOptions = useMemo(() => {
    const teams = teamsQuery.data ?? [];
    return teams.flatMap((team) =>
      team.members.map((m) => ({
        id: m.id,
        name: m.name,
        team: team.name,
      }))
    );
  }, [teamsQuery.data]);

  const hasActiveFilters =
    !!sourceFilter ||
    !!priorityFilter ||
    !!assigneeFilter ||
    mineOnly === '1' ||
    unassignedOnly === '1' ||
    !!search ||
    (isAdmin && !!adminTeam);

  const clearAll = () => {
    setSourceFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setMineOnly('');
    setUnassignedOnly('');
    setSearch('');
    if (isAdmin) setAdminTeam('');
  };

  // Deep-link: ?open=<ticketId> auto-opens the modal on mount
  const openParam = searchParams.get('open');
  const [, setAutoOpened] = useState(false);

  useEffect(() => {
    // Clear the param after passing it down, so the URL stays clean once the user closes the modal
    // (handled by TaskBoard receiving initialOpenId)
    if (openParam) setAutoOpened(true);
  }, [openParam]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1>Tasks & tickets</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98]"
        >
          <PlusIcon className="h-4 w-4" />
          New task
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-surface-primary p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Source */}
          <div className="flex gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
            {[
              { v: '', label: 'All' },
              { v: 'JIRA', label: 'Jira' },
              { v: 'INTERNAL', label: 'Internal' },
            ].map((s) => (
              <button
                key={s.v || 'all'}
                onClick={() => setSourceFilter(s.v)}
                className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                  sourceFilter === s.v
                    ? 'bg-brand-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Priority */}
          <div className="flex gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
            <button
              onClick={() => setPriorityFilter('')}
              className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                !priorityFilter
                  ? 'bg-brand-600 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Any priority
            </button>
            {PRIORITY_CHIPS.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
                className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                  priorityFilter === p
                    ? 'bg-brand-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>

          {/* Mine / Unassigned toggles */}
          <button
            onClick={() => {
              setMineOnly(mineOnly === '1' ? '' : '1');
              if (mineOnly !== '1') setUnassignedOnly('');
            }}
            className={`rounded-pill border px-3 py-1 text-sm transition-colors duration-fast ${
              mineOnly === '1'
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-border bg-surface-primary text-text-secondary hover:text-text-primary'
            }`}
          >
            My tickets
          </button>
          <button
            onClick={() => {
              setUnassignedOnly(unassignedOnly === '1' ? '' : '1');
              if (unassignedOnly !== '1') {
                setMineOnly('');
                setAssigneeFilter('');
              }
            }}
            className={`rounded-pill border px-3 py-1 text-sm transition-colors duration-fast ${
              unassignedOnly === '1'
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-border bg-surface-primary text-text-secondary hover:text-text-primary'
            }`}
          >
            Unassigned
          </button>

          {/* Assignee dropdown */}
          <select
            value={assigneeFilter}
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              if (e.target.value) {
                setMineOnly('');
                setUnassignedOnly('');
              }
            }}
            className="min-h-8 rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
          >
            <option value="">Any assignee</option>
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.team}
              </option>
            ))}
          </select>

          {/* Admin-only team scope — admins can view any team's board,
              not just their own, so cross-team work is visible. */}
          {isAdmin && (
            <select
              value={adminTeam}
              onChange={(e) => setAdminTeam(e.target.value)}
              title="Narrow the board to one team"
              className="min-h-8 rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
            >
              <option value="">All teams</option>
              {teamsQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="ml-auto flex items-center gap-1 rounded-pill px-3 py-1 text-xs text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            >
              <XIcon className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, or Jira key"
            className="min-h-8 w-full rounded border border-border bg-surface-primary pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        {/* Result count */}
        <div className="text-xs text-text-tertiary">
          {filteredTickets.length} of {allTickets.length} tickets
          {hasActiveFilters && ' match the current filters'}
        </div>
      </div>

      <TaskBoard tickets={filteredTickets} listArgs={listArgs} initialOpenId={openParam} />

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
                createMutation.mutate({
                  title,
                  description,
                  priority: createPriority,
                  teamId: user.teamId,
                });
              }}
              className="space-y-3"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
                autoFocus
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
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value as Priority)}
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
