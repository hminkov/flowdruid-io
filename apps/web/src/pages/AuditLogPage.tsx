import { useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useUserDetail } from '../hooks/useUserDetail';
import { Avatar, EmptyState } from '../components/ui';
import { CalendarIcon, ChevronDownIcon } from '../components/icons';

const ACTION_LABELS: Record<string, string> = {
  USER_ROLE_CHANGED: 'Role changed',
  USER_DEACTIVATED: 'User deactivated',
  USER_CREATED: 'User created',
  LEAVE_APPROVED: 'Leave approved',
  LEAVE_DENIED: 'Leave denied',
  LEAVE_DELETED: 'Leave deleted',
  TICKET_DELETED: 'Ticket deleted',
  TICKET_REASSIGNED: 'Ticket reassigned',
  QA_ENV_CREATED: 'QA env created',
  QA_ENV_DELETED: 'QA env deleted',
  QA_BOOKING_DELETED: 'QA booking deleted',
  TEAM_CREATED: 'Team created',
  TEAM_DELETED: 'Team deleted',
  PARKING_SPOT_CREATED: 'Parking spot added',
  PARKING_SPOT_DELETED: 'Parking spot removed',
  PROD_SUPPORT_DELETED: 'Prod-support entry deleted',
  SLACK_CONFIG_UPDATED: 'Slack config updated',
  JIRA_CONFIG_UPDATED: 'Jira config updated',
  BROADCAST_SENT: 'Broadcast sent',
};

const ACTION_TONES: Record<string, string> = {
  USER_ROLE_CHANGED: 'bg-brand-50 text-brand-600',
  USER_DEACTIVATED: 'bg-danger-bg text-danger-text',
  USER_CREATED: 'bg-success-bg text-success-text',
  LEAVE_APPROVED: 'bg-success-bg text-success-text',
  LEAVE_DENIED: 'bg-danger-bg text-danger-text',
  BROADCAST_SENT: 'bg-info-bg text-info-text',
};

function toneFor(action: string): string {
  return ACTION_TONES[action] ?? 'bg-neutral-bg text-neutral-text';
}

const formatRelative = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function AuditLogPage() {
  const { openUser } = useUserDetail();
  const [actorId, setActorId] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = trpc.auditLog.list.useQuery({
    actorId: actorId || undefined,
    action: (action || undefined) as never,
    entityType: entityType || undefined,
    limit: 100,
  });
  const usersQuery = trpc.users.list.useQuery();
  const entityTypesQuery = trpc.auditLog.entityTypes.useQuery();

  const actions = useMemo(() => Object.keys(ACTION_LABELS), []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const clearFilters = () => {
    setActorId('');
    setAction('');
    setEntityType('');
  };

  const hasFilter = actorId || action || entityType;

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>Audit log</h1>
        <p className="mt-1 text-base text-text-secondary">
          Who changed what, and when. Captures role changes, leave approvals,
          deletions, and integration config updates.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
        >
          <option value="">Any actor</option>
          {usersQuery.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
        >
          <option value="">Any action</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
        >
          <option value="">Any entity type</option>
          {entityTypesQuery.data?.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="text-xs text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-text-tertiary">
          {query.data ? `${query.data.items.length} entries` : 'Loading…'}
        </span>
      </div>

      {query.isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 rounded-md" />
          ))}
        </div>
      )}

      {!query.isLoading && (query.data?.items.length ?? 0) === 0 && (
        <EmptyState
          icon={<CalendarIcon className="h-4 w-4" />}
          title="No entries yet"
          message={
            hasFilter
              ? 'Nothing matches the current filters — try clearing one.'
              : 'The audit log fills up as roles change, leaves are approved, and integrations get configured.'
          }
        />
      )}

      {!query.isLoading && (query.data?.items.length ?? 0) > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-primary">
          {query.data?.items.map((row) => {
            const open = expanded.has(row.id);
            return (
              <li key={row.id}>
                <div
                  onClick={() => toggle(row.id)}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-surface-secondary"
                >
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-fast ${open ? '' : '-rotate-90'}`}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openUser(row.actor.id);
                    }}
                    className="flex shrink-0 items-center gap-2 hover:underline"
                  >
                    <Avatar userId={row.actor.id} initials={row.actor.initials} name={row.actor.name} size={24} />
                    <span className="text-sm text-text-primary">{row.actor.name}</span>
                  </button>
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${toneFor(row.action)}`}
                  >
                    {ACTION_LABELS[row.action] ?? row.action}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-tertiary">
                    <span className="font-mono text-text-secondary">{row.entityType}</span>
                    <span className="truncate font-mono">#{row.entityId.slice(-8)}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-text-tertiary tabular-nums">
                    {formatRelative(row.createdAt)}
                  </span>
                </div>
                {open && (
                  <div className="border-t border-border bg-surface-secondary p-3">
                    {row.reason && (
                      <p className="mb-2 text-xs text-text-secondary">
                        <span className="text-text-tertiary">Reason:</span> {row.reason}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                          Before
                        </p>
                        <pre className="overflow-x-auto rounded border border-border bg-surface-primary p-2 font-mono text-[11px] text-text-primary">
                          {row.before ? JSON.stringify(row.before, null, 2) : '—'}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                          After
                        </p>
                        <pre className="overflow-x-auto rounded border border-border bg-surface-primary p-2 font-mono text-[11px] text-text-primary">
                          {row.after ? JSON.stringify(row.after, null, 2) : '—'}
                        </pre>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-text-tertiary tabular-nums">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
