import { Suspense, lazy, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { Avatar, useConfirm, useToast, paletteFor } from '../components/ui';
import {
  AlertIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  PlaneIcon,
  PlusIcon,
  RefreshIcon,
  SendIcon,
  SpinnerIcon,
  XIcon,
  ZapIcon,
} from '../components/icons';

const ProdSupportModal = lazy(() =>
  import('../features/resources/ProdSupportModal').then((m) => ({ default: m.ProdSupportModal }))
);

type RotaEntry = {
  id: string;
  teamId: string;
  weekNumber: number;
  startDate: string | Date;
  endDate: string | Date;
  primaryId: string;
  secondaryId: string;
  team: { id: string; name: string };
  primary: { id: string; name: string; initials: string };
  secondary: { id: string; name: string; initials: string };
};

const formatRange = (a: string | Date, b: string | Date) => {
  const start = typeof a === 'string' ? new Date(a) : a;
  const end = typeof b === 'string' ? new Date(b) : b;
  const fmt = { month: 'short' as const, day: 'numeric' as const };
  return `${start.toLocaleDateString(undefined, fmt)} — ${end.toLocaleDateString(undefined, fmt)}`;
};

const daysUntilEnd = (end: string | Date) => {
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  const diff = e.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 3600 * 1000));
};

const nextMonday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 1 ? 7 : day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ProdSupportPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const toast = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const isAdmin = user?.role === 'ADMIN';
  const isLead = user?.role === 'TEAM_LEAD';
  const canScheduleAny = isAdmin;
  const canScheduleOwn = isAdmin || isLead;

  // Team leads are locked to their own team; admins keep the All + per-team chips.
  const initialTeamFilter =
    isLead && user?.teamId ? user.teamId : user?.teamId ?? 'all';
  const [teamFilter, setTeamFilter] = useState<string>(initialTeamFilter);

  const [year] = useState(new Date().getFullYear());

  const [editing, setEditing] = useState<RotaEntry | null>(null);
  const [creating, setCreating] = useState<{ teamId: string; teamName: string } | null>(null);
  const [autoScheduleFor, setAutoScheduleFor] = useState<{ teamId: string; teamName: string } | null>(null);
  const [requestingCover, setRequestingCover] = useState<RotaEntry | null>(null);

  const teamsQuery = trpc.teams.list.useQuery();
  const visibleTeams = useMemo(() => {
    const all = teamsQuery.data ?? [];
    if (isLead && user?.teamId) return all.filter((t) => t.id === user.teamId);
    return all;
  }, [teamsQuery.data, isLead, user?.teamId]);

  const rotaQuery = trpc.resources.prodSupport.useQuery({
    teamId: teamFilter === 'all' ? undefined : teamFilter,
    year,
  });
  const coverQuery = trpc.resources.listCoverRequests.useQuery({
    teamId: teamFilter === 'all' ? undefined : teamFilter,
    openOnly: true,
  });

  const acceptCover = trpc.resources.acceptCover.useMutation({
    onSuccess: () => {
      utils.resources.prodSupport.invalidate();
      utils.resources.listCoverRequests.invalidate();
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.push({ kind: 'success', title: 'Shift taken — thanks for stepping in!' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Could not accept', message: err.message }),
  });
  const cancelCover = trpc.resources.cancelCover.useMutation({
    onSuccess: () => {
      utils.resources.listCoverRequests.invalidate();
      toast.push({ kind: 'info', title: 'Cover request cancelled' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Cancel failed', message: err.message }),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = useMemo(() => {
    const rota = rotaQuery.data ?? [];
    const current = rota.find((r) => {
      const s = new Date(r.startDate);
      const e = new Date(r.endDate);
      return s <= today && today <= e;
    });
    const upcoming = rota.filter((r) => new Date(r.startDate) > today).slice(0, 6);
    const past = rota.filter((r) => new Date(r.endDate) < today).slice(-5);
    return { current, upcoming, past };
  }, [rotaQuery.data, today]);

  const isOnCall = (entry: RotaEntry | null | undefined) =>
    !!entry && (entry.primary.id === user?.id || entry.secondary.id === user?.id);

  const handleAcceptCover = async (requestId: string, teammate: string) => {
    const ok = await confirm({
      title: `Take ${teammate}'s shift?`,
      message: 'You will replace them on the rota and the channel gets notified.',
      confirmLabel: 'Take shift',
    });
    if (ok) acceptCover.mutate({ coverRequestId: requestId });
  };

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Prod support rota</h1>
          <p className="mt-1 text-base text-text-secondary">
            Each team picks a primary + secondary for the week. Devs on call can
            request cover; teammates can take it in one click.
          </p>
        </div>
        {canScheduleOwn && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const targetTeamId =
                  isAdmin && teamFilter !== 'all'
                    ? teamFilter
                    : !isAdmin && user?.teamId
                      ? user.teamId
                      : null;
                if (!targetTeamId) {
                  toast.push({
                    kind: 'info',
                    title: 'Pick a team first',
                    message: isAdmin
                      ? 'Select a team from the filter above to auto-schedule it.'
                      : '',
                  });
                  return;
                }
                const t = visibleTeams.find((x) => x.id === targetTeamId);
                if (t) setAutoScheduleFor({ teamId: t.id, teamName: t.name });
              }}
              className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
            >
              <RefreshIcon className="h-4 w-4" />
              Auto-schedule month
            </button>
            <button
              onClick={() => {
                const targetTeamId =
                  isAdmin && teamFilter !== 'all' ? teamFilter : user?.teamId;
                if (!targetTeamId) {
                  toast.push({ kind: 'info', title: 'Pick a team first' });
                  return;
                }
                const t = visibleTeams.find((x) => x.id === targetTeamId);
                if (t) setCreating({ teamId: t.id, teamName: t.name });
              }}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
            >
              <PlusIcon className="h-4 w-4" />
              Schedule a week
            </button>
          </div>
        )}
      </header>

      {/* Team filter */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
        {isAdmin && (
          <button
            onClick={() => setTeamFilter('all')}
            className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
              teamFilter === 'all'
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            All teams
          </button>
        )}
        {visibleTeams.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeamFilter(t.id)}
            className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
              teamFilter === t.id
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.name}
            {user?.teamId === t.id && (
              <span className="ml-1 text-[10px] opacity-70">(yours)</span>
            )}
          </button>
        ))}
      </div>

      {/* Hero — On call this week */}
      <section className="mb-6">
        {now.current ? (
          <OnCallHero
            entry={now.current as RotaEntry}
            currentUserId={user?.id ?? ''}
            onOpenUser={openUser}
            onRequestCover={() => setRequestingCover(now.current as RotaEntry)}
            onEdit={canScheduleOwn && (isAdmin || user?.teamId === now.current.teamId) ? () => setEditing(now.current as RotaEntry) : null}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface-primary p-6 text-center">
            <ClockIcon className="mx-auto mb-2 h-6 w-6 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              {teamFilter === 'all'
                ? 'Nobody is scheduled for this week across any team.'
                : 'This team has no assignment for the current week.'}
            </p>
            {canScheduleOwn && teamFilter !== 'all' && (
              <button
                onClick={() => {
                  const t = visibleTeams.find((x) => x.id === teamFilter);
                  if (t) setCreating({ teamId: t.id, teamName: t.name });
                }}
                className="mt-3 inline-flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Assign a pair
              </button>
            )}
          </div>
        )}
      </section>

      {/* Open cover requests */}
      {(coverQuery.data?.length ?? 0) > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="flex items-center gap-2 text-md">
            <RefreshIcon className="h-4 w-4 text-warning-text" />
            Open cover requests
          </h2>
          {(coverQuery.data ?? []).map((cr) => {
            const mine = cr.requester.id === user?.id;
            const sameTeam = cr.assignment.teamId === user?.teamId;
            const canAccept = !mine && (isAdmin || sameTeam);
            return (
              <div
                key={cr.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-text/30 bg-warning-bg/30 p-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    userId={cr.requester.id}
                    initials={cr.requester.initials}
                    name={cr.requester.name}
                    size={36}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="text-warning-text">{cr.requester.name}</span>{' '}
                      is looking for cover
                    </p>
                    <p className="text-xs text-text-secondary">
                      {cr.assignment.team.name} · week {cr.assignment.weekNumber} ·{' '}
                      {formatRange(cr.assignment.startDate, cr.assignment.endDate)}
                    </p>
                    {cr.reason && (
                      <p className="mt-1 text-xs text-text-tertiary">"{cr.reason}"</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {mine && (
                    <button
                      onClick={() => cancelCover.mutate({ coverRequestId: cr.id })}
                      disabled={cancelCover.isPending}
                      className="rounded-pill border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Cancel request
                    </button>
                  )}
                  {canAccept && (
                    <button
                      onClick={() => handleAcceptCover(cr.id, cr.requester.name.split(' ')[0]!)}
                      disabled={acceptCover.isPending}
                      className="flex items-center gap-1 rounded-pill bg-success-bg px-3 py-1 text-xs text-success-text hover:brightness-95 disabled:opacity-60"
                    >
                      {acceptCover.isPending ? (
                        <SpinnerIcon className="h-3 w-3" />
                      ) : (
                        <CheckIcon className="h-3 w-3" />
                      )}
                      I can take this
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Upcoming */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2>Upcoming</h2>
          {canScheduleOwn && teamFilter !== 'all' && (
            <button
              onClick={() => {
                const t = visibleTeams.find((x) => x.id === teamFilter);
                if (t) setCreating({ teamId: t.id, teamName: t.name });
              }}
              className="flex items-center gap-1 rounded-pill border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              <PlusIcon className="h-3 w-3" />
              Schedule a week
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
          {now.upcoming.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-tertiary">Nothing scheduled.</p>
          ) : (
            <ul>
              {now.upcoming.map((a) => {
                const mine = isOnCall(a as RotaEntry);
                const canEditThis =
                  canScheduleOwn && (isAdmin || user?.teamId === a.teamId);
                return (
                  <li
                    key={a.id}
                    onClick={() => canEditThis && setEditing(a as RotaEntry)}
                    className={`flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 last:border-b-0 ${
                      canEditThis ? 'cursor-pointer hover:bg-surface-secondary' : ''
                    } ${mine ? 'bg-brand-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
                        {a.team.name}
                      </span>
                      <span className="flex items-center gap-1 text-text-tertiary">
                        <CalendarIcon className="h-3 w-3" />W{a.weekNumber} ·{' '}
                        {formatRange(a.startDate, a.endDate)}
                      </span>
                      {mine && (
                        <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-[10px] text-white">
                          you
                        </span>
                      )}
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PersonPill user={a.primary} role="primary" onClick={() => openUser(a.primary.id)} />
                      <PersonPill user={a.secondary} role="secondary" onClick={() => openUser(a.secondary.id)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Recent history */}
      <section>
        <h2 className="mb-2 text-text-secondary">Recent history</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary opacity-80">
          {now.past.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-tertiary">No history.</p>
          ) : (
            <ul>
              {now.past.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
                      {a.team.name}
                    </span>
                    <span className="flex items-center gap-1 text-text-tertiary">
                      <CalendarIcon className="h-3 w-3" />W{a.weekNumber} ·{' '}
                      {formatRange(a.startDate, a.endDate)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PersonPill user={a.primary} role="primary" onClick={() => openUser(a.primary.id)} />
                    <PersonPill user={a.secondary} role="secondary" onClick={() => openUser(a.secondary.id)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-1.5 text-xs text-text-tertiary">
        <CheckIcon className="h-3 w-3" />
        Cover requests fan out as inbox notifications and post to the team's Slack channel.
      </div>

      {(editing || creating) && (
        <Suspense fallback={null}>
          <ProdSupportModal
            existing={editing}
            teamId={creating?.teamId}
            teamName={creating?.teamName}
            onClose={() => {
              setEditing(null);
              setCreating(null);
            }}
          />
        </Suspense>
      )}

      {autoScheduleFor && (
        <AutoScheduleModal
          teamId={autoScheduleFor.teamId}
          teamName={autoScheduleFor.teamName}
          onClose={() => setAutoScheduleFor(null)}
        />
      )}

      {requestingCover && user && (
        <RequestCoverModal
          assignment={requestingCover}
          onClose={() => setRequestingCover(null)}
        />
      )}
    </div>
  );
}

function PersonPill({
  user,
  role,
  onClick,
}: {
  user: { id: string; name: string; initials: string };
  role: 'primary' | 'secondary';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary py-0.5 pl-0.5 pr-2.5 text-xs hover:border-border-strong"
      title={`${role} — view profile`}
    >
      <Avatar userId={user.id} initials={user.initials} name={user.name} size={20} />
      <span className="text-text-primary">{user.name}</span>
      <span
        className={`rounded-pill px-1.5 py-0 text-[9px] ${
          role === 'primary' ? 'bg-brand-50 text-brand-600' : 'bg-surface-secondary text-text-tertiary'
        }`}
      >
        {role === 'primary' ? '1°' : '2°'}
      </span>
    </button>
  );
}

function OnCallHero({
  entry,
  currentUserId,
  onOpenUser,
  onRequestCover,
  onEdit,
}: {
  entry: RotaEntry;
  currentUserId: string;
  onOpenUser: (id: string) => void;
  onRequestCover: () => void;
  onEdit: (() => void) | null;
}) {
  const days = daysUntilEnd(entry.endDate);
  const isPrimary = currentUserId === entry.primary.id;
  const isSecondary = currentUserId === entry.secondary.id;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-brand-500/30"
      style={{
        background:
          'linear-gradient(135deg, var(--brand-50) 0%, var(--surface-primary) 50%, var(--accent-bg) 100%)',
      }}
    >
      {/* Decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: 'var(--brand-500)' }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-text text-white">
              <AlertIcon className="h-3 w-3" />
            </span>
            <span className="text-xs uppercase tracking-widest text-text-tertiary">
              On call this week
            </span>
          </div>
          <h2 className="text-xl">
            <span className="text-brand-600">{entry.team.name}</span>
            <span className="text-text-tertiary"> · week {entry.weekNumber}</span>
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatRange(entry.startDate, entry.endDate)}
            <span className="mx-1 text-text-tertiary">·</span>
            <ClockIcon className="h-3.5 w-3.5" />
            {days} {days === 1 ? 'day' : 'days'} left
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-pill border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            Edit rota
          </button>
        )}
      </div>

      {/* Primary + secondary cards */}
      <div className="relative grid gap-3 p-6 pt-0 sm:grid-cols-2">
        <HeroPersonCard
          user={entry.primary}
          role="Primary"
          isMine={isPrimary}
          onOpen={() => onOpenUser(entry.primary.id)}
          onRequestCover={isPrimary ? onRequestCover : null}
        />
        <HeroPersonCard
          user={entry.secondary}
          role="Secondary"
          isMine={isSecondary}
          onOpen={() => onOpenUser(entry.secondary.id)}
          onRequestCover={isSecondary ? onRequestCover : null}
        />
      </div>
    </div>
  );
}

function HeroPersonCard({
  user,
  role,
  isMine,
  onOpen,
  onRequestCover,
}: {
  user: { id: string; name: string; initials: string };
  role: 'Primary' | 'Secondary';
  isMine: boolean;
  onOpen: () => void;
  onRequestCover: (() => void) | null;
}) {
  const palette = paletteFor(user.id);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-4 ${
        role === 'Primary'
          ? 'border-brand-500/50 bg-surface-primary'
          : 'border-border bg-surface-primary/70'
      }`}
    >
      <button
        onClick={onOpen}
        className="shrink-0 rounded-full transition-transform duration-fast hover:scale-105"
      >
        <Avatar
          userId={user.id}
          initials={user.initials}
          name={user.name}
          size={56}
          style={{ background: palette.bg, color: palette.text }}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className={`rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider ${
              role === 'Primary'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-secondary text-text-tertiary'
            }`}
          >
            {role}
          </span>
          {isMine && (
            <span className="rounded-pill bg-accent-bg px-2 py-0.5 text-[10px] text-accent-text">
              that's you
            </span>
          )}
        </div>
        <button
          onClick={onOpen}
          className="truncate text-md text-text-primary hover:underline"
        >
          {user.name}
        </button>
        {isMine && onRequestCover && (
          <button
            onClick={onRequestCover}
            className="mt-2 flex items-center gap-1.5 rounded border border-border bg-surface-primary px-2 py-1 text-xs text-text-secondary hover:border-warning-text/40 hover:bg-warning-bg hover:text-warning-text"
          >
            <RefreshIcon className="h-3 w-3" />
            Request cover
          </button>
        )}
      </div>
    </div>
  );
}

function RequestCoverModal({
  assignment,
  onClose,
}: {
  assignment: RotaEntry;
  onClose: () => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reason, setReason] = useState('');

  const requestCover = trpc.resources.requestCover.useMutation({
    onSuccess: () => {
      utils.resources.listCoverRequests.invalidate();
      toast.push({
        kind: 'success',
        title: 'Cover request sent',
        message: 'Teammates notified via inbox and the team channel.',
      });
      onClose();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Request failed', message: err.message }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    requestCover.mutate({
      assignmentId: assignment.id,
      reason: reason.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-card overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2>Request cover</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              {assignment.team.name} · week {assignment.weekNumber} ·{' '}
              {formatRange(assignment.startDate, assignment.endDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">
              Why do you need cover? (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="e.g. on leave, doctor appointment, …"
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div className="flex items-start gap-2 rounded border border-border bg-surface-secondary p-3 text-xs text-text-tertiary">
            <PlaneIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sending will notify every other active teammate via their inbox and
            post a message to the team's Slack channel.
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={requestCover.isPending}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {requestCover.isPending ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
              Request cover
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AutoScheduleModal({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const teamsQuery = trpc.teams.list.useQuery();
  const team = teamsQuery.data?.find((t) => t.id === teamId);

  const [startDate, setStartDate] = useState(toIso(nextMonday()));
  const [weeks, setWeeks] = useState(4);
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<{ pair: string[]; weekLabel: string; startIso: string }[] | null>(null);

  const autoSchedule = trpc.resources.autoScheduleMonth.useMutation({
    onSuccess: (data) => {
      utils.resources.prodSupport.invalidate();
      toast.push({
        kind: 'success',
        title: 'Rota generated',
        message: `${data.created} ${data.created === 1 ? 'week' : 'weeks'} scheduled.`,
      });
      onClose();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Schedule failed', message: err.message }),
  });

  const regeneratePreview = () => {
    if (!team || team.members.length < 2) {
      toast.push({
        kind: 'error',
        title: 'Not enough members',
        message: 'Need at least two active teammates to build a rota.',
      });
      return;
    }
    const used = new Set<string>();
    const rows: { pair: string[]; weekLabel: string; startIso: string }[] = [];
    const base = new Date(`${startDate}T00:00:00Z`);
    for (let i = 0; i < weeks; i++) {
      const start = new Date(base);
      start.setUTCDate(start.getUTCDate() + i * 7);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 4);

      let pool = team.members.filter((m) => !used.has(m.id));
      if (pool.length < 2) {
        used.clear();
        pool = [...team.members];
      }
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const primary = shuffled[0]!;
      const secondary = shuffled[1]!;
      used.add(primary.id);
      used.add(secondary.id);
      rows.push({
        pair: [primary.name, secondary.name],
        weekLabel: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        startIso: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`,
      });
    }
    setPreview(rows);
  };

  const handleApply = () => {
    autoSchedule.mutate({ teamId, startDate, weeks, overwrite });
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-modal overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2>Auto-schedule month</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              {teamName} · {team?.members.length ?? 0} members
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Start (Monday)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Weeks to schedule</label>
              <input
                type="number"
                min={1}
                max={12}
                value={weeks}
                onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value))))}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-600"
            />
            Overwrite weeks that already have an assignment
          </label>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <button
              onClick={regeneratePreview}
              className="flex items-center gap-1.5 rounded border border-border bg-surface-primary px-3 py-1 text-sm text-text-secondary hover:text-text-primary"
            >
              <ZapIcon className="h-3.5 w-3.5" />
              {preview ? 'Regenerate preview' : 'Generate preview'}
            </button>
            <span className="text-xs text-text-tertiary">
              Pairs are random but avoid repeats within the same run.
            </span>
          </div>

          {preview && (
            <div className="rounded border border-border bg-surface-secondary p-3">
              <p className="mb-2 text-xs text-text-tertiary">Preview</p>
              <ul className="space-y-1">
                {preview.map((row, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border border-border bg-surface-primary px-2 py-1 text-sm"
                  >
                    <span className="text-text-tertiary">{row.weekLabel}</span>
                    <span className="text-text-primary">
                      {row.pair[0]}{' '}
                      <span className="text-text-tertiary">+</span> {row.pair[1]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-text-tertiary">
                This is just a preview — clicking Apply re-rolls a fresh random pairing server-side.
              </p>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border bg-surface-secondary p-3">
          <button
            onClick={onClose}
            className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={autoSchedule.isPending}
            className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {autoSchedule.isPending ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <ArrowRightIcon className="h-4 w-4" />
            )}
            Apply &amp; save
          </button>
        </footer>
      </div>
    </div>
  );
}
