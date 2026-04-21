import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useUserDetail } from '../hooks/useUserDetail';
import { Avatar, EmptyState } from '../components/ui';
import { CalendarIcon } from '../components/icons';

// Mirrors the server enum. Kept verbatim so the filter dropdown and
// event pills read the same thing the API emits.
const TYPES = [
  'STANDUP_POSTED',
  'LEAVE_REQUESTED',
  'LEAVE_APPROVED',
  'LEAVE_DENIED',
  'QA_BOOKING_CREATED',
  'QA_BOOKING_STATUS_CHANGED',
  'PARKING_CLAIMED',
  'COVER_REQUESTED',
  'COVER_ACCEPTED',
] as const;

const TYPE_TONES: Record<string, string> = {
  STANDUP_POSTED: 'bg-info-bg text-info-text',
  LEAVE_REQUESTED: 'bg-neutral-bg text-neutral-text',
  LEAVE_APPROVED: 'bg-success-bg text-success-text',
  LEAVE_DENIED: 'bg-danger-bg text-danger-text',
  QA_BOOKING_CREATED: 'bg-success-bg text-success-text',
  QA_BOOKING_STATUS_CHANGED: 'bg-brand-50 text-brand-600',
  PARKING_CLAIMED: 'bg-neutral-bg text-neutral-text',
  COVER_REQUESTED: 'bg-warn-bg text-warn-text',
  COVER_ACCEPTED: 'bg-success-bg text-success-text',
};

function toneFor(type: string): string {
  return TYPE_TONES[type] ?? 'bg-neutral-bg text-neutral-text';
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

export function ActivityPage() {
  const { openUser } = useUserDetail();
  const [actorId, setActorId] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [before, setBefore] = useState<string | undefined>(undefined);

  const query = trpc.activity.feed.useQuery({
    actorId: actorId || undefined,
    types: type ? ([type] as never) : undefined,
    before,
    limit: 100,
  });
  const usersQuery = trpc.users.list.useQuery();

  const clearFilters = () => {
    setActorId('');
    setType('');
    setBefore(undefined);
  };

  const hasFilter = actorId || type;

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>Activity</h1>
        <p className="mt-1 text-base text-text-secondary">
          Live feed of what's happening across the org — standups, leave
          requests, QA bookings, parking claims, cover swaps. Audit log lives
          in its own page for security-sensitive events.
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
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-sm text-text-primary"
        >
          <option value="">Any event</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
          {query.data ? `${query.data.items.length} events` : 'Loading…'}
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
          title="No activity yet"
          message={
            hasFilter
              ? 'Nothing matches these filters — try clearing one.'
              : 'Activity fills up as people post standups, book QA envs, claim parking, etc.'
          }
        />
      )}

      {!query.isLoading && (query.data?.items.length ?? 0) > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-primary">
          {query.data?.items.map((row) => (
            <li key={row.id}>
              <div className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-surface-secondary">
                <button
                  type="button"
                  onClick={() => openUser(row.actorId)}
                  className="flex shrink-0 items-center gap-2 hover:underline"
                >
                  <Avatar
                    userId={row.actorId}
                    initials={row.actorInitials}
                    name={row.actorName}
                    size={24}
                  />
                  <span className="text-sm text-text-primary">{row.actorName}</span>
                </button>
                <span
                  className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${toneFor(row.type)}`}
                >
                  {row.type}
                </span>
                <span className="truncate text-sm text-text-secondary">
                  {row.linkPath ? (
                    <Link to={row.linkPath} className="hover:underline">
                      {row.summary}
                    </Link>
                  ) : (
                    row.summary
                  )}
                </span>
                <span className="ml-auto shrink-0 text-xs text-text-tertiary tabular-nums">
                  {formatRelative(row.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.data?.nextBefore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setBefore(query.data.nextBefore ?? undefined)}
            className="rounded border border-border bg-surface-primary px-3 py-1.5 text-sm text-text-primary hover:bg-surface-secondary"
          >
            Load older
          </button>
        </div>
      )}
    </div>
  );
}
