import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useUserDetail } from '../hooks/useUserDetail';
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  TeamsIcon,
  XIcon,
  ZapIcon,
} from './icons';
import type { Ticket } from '../features/tasks/types';

const TicketDetailModal = lazy(() =>
  import('../features/tasks/TicketDetailModal').then((m) => ({
    default: m.TicketDetailModal,
  })),
);

const availabilityToneMap: Record<string, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-danger-bg text-danger-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-warning-bg text-warning-text',
};

const availabilityDotMap: Record<string, string> = {
  AVAILABLE: 'bg-success-text',
  BUSY: 'bg-danger-text',
  REMOTE: 'bg-info-text',
  ON_LEAVE: 'bg-warning-text',
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

export function TeamDetailDrawer({
  teamId,
  onClose,
}: {
  teamId: string | null;
  onClose: () => void;
}) {
  const open = teamId !== null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const { openUser } = useUserDetail();
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);

  const teamsQuery = trpc.teams.list.useQuery(undefined, { enabled: open });
  const standupsQuery = trpc.standups.list.useQuery(
    { teamId: teamId ?? undefined, date: todayIso },
    { enabled: open }
  );
  const ticketsQuery = trpc.tickets.list.useQuery(
    { teamId: teamId ?? undefined },
    { enabled: open }
  );

  const team = useMemo(() => {
    if (!teamId) return null;
    return teamsQuery.data?.find((t) => t.id === teamId) ?? null;
  }, [teamId, teamsQuery.data]);

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

  const standupByUser = useMemo(() => {
    type S = NonNullable<typeof standupsQuery.data>[number];
    const map = new Map<string, S>();
    for (const s of standupsQuery.data ?? []) map.set(s.user.id, s);
    return map;
  }, [standupsQuery.data]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const members = team?.members ?? [];
  const avail = members.filter((m) => m.availability === 'AVAILABLE').length;
  const busy = members.filter((m) => m.availability === 'BUSY').length;
  const remote = members.filter((m) => m.availability === 'REMOTE').length;
  const leave = members.filter((m) => m.availability === 'ON_LEAVE').length;

  const teamStandups = standupsQuery.data ?? [];
  const avgCapacity =
    teamStandups.length > 0
      ? Math.round(teamStandups.reduce((s, x) => s + x.capacityPct, 0) / teamStandups.length)
      : null;

  const activeCount =
    (ticketsByStatus.IN_PROGRESS?.length ?? 0) + (ticketsByStatus.IN_REVIEW?.length ?? 0);
  const doneCount = ticketsByStatus.DONE?.length ?? 0;
  const todoCount = ticketsByStatus.TODO?.length ?? 0;

  return (
    <div className="fixed inset-0 z-drawer" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in bg-[var(--overlay-backdrop)]"
        onClick={onClose}
      />
      <aside className="animate-drawer-in absolute right-0 top-0 flex h-full w-full max-w-drawer flex-col border-l border-border bg-surface-primary shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <TeamsIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg text-text-primary">{team?.name ?? '…'}</div>
              <div className="mt-1 text-xs text-text-tertiary">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </div>
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
          {/* Availability + capacity summary */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface-secondary p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-text-tertiary">
                <ZapIcon className="h-3 w-3" />
                Capacity today
              </div>
              {avgCapacity !== null ? (
                <>
                  <div className="text-2xl text-text-primary">{avgCapacity}%</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-primary">
                    <div
                      className={`h-full ${capacityTone(avgCapacity)}`}
                      style={{ width: `${avgCapacity}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-text-tertiary">
                    {teamStandups.length}/{members.length} posted
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-tertiary">No standups yet today.</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface-secondary p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-text-tertiary">
                <BriefcaseIcon className="h-3 w-3" />
                Tickets
              </div>
              <div className="text-2xl text-text-primary">{activeCount} active</div>
              <div className="mt-2 text-xs text-text-tertiary">
                {todoCount} to do · {doneCount} done
              </div>
            </div>
          </div>

          {/* Availability breakdown */}
          <div className="mb-5 rounded-lg border border-border bg-surface-secondary p-3">
            <p className="mb-2 text-xs text-text-tertiary">Availability</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {avail > 0 && (
                <span className="inline-flex items-center gap-1.5 text-text-primary">
                  <span className={`h-2 w-2 rounded-full ${availabilityDotMap.AVAILABLE}`} />
                  {avail} available
                </span>
              )}
              {busy > 0 && (
                <span className="inline-flex items-center gap-1.5 text-text-primary">
                  <span className={`h-2 w-2 rounded-full ${availabilityDotMap.BUSY}`} />
                  {busy} busy
                </span>
              )}
              {remote > 0 && (
                <span className="inline-flex items-center gap-1.5 text-text-primary">
                  <span className={`h-2 w-2 rounded-full ${availabilityDotMap.REMOTE}`} />
                  {remote} remote
                </span>
              )}
              {leave > 0 && (
                <span className="inline-flex items-center gap-1.5 text-text-primary">
                  <span className={`h-2 w-2 rounded-full ${availabilityDotMap.ON_LEAVE}`} />
                  {leave} on leave
                </span>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3>Members</h3>
              <span className="text-xs text-text-tertiary">{members.length} total</span>
            </div>
            <div className="space-y-1.5">
              {members.map((m) => {
                const palette = paletteFor(m.id);
                const s = standupByUser.get(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => openUser(m.id)}
                    className="flex w-full items-center gap-3 rounded border border-border bg-surface-primary p-2 text-left hover:bg-surface-secondary"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs"
                      style={{ background: palette.bg, color: palette.text }}
                    >
                      {m.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text-primary">{m.name}</div>
                      {s && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-secondary">
                            <div
                              className={`h-full ${capacityTone(s.capacityPct)}`}
                              style={{ width: `${s.capacityPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text-tertiary">
                            {s.capacityPct}%
                          </span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] ${availabilityToneMap[m.availability]}`}
                    >
                      {m.availability.replace('_', ' ').toLowerCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tickets grouped */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3>Tickets</h3>
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
                      {group.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOpenTicket(t as Ticket)}
                          className="flex w-full items-start gap-2 rounded border border-border bg-surface-primary p-2 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-secondary"
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
                          </div>
                        </button>
                      ))}
                      {group.length > 6 && (
                        <p className="text-xs text-text-tertiary">
                          +{group.length - 6} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {!ticketsQuery.isLoading && (ticketsQuery.data?.length ?? 0) === 0 && (
                <p className="rounded-lg border border-dashed border-border bg-surface-primary p-4 text-center text-sm text-text-tertiary">
                  No tickets for this team yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {openTicket && (
        <Suspense fallback={null}>
          <TicketDetailModal
            ticket={openTicket}
            onClose={() => setOpenTicket(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
