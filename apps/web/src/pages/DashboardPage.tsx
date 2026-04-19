import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { trpc } from '../lib/trpc';
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  PlaneIcon,
  TeamsIcon,
  TrendingUpIcon,
  ZapIcon,
} from '../components/icons';

const availabilityToneMap: Record<string, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-danger-bg text-danger-text',
};

const availabilityDotMap: Record<string, string> = {
  AVAILABLE: 'bg-success-text',
  BUSY: 'bg-warning-text',
  REMOTE: 'bg-info-text',
  ON_LEAVE: 'bg-danger-text',
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

function CapacityBar({ pct, thin = false }: { pct: number; thin?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${thin ? 'h-1' : 'h-1.5'} flex-1 overflow-hidden rounded-full bg-surface-secondary`}
      >
        <div className={`h-full ${capacityTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-text-tertiary">{pct}%</span>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent: 'brand' | 'success' | 'warning' | 'info' | 'accent';
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
};

const accentTones: Record<StatCardProps['accent'], string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  info: 'bg-info-bg text-info-text',
  accent: 'bg-accent-bg text-accent-text',
};

function StatCard({ label, value, hint, accent, Icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-primary p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-text-tertiary">{label}</p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${accentTones[accent]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="text-2xl text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const isLeadOrAdmin = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  const teamsQuery = trpc.teams.list.useQuery();
  const todayIso = new Date().toISOString().slice(0, 10);

  const ticketsQuery = trpc.tickets.list.useQuery({
    teamId: user?.teamId ?? undefined,
  });
  const standupsTodayQuery = trpc.standups.list.useQuery({
    teamId: user?.teamId ?? undefined,
    date: todayIso,
  });
  const pendingLeavesQuery = trpc.leaves.pending.useQuery(undefined, {
    enabled: !!isLeadOrAdmin,
  });

  const [teamFilter, setTeamFilter] = useState<string | 'all'>('all');

  const standupByUser = useMemo(() => {
    type Standup = NonNullable<typeof standupsTodayQuery.data>[number];
    const map = new Map<string, Standup>();
    for (const s of standupsTodayQuery.data ?? []) map.set(s.user.id, s);
    return map;
  }, [standupsTodayQuery.data]);

  const activeTicketsByUser = useMemo(() => {
    const map = new Map<string, NonNullable<typeof ticketsQuery.data>>();
    for (const t of ticketsQuery.data ?? []) {
      if (t.status !== 'IN_PROGRESS' && t.status !== 'IN_REVIEW') continue;
      for (const a of t.assignees) {
        const bucket = map.get(a.user.id) ?? [];
        bucket.push(t);
        map.set(a.user.id, bucket);
      }
    }
    return map;
  }, [ticketsQuery.data]);

  const firstName = user?.name?.split(' ')[0];

  const totalMembers = teamsQuery.data?.reduce((acc, t) => acc + t.members.length, 0) ?? 0;
  const availableMembers =
    teamsQuery.data?.reduce(
      (acc, t) => acc + t.members.filter((m) => m.availability === 'AVAILABLE').length,
      0
    ) ?? 0;
  const remoteMembers =
    teamsQuery.data?.reduce(
      (acc, t) => acc + t.members.filter((m) => m.availability === 'REMOTE').length,
      0
    ) ?? 0;
  const onLeaveMembers =
    teamsQuery.data?.reduce(
      (acc, t) => acc + t.members.filter((m) => m.availability === 'ON_LEAVE').length,
      0
    ) ?? 0;
  const inProgressCount =
    ticketsQuery.data?.filter((t) => t.status === 'IN_PROGRESS').length ?? 0;

  const totalStandups = standupsTodayQuery.data?.length ?? 0;
  const avgCapacity =
    totalStandups > 0
      ? Math.round(
          (standupsTodayQuery.data ?? []).reduce((sum, s) => sum + s.capacityPct, 0) /
            totalStandups
        )
      : null;

  const blockers = useMemo(() => {
    return (standupsTodayQuery.data ?? []).filter((s) => s.blockers && s.blockers.trim() !== '');
  }, [standupsTodayQuery.data]);

  const pendingLeaveCount = pendingLeavesQuery.data?.length ?? 0;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const allMembers = (teamsQuery.data ?? []).flatMap((team) =>
    team.members.map((m) => ({ ...m, teamId: team.id, teamName: team.name }))
  );

  const filteredMembers =
    teamFilter === 'all' ? allMembers : allMembers.filter((m) => m.teamId === teamFilter);

  return (
    <div className="mx-auto max-w-content">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
          <p className="mt-1 flex items-center gap-2 text-base text-text-secondary">
            <CalendarIcon className="h-3.5 w-3.5 text-text-tertiary" />
            {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          {avgCapacity !== null && (
            <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
              <ZapIcon className="h-3 w-3" />
              Avg capacity <span className="text-text-primary">{avgCapacity}%</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
            <TrendingUpIcon className="h-3 w-3" />
            {totalStandups}/{totalMembers} posted
          </span>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Teams"
          value={teamsQuery.data?.length ?? 0}
          hint={`${totalMembers} members total`}
          accent="brand"
          Icon={TeamsIcon}
        />
        <StatCard
          label="Available now"
          value={`${availableMembers}/${totalMembers}`}
          hint={remoteMembers > 0 ? `${remoteMembers} remote` : 'everyone on-site'}
          accent="success"
          Icon={CheckIcon}
        />
        <StatCard
          label="On leave"
          value={onLeaveMembers}
          hint={onLeaveMembers === 0 ? 'All hands on deck' : 'today'}
          accent="warning"
          Icon={PlaneIcon}
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          hint={`${ticketsQuery.data?.length ?? 0} tickets total`}
          accent="info"
          Icon={BriefcaseIcon}
        />
      </section>

      {/* Attention — blockers + pending approvals */}
      {(blockers.length > 0 || pendingLeaveCount > 0) && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2">
            <AlertIcon className="h-4 w-4 text-danger-text" />
            Needs attention
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {blockers.length > 0 && (
              <div className="rounded-lg border border-danger-text/20 bg-danger-bg/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-md text-danger-text">
                    {blockers.length} {blockers.length === 1 ? 'blocker' : 'blockers'} today
                  </span>
                </div>
                <div className="space-y-2">
                  {blockers.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openUser(s.user.id)}
                      className="flex w-full items-start gap-2 rounded border border-border bg-surface-primary p-2 text-left hover:bg-surface-secondary"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                        style={{
                          background: paletteFor(s.user.id).bg,
                          color: paletteFor(s.user.id).text,
                        }}
                      >
                        {s.user.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text-primary">{s.user.name}</div>
                        <div className="line-clamp-2 text-xs text-text-secondary">
                          {s.blockers}
                        </div>
                      </div>
                    </button>
                  ))}
                  {blockers.length > 3 && (
                    <p className="text-xs text-text-tertiary">
                      +{blockers.length - 3} more — see Standup feed
                    </p>
                  )}
                </div>
              </div>
            )}

            {pendingLeaveCount > 0 && (
              <a
                href="/admin/leaves"
                className="rounded-lg border border-warning-text/20 bg-warning-bg/40 p-4 no-underline hover:opacity-90"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-md text-warning-text">
                    {pendingLeaveCount} leave{' '}
                    {pendingLeaveCount === 1 ? 'request' : 'requests'} to review
                  </span>
                  <span className="text-xs text-warning-text">Review →</span>
                </div>
                <div className="space-y-1">
                  {(pendingLeavesQuery.data ?? []).slice(0, 3).map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between rounded border border-border bg-surface-primary p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                          style={{
                            background: paletteFor(leave.user.id).bg,
                            color: paletteFor(leave.user.id).text,
                          }}
                        >
                          {leave.user.initials}
                        </span>
                        <span className="text-sm text-text-primary">{leave.user.name}</span>
                      </div>
                      <span className="text-xs text-text-secondary">
                        {leave.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </a>
            )}
          </div>
        </section>
      )}

      {/* Team snapshot */}
      <section className="mb-6">
        <h2 className="mb-3">Teams</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teamsQuery.data?.map((team) => {
            const teamStandups = (standupsTodayQuery.data ?? []).filter(
              (s) => s.teamId === team.id
            );
            const avg =
              teamStandups.length > 0
                ? Math.round(
                    teamStandups.reduce((sum, s) => sum + s.capacityPct, 0) / teamStandups.length
                  )
                : null;
            const availCount = team.members.filter((m) => m.availability === 'AVAILABLE').length;
            const busyCount = team.members.filter((m) => m.availability === 'BUSY').length;
            const remoteCount = team.members.filter((m) => m.availability === 'REMOTE').length;
            const leaveCount = team.members.filter((m) => m.availability === 'ON_LEAVE').length;

            const active = teamFilter === team.id;
            return (
              <button
                key={team.id}
                onClick={() => setTeamFilter(active ? 'all' : team.id)}
                className={`rounded-lg border p-4 text-left transition-colors duration-fast ${
                  active
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-border bg-surface-primary hover:border-border-strong'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={active ? 'text-brand-600' : ''}>{team.name}</h3>
                  <span className="text-xs text-text-tertiary">
                    {team.members.length}
                  </span>
                </div>

                {/* Avatar stack */}
                <div className="mb-3 flex -space-x-1.5">
                  {team.members.slice(0, 5).map((m) => {
                    const palette = paletteFor(m.id);
                    return (
                      <span
                        key={m.id}
                        title={m.name}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-surface-primary"
                        style={{ background: palette.bg, color: palette.text }}
                      >
                        {m.initials}
                      </span>
                    );
                  })}
                  {team.members.length > 5 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-secondary text-[10px] text-text-tertiary ring-2 ring-surface-primary">
                      +{team.members.length - 5}
                    </span>
                  )}
                </div>

                {/* Availability breakdown */}
                <div className="mb-3 flex flex-wrap gap-1 text-xs text-text-tertiary">
                  {availCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.AVAILABLE}`} />
                      {availCount}
                    </span>
                  )}
                  {busyCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.BUSY}`} />
                      {busyCount}
                    </span>
                  )}
                  {remoteCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.REMOTE}`} />
                      {remoteCount}
                    </span>
                  )}
                  {leaveCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.ON_LEAVE}`} />
                      {leaveCount}
                    </span>
                  )}
                </div>

                {/* Capacity */}
                <div className="text-xs text-text-tertiary">
                  {avg !== null ? (
                    <CapacityBar pct={avg} thin />
                  ) : (
                    <span>No standups yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Members */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2>Who's working on what</h2>
          <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
            <button
              onClick={() => setTeamFilter('all')}
              className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                teamFilter === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            {teamsQuery.data?.map((t) => (
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
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => {
            const standup = standupByUser.get(member.id);
            const tickets = (activeTicketsByUser.get(member.id) ?? []) as NonNullable<
              typeof ticketsQuery.data
            >;
            const palette = paletteFor(member.id);
            return (
              <article
                key={member.id}
                className="flex flex-col rounded-lg border border-border bg-surface-primary p-4 transition-colors duration-fast hover:border-border-strong"
              >
                <header className="mb-3 flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openUser(member.id)}
                    className="-m-1 flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-surface-secondary"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
                      style={{ background: palette.bg, color: palette.text }}
                    >
                      {member.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-md text-text-primary">{member.name}</div>
                      <div className="truncate text-xs text-text-tertiary">{member.teamName}</div>
                    </div>
                  </button>
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] ${availabilityToneMap[member.availability]}`}
                  >
                    {member.availability.replace('_', ' ').toLowerCase()}
                  </span>
                </header>

                <div className="mb-3">
                  {standup ? (
                    <CapacityBar pct={standup.capacityPct} />
                  ) : member.availability === 'ON_LEAVE' ? (
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <PlaneIcon className="h-3 w-3" />
                      On leave
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <CalendarIcon className="h-3 w-3" />
                      No standup today
                    </div>
                  )}
                </div>

                {standup?.today && (
                  <p className="mb-3 line-clamp-2 text-sm text-text-secondary">{standup.today}</p>
                )}
                {standup?.blockers && (
                  <div className="mb-3 flex items-start gap-1.5 rounded border border-danger-text/20 bg-danger-bg p-2 text-xs text-danger-text">
                    <AlertIcon className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{standup.blockers}</span>
                  </div>
                )}

                <div className="mt-auto">
                  {tickets.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No open tickets</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                        <BriefcaseIcon className="h-3 w-3" />
                        {tickets.length} open
                      </p>
                      <ul className="space-y-1">
                        {tickets.slice(0, 3).map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center gap-2 rounded border border-border bg-surface-secondary px-2 py-1"
                          >
                            <span
                              className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] ${
                                t.source === 'JIRA'
                                  ? 'bg-info-bg text-info-text'
                                  : 'bg-neutral-bg text-neutral-text'
                              }`}
                            >
                              {t.jiraKey || `INT-${t.id.slice(-4)}`}
                            </span>
                            <span className="truncate text-xs text-text-primary" title={t.title}>
                              {t.title}
                            </span>
                          </li>
                        ))}
                        {tickets.length > 3 && (
                          <li className="text-xs text-text-tertiary">
                            +{tickets.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {filteredMembers.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
              No members in this filter.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
