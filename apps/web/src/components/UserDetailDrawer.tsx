import { useEffect, useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  PlaneIcon,
  TrendingUpIcon,
  XIcon,
  ZapIcon,
} from './icons';

const availabilityToneMap: Record<string, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-danger-bg text-danger-text',
};

const avatarPalettes = [
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
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

const capacityTone = (pct: number) =>
  pct >= 90 ? 'bg-capacity-full' : pct >= 70 ? 'bg-capacity-high' : 'bg-capacity-normal';

const STATUS_ORDER = ['IN_PROGRESS', 'IN_REVIEW', 'TODO', 'DONE'] as const;
const STATUS_LABELS: Record<string, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};

// Complexity / difficulty scoring — used to award points per completed ticket.
// HIGH = 5, MEDIUM = 3, LOW = 1.
const PRIORITY_SCORE: Record<string, number> = {
  HIGH: 5,
  MEDIUM: 3,
  LOW: 1,
};

type ActivityWindow = 'week' | 'month' | 'year';
const WINDOW_LABEL: Record<ActivityWindow, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};
const WINDOW_DAYS: Record<ActivityWindow, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const open = userId !== null;
  const today = new Date().toISOString().slice(0, 10);
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('month');

  const teamsQuery = trpc.teams.list.useQuery(undefined, { enabled: open });
  const ticketsQuery = trpc.tickets.list.useQuery(
    { assigneeId: userId ?? undefined },
    { enabled: open }
  );
  const standupQuery = trpc.standups.list.useQuery(
    { userId: userId ?? undefined, date: today },
    { enabled: open }
  );

  const user = useMemo(() => {
    if (!userId || !teamsQuery.data) return null;
    for (const team of teamsQuery.data) {
      const m = team.members.find((x) => x.id === userId);
      if (m) return { ...m, team };
    }
    return null;
  }, [userId, teamsQuery.data]);

  const standup = standupQuery.data?.[0];

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<string, NonNullable<typeof ticketsQuery.data>> = {
      IN_PROGRESS: [],
      IN_REVIEW: [],
      TODO: [],
      DONE: [],
    };
    for (const t of ticketsQuery.data ?? []) grouped[t.status]?.push(t);
    return grouped;
  }, [ticketsQuery.data]);

  // Activity — tickets marked DONE whose updatedAt falls inside the window.
  // Score = sum of priority weights (HIGH=5, MEDIUM=3, LOW=1).
  const activity = useMemo(() => {
    const doneTickets = ticketsByStatus.DONE ?? [];
    const cutoff = Date.now() - WINDOW_DAYS[activityWindow] * 24 * 60 * 60 * 1000;
    const inWindow = doneTickets.filter(
      (t) => new Date(t.updatedAt).getTime() >= cutoff
    );
    const score = inWindow.reduce((sum, t) => sum + (PRIORITY_SCORE[t.priority] ?? 0), 0);
    return { tickets: inWindow, score };
  }, [ticketsByStatus.DONE, activityWindow]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const palette = user ? paletteFor(user.id) : avatarPalettes[0]!;

  return (
    <div className="fixed inset-0 z-drawer" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in bg-[var(--overlay-backdrop)]"
        onClick={onClose}
      />
      <aside className="animate-drawer-in absolute right-0 top-0 flex h-full w-full max-w-drawer flex-col border-l border-border bg-surface-primary shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base"
              style={{ background: palette.bg, color: palette.text }}
            >
              {user?.initials ?? '…'}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg text-text-primary">{user?.name ?? 'Loading…'}</div>
              <div className="mt-1 text-xs text-text-tertiary">{user?.team.name ?? ''}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {user && (
            <>
              {/* Availability + capacity */}
              <div className="mb-5 rounded-lg border border-border bg-surface-secondary p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Availability</span>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-xs ${availabilityToneMap[user.availability]}`}
                  >
                    {user.availability.replace('_', ' ').toLowerCase()}
                  </span>
                </div>

                {standup ? (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <ZapIcon className="h-3 w-3" />
                        Capacity today
                      </span>
                      <span className="tabular-nums">{standup.capacityPct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-primary">
                      <div
                        className={`h-full ${capacityTone(standup.capacityPct)}`}
                        style={{ width: `${standup.capacityPct}%` }}
                      />
                    </div>
                  </div>
                ) : user.availability === 'ON_LEAVE' ? (
                  <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <PlaneIcon className="h-3 w-3" />
                    On leave
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <CalendarIcon className="h-3 w-3" />
                    No standup today
                  </p>
                )}
              </div>

              {/* Standup text */}
              {standup && (
                <div className="mb-5 space-y-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm">
                  <p>
                    <span className="text-text-tertiary">Today: </span>
                    <span className="text-text-primary">{standup.today}</span>
                  </p>
                  <p>
                    <span className="text-text-tertiary">Yesterday: </span>
                    <span className="text-text-secondary">{standup.yesterday}</span>
                  </p>
                  {standup.blockers && (
                    <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-danger-text">
                      <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{standup.blockers}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Activity / score */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3>Activity</h3>
                  <div className="flex gap-0.5 rounded-pill border border-border bg-surface-primary p-0.5">
                    {(['week', 'month', 'year'] as ActivityWindow[]).map((w) => (
                      <button
                        key={w}
                        onClick={() => setActivityWindow(w)}
                        className={`rounded-pill px-2 py-0.5 text-xs transition-colors duration-fast ${
                          activityWindow === w
                            ? 'bg-brand-600 text-white'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {w === 'week' ? 'Week' : w === 'month' ? 'Month' : 'Year'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-surface-secondary p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                      <CheckIcon className="h-3 w-3" />
                      Completed
                    </div>
                    <div className="text-2xl text-text-primary">{activity.tickets.length}</div>
                    <div className="text-xs text-text-tertiary">
                      {WINDOW_LABEL[activityWindow].toLowerCase()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-secondary p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                      <TrendingUpIcon className="h-3 w-3" />
                      Score
                    </div>
                    <div className="text-2xl text-text-primary">{activity.score}</div>
                    <div className="text-xs text-text-tertiary">
                      HIGH 5 · MED 3 · LOW 1
                    </div>
                  </div>
                </div>

                {activity.tickets.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {activity.tickets.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded border border-border bg-surface-primary p-2"
                      >
                        <span
                          className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                        />
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            t.source === 'JIRA'
                              ? 'bg-info-bg text-info-text'
                              : 'bg-neutral-bg text-neutral-text'
                          }`}
                        >
                          {t.jiraKey || `INT-${t.id.slice(-4)}`}
                        </span>
                        <span className="truncate text-xs text-text-primary">{t.title}</span>
                        <span className="ml-auto shrink-0 text-xs text-text-tertiary">
                          +{PRIORITY_SCORE[t.priority]}
                        </span>
                      </div>
                    ))}
                    {activity.tickets.length > 5 && (
                      <p className="text-xs text-text-tertiary">
                        +{activity.tickets.length - 5} more
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tickets grouped by status */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3>Assigned tickets</h3>
                  <span className="text-xs text-text-tertiary">
                    {ticketsQuery.data?.length ?? 0} total
                  </span>
                </div>

                {ticketsQuery.isLoading && (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton h-10 w-full" />
                    ))}
                  </div>
                )}

                {!ticketsQuery.isLoading && ticketsQuery.data?.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border bg-surface-primary p-4 text-center text-sm text-text-tertiary">
                    No tickets assigned.
                  </p>
                )}

                <div className="space-y-4">
                  {STATUS_ORDER.map((status) => {
                    const group = ticketsByStatus[status] ?? [];
                    if (group.length === 0) return null;
                    return (
                      <div key={status}>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-text-tertiary">
                          <span>{STATUS_LABELS[status]}</span>
                          <span>{group.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {group.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-start gap-2 rounded border border-border bg-surface-primary p-2"
                            >
                              <span
                                className={`mt-1 inline-block h-[7px] w-[7px] shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                                title={t.priority.toLowerCase()}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                      t.source === 'JIRA'
                                        ? 'bg-info-bg text-info-text'
                                        : 'bg-neutral-bg text-neutral-text'
                                    }`}
                                  >
                                    {t.jiraKey || `INT-${t.id.slice(-4)}`}
                                  </span>
                                  <span className="truncate text-sm text-text-primary">
                                    {t.title}
                                  </span>
                                </div>
                                {t.description && (
                                  <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">
                                    {t.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
