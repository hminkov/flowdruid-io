import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { useTeamDetail } from '../hooks/useTeamDetail';
import { usePersistedLocalState } from '../hooks/usePersistedState';
import { trpc } from '../lib/trpc';
import {
  AlertIcon,
  ArrowRightIcon,
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChevronDownIcon,
  CheckIcon,
  PlaneIcon,
  TeamsIcon,
  TrendingUpIcon,
  XIcon,
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
  onClick?: () => void;
  active?: boolean;
};

const accentTones: Record<StatCardProps['accent'], string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  info: 'bg-info-bg text-info-text',
  accent: 'bg-accent-bg text-accent-text',
};

function StatCard({ label, value, hint, accent, Icon, onClick, active }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg border bg-surface-primary p-4 text-left transition-colors duration-fast ${
        active
          ? 'border-brand-500 ring-1 ring-brand-500/40'
          : 'border-border'
      } ${onClick ? 'hover:border-brand-500' : ''}`}
    >
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
    </Tag>
  );
}

type FocusFilter = 'AVAILABLE' | 'ON_LEAVE' | 'IN_PROGRESS' | null;

type OverviewView = 'compact' | 'grid' | 'table';

type TeamStats = {
  id: string;
  name: string;
  memberCount: number;
  avail: number;
  busy: number;
  remote: number;
  leave: number;
  avgCapacity: number | null;
  standupsPosted: number;
  members: Array<{ id: string; name: string; initials: string; availability: string }>;
  isMyTeam: boolean;
};

export function DashboardPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const { openTeam } = useTeamDetail();

  const teamsQuery = trpc.teams.list.useQuery();
  const todayIso = new Date().toISOString().slice(0, 10);

  const ticketsQuery = trpc.tickets.list.useQuery({
    teamId: user?.teamId ?? undefined,
  });
  const inboxPreviewQuery = trpc.notifications.list.useQuery({ filter: 'unread', limit: 3 });
  const standupsTodayQuery = trpc.standups.list.useQuery({
    teamId: user?.teamId ?? undefined,
    date: todayIso,
  });

  // Filter: 'my' (user's team), 'all', or a specific team id
  const [teamFilter, setTeamFilter] = useState<string>(user?.teamId ? 'my' : 'all');
  const [focus, setFocus] = useState<FocusFilter>(null);

  // Overview view mode — compact (dense one-liner), grid (cards), or table.
  const [overviewView, setOverviewView] = usePersistedLocalState<OverviewView>(
    'flowdruid-dashboard-overview-view',
    'grid'
  );

  // Per-team collapse state for the teams list below.
  const [collapsed, setCollapsed] = usePersistedLocalState<Record<string, boolean>>(
    'flowdruid-dashboard-team-collapsed',
    {}
  );
  const toggleTeam = (id: string) => setCollapsed({ ...collapsed, [id]: !collapsed[id] });

  // If user's teamId changes (e.g. after hydration), sync default
  useEffect(() => {
    if (user?.teamId && teamFilter === 'all') setTeamFilter('my');
  }, [user?.teamId]);

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

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const myTeamName = teamsQuery.data?.find((t) => t.id === user?.teamId)?.name;

  // Pre-computed team stats used by the overview section.
  const teamStats: TeamStats[] = (teamsQuery.data ?? []).map((team) => {
    const standups = (standupsTodayQuery.data ?? []).filter((s) => s.teamId === team.id);
    const avgCap =
      standups.length > 0
        ? Math.round(standups.reduce((sum, s) => sum + s.capacityPct, 0) / standups.length)
        : null;
    return {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      avail: team.members.filter((m) => m.availability === 'AVAILABLE').length,
      busy: team.members.filter((m) => m.availability === 'BUSY').length,
      remote: team.members.filter((m) => m.availability === 'REMOTE').length,
      leave: team.members.filter((m) => m.availability === 'ON_LEAVE').length,
      avgCapacity: avgCap,
      standupsPosted: standups.length,
      members: team.members,
      isMyTeam: team.id === user?.teamId,
    };
  });

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

      {/* Inbox preview */}
      {(inboxPreviewQuery.data?.length ?? 0) > 0 && (
        <section className="mb-6 rounded-lg border border-brand-500/30 bg-brand-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-md">
              <BellIcon className="h-4 w-4 text-brand-600" />
              Inbox
              <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-[10px] text-white">
                {inboxPreviewQuery.data?.length ?? 0} unread
              </span>
            </h2>
            <Link
              to="/inbox"
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              Open inbox
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-1.5">
            {inboxPreviewQuery.data?.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-2 rounded border border-border bg-surface-primary p-2"
              >
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{n.title}</p>
                  {n.body && (
                    <p className="truncate text-xs text-text-secondary">{n.body}</p>
                  )}
                </div>
                {n.linkPath && (
                  <Link
                    to={n.linkPath}
                    className="shrink-0 text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stats — click to filter the teams list below */}
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
          active={focus === 'AVAILABLE'}
          onClick={() => setFocus(focus === 'AVAILABLE' ? null : 'AVAILABLE')}
        />
        <StatCard
          label="On leave"
          value={onLeaveMembers}
          hint={onLeaveMembers === 0 ? 'All hands on deck' : 'today'}
          accent="warning"
          Icon={PlaneIcon}
          active={focus === 'ON_LEAVE'}
          onClick={() => setFocus(focus === 'ON_LEAVE' ? null : 'ON_LEAVE')}
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          hint={`${ticketsQuery.data?.length ?? 0} tickets total`}
          accent="info"
          Icon={BriefcaseIcon}
          active={focus === 'IN_PROGRESS'}
          onClick={() => setFocus(focus === 'IN_PROGRESS' ? null : 'IN_PROGRESS')}
        />
      </section>

      {/* Focus summary — opens when a stat card is clicked, flat list of matching people */}
      {focus && (
        <FocusSummary
          focus={focus}
          teams={teamsQuery.data ?? []}
          activeTicketsByUser={activeTicketsByUser}
          onOpenUser={openUser}
          onClose={() => setFocus(null)}
        />
      )}

      {/* Teams overview — compact / grid / table view of every team at a glance */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2>Teams overview</h2>
            <span className="text-xs text-text-tertiary">
              {teamStats.length} team{teamStats.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
            {(['compact', 'grid', 'table'] as OverviewView[]).map((v) => (
              <button
                key={v}
                onClick={() => setOverviewView(v)}
                className={`rounded-pill px-3 py-1 text-xs transition-colors duration-fast ${
                  overviewView === v
                    ? 'bg-brand-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {v === 'compact' ? 'Compact' : v === 'grid' ? 'Grid' : 'Table'}
              </button>
            ))}
          </div>
        </div>

        {overviewView === 'grid' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamStats.map((t) => (
              <button
                key={t.id}
                onClick={() => openTeam(t.id)}
                className="rounded-lg border border-border bg-surface-primary p-4 text-left transition-colors duration-fast hover:border-brand-500"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                      <TeamsIcon className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="truncate">{t.name}</h3>
                    {t.isMyTeam && (
                      <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                        mine
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary">{t.memberCount}</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {t.avail > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-2 py-0.5 text-[10px] text-success-text">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.AVAILABLE}`} />
                      {t.avail} available
                    </span>
                  )}
                  {t.busy > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-2 py-0.5 text-[10px] text-warning-text">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.BUSY}`} />
                      {t.busy} busy
                    </span>
                  )}
                  {t.remote > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-2 py-0.5 text-[10px] text-info-text">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.REMOTE}`} />
                      {t.remote} remote
                    </span>
                  )}
                  {t.leave > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] text-danger-text">
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.ON_LEAVE}`} />
                      {t.leave} on leave
                    </span>
                  )}
                </div>

                <div className="mb-3 flex -space-x-1.5">
                  {t.members.slice(0, 6).map((m) => {
                    const p = paletteFor(m.id);
                    return (
                      <span
                        key={m.id}
                        title={m.name}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-surface-primary"
                        style={{ background: p.bg, color: p.text }}
                      >
                        {m.initials}
                      </span>
                    );
                  })}
                  {t.memberCount > 6 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-secondary text-[10px] text-text-tertiary ring-2 ring-surface-primary">
                      +{t.memberCount - 6}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-text-tertiary">
                  <div className="flex items-center gap-1">
                    <ZapIcon className="h-3 w-3" />
                    <span>Capacity</span>
                  </div>
                  {t.avgCapacity !== null ? (
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                        <div
                          className={`h-full ${capacityTone(t.avgCapacity)}`}
                          style={{ width: `${t.avgCapacity}%` }}
                        />
                      </div>
                      <span>{t.avgCapacity}%</span>
                    </div>
                  ) : (
                    <span>No standups yet</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {overviewView === 'compact' && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-primary">
            {teamStats.map((t) => (
              <li
                key={t.id}
                onClick={() => openTeam(t.id)}
                className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 transition-colors duration-fast hover:bg-surface-secondary"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <TeamsIcon className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text-primary">{t.name}</span>
                  {t.isMyTeam && (
                    <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                      mine
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.avail > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-1.5 py-0.5 text-[10px] text-success-text">
                      <span className={`h-1 w-1 rounded-full ${availabilityDotMap.AVAILABLE}`} />
                      {t.avail}
                    </span>
                  )}
                  {t.busy > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-1.5 py-0.5 text-[10px] text-warning-text">
                      <span className={`h-1 w-1 rounded-full ${availabilityDotMap.BUSY}`} />
                      {t.busy}
                    </span>
                  )}
                  {t.remote > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-1.5 py-0.5 text-[10px] text-info-text">
                      <span className={`h-1 w-1 rounded-full ${availabilityDotMap.REMOTE}`} />
                      {t.remote}
                    </span>
                  )}
                  {t.leave > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger-text">
                      <span className={`h-1 w-1 rounded-full ${availabilityDotMap.ON_LEAVE}`} />
                      {t.leave}
                    </span>
                  )}
                </div>
                <div className="flex -space-x-1">
                  {t.members.slice(0, 5).map((m) => {
                    const p = paletteFor(m.id);
                    return (
                      <span
                        key={m.id}
                        title={m.name}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] ring-2 ring-surface-primary"
                        style={{ background: p.bg, color: p.text }}
                      >
                        {m.initials}
                      </span>
                    );
                  })}
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="tabular-nums">
                    {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                  </span>
                  {t.avgCapacity !== null ? (
                    <span className="flex items-center gap-1">
                      <ZapIcon className="h-3 w-3" />
                      <span className="tabular-nums">{t.avgCapacity}%</span>
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                  <ArrowRightIcon className="h-3 w-3" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {overviewView === 'table' && (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-primary">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr className="text-left text-xs text-text-tertiary">
                  <th className="p-3">Team</th>
                  <th className="p-3 text-right tabular-nums">Members</th>
                  <th className="p-3 text-right tabular-nums">Available</th>
                  <th className="p-3 text-right tabular-nums">Busy</th>
                  <th className="p-3 text-right tabular-nums">Remote</th>
                  <th className="p-3 text-right tabular-nums">On leave</th>
                  <th className="p-3 text-right tabular-nums">Standups</th>
                  <th className="p-3">Capacity</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTeam(t.id)}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-secondary"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                          <TeamsIcon className="h-3 w-3" />
                        </span>
                        <span className="font-medium text-text-primary">{t.name}</span>
                        {t.isMyTeam && (
                          <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                            mine
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums text-text-secondary">
                      {t.memberCount}
                    </td>
                    <td className="p-3 text-right tabular-nums text-success-text">
                      {t.avail || <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums text-warning-text">
                      {t.busy || <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums text-info-text">
                      {t.remote || <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums text-danger-text">
                      {t.leave || <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums text-text-secondary">
                      {t.standupsPosted}/{t.memberCount}
                    </td>
                    <td className="p-3">
                      {t.avgCapacity !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-secondary">
                            <div
                              className={`h-full ${capacityTone(t.avgCapacity)}`}
                              style={{ width: `${t.avgCapacity}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-text-tertiary">
                            {t.avgCapacity}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">No standups yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Unified Teams section — expandable team panels with inline members */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2>Who's working on what</h2>
            <span className="text-xs text-text-tertiary">
              Expand a team to see its members, standups, and open tickets
            </span>
          </div>
          <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
            {user?.teamId && (
              <button
                onClick={() => setTeamFilter('my')}
                className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                  teamFilter === 'my'
                    ? 'bg-brand-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                My team
                {myTeamName ? ` (${myTeamName})` : ''}
              </button>
            )}
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
            {teamsQuery.data
              ?.filter((t) => t.id !== user?.teamId)
              .map((t) => (
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

        <div className="space-y-3">
          {(teamsQuery.data ?? [])
            .filter((t) => {
              if (teamFilter === 'all') return true;
              if (teamFilter === 'my') return t.id === user?.teamId;
              return t.id === teamFilter;
            })
            .map((team) => {
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
              const isMyTeam = team.id === user?.teamId;
              const members = team.members;

              const open = !collapsed[team.id];

              return (
                <article
                  key={team.id}
                  className="overflow-hidden rounded-lg border border-border bg-surface-primary"
                >
                  <div
                    onClick={() => toggleTeam(team.id)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 bg-surface-secondary p-4 transition-colors duration-fast hover:bg-surface-tertiary"
                  >
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-fast ${
                        open ? '' : '-rotate-90'
                      }`}
                    />
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                      <TeamsIcon className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{team.name}</h3>
                      {isMyTeam && (
                        <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                          mine
                        </span>
                      )}
                    </div>

                    {/* Availability breakdown */}
                    <div className="flex flex-wrap gap-1.5">
                      {availCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-2 py-0.5 text-[10px] text-success-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.AVAILABLE}`} />
                          {availCount} available
                        </span>
                      )}
                      {busyCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-2 py-0.5 text-[10px] text-warning-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.BUSY}`} />
                          {busyCount} busy
                        </span>
                      )}
                      {remoteCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-2 py-0.5 text-[10px] text-info-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.REMOTE}`} />
                          {remoteCount} remote
                        </span>
                      )}
                      {leaveCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] text-danger-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotMap.ON_LEAVE}`} />
                          {leaveCount} on leave
                        </span>
                      )}
                    </div>

                    {/* Avatar stack */}
                    <div className="flex -space-x-1.5">
                      {team.members.slice(0, 6).map((m) => {
                        const palette = paletteFor(m.id);
                        return (
                          <span
                            key={m.id}
                            title={m.name}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-surface-secondary"
                            style={{ background: palette.bg, color: palette.text }}
                          >
                            {m.initials}
                          </span>
                        );
                      })}
                      {team.members.length > 6 && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-primary text-[10px] text-text-tertiary ring-2 ring-surface-secondary">
                          +{team.members.length - 6}
                        </span>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                      {/* Capacity summary */}
                      {avg !== null && (
                        <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                          <ZapIcon className="h-3 w-3" />
                          <span className="tabular-nums">{avg}%</span>
                        </span>
                      )}
                      <span className="text-xs text-text-tertiary tabular-nums">
                        {team.members.length} member{team.members.length === 1 ? '' : 's'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTeam(team.id);
                        }}
                        className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-primary px-2.5 text-xs text-text-secondary hover:border-brand-500 hover:text-text-primary"
                      >
                        Open team
                        <ArrowRightIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="p-4">
                      {members.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border bg-surface-secondary p-6 text-center text-sm text-text-tertiary">
                          This team has no members yet.
                        </p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {members.map((member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              standup={standupByUser.get(member.id)}
                              tickets={(activeTicketsByUser.get(member.id) ?? []) as NonNullable<
                                typeof ticketsQuery.data
                              >}
                              onOpen={() => openUser(member.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

          {teamsQuery.data?.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
              No teams yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type Member = {
  id: string;
  name: string;
  initials: string;
  availability: string;
};

type Standup = {
  capacityPct: number;
  today: string;
  blockers?: string | null;
};

type TicketLite = {
  id: string;
  title: string;
  source: string;
  jiraKey?: string | null;
};

function FocusSummary({
  focus,
  teams,
  activeTicketsByUser,
  onOpenUser,
  onClose,
}: {
  focus: Exclude<FocusFilter, null>;
  teams: Array<{
    id: string;
    name: string;
    members: Array<{ id: string; name: string; initials: string; availability: string }>;
  }>;
  activeTicketsByUser: Map<string, Array<{ id: string; title: string }>>;
  onOpenUser: (id: string) => void;
  onClose: () => void;
}) {
  const titleMap: Record<typeof focus, string> = {
    AVAILABLE: 'Available now',
    ON_LEAVE: 'On leave today',
    IN_PROGRESS: 'Working on tickets in progress',
  };
  const accentMap: Record<typeof focus, string> = {
    AVAILABLE: 'border-success-text/30 bg-success-bg/40',
    ON_LEAVE: 'border-danger-text/30 bg-danger-bg/40',
    IN_PROGRESS: 'border-info-text/30 bg-info-bg/40',
  };
  const pillMap: Record<typeof focus, string> = {
    AVAILABLE: 'bg-success-text text-white',
    ON_LEAVE: 'bg-danger-text text-white',
    IN_PROGRESS: 'bg-info-text text-white',
  };

  // Collect matching members across all teams, sorted by team name then member name.
  const rows = teams
    .flatMap((team) =>
      team.members
        .filter((m) => {
          if (focus === 'AVAILABLE') return m.availability === 'AVAILABLE';
          if (focus === 'ON_LEAVE') return m.availability === 'ON_LEAVE';
          return (activeTicketsByUser.get(m.id)?.length ?? 0) > 0;
        })
        .map((m) => ({
          ...m,
          teamId: team.id,
          teamName: team.name,
          ticketCount: activeTicketsByUser.get(m.id)?.length ?? 0,
        }))
    )
    .sort((a, b) => {
      if (a.teamName !== b.teamName) return a.teamName.localeCompare(b.teamName);
      return a.name.localeCompare(b.name);
    });

  return (
    <section
      className={`mb-6 overflow-hidden rounded-lg border ${accentMap[focus]} animate-modal-in`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${pillMap[focus]}`}>
            {titleMap[focus]}
          </span>
          <span className="text-sm text-text-secondary">
            {rows.length} {rows.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close summary"
          className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-text-tertiary">
          Nobody matches this filter right now.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((m) => {
            const p = paletteFor(m.id);
            return (
              <li key={m.id}>
                <button
                  onClick={() => onOpenUser(m.id)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast hover:bg-surface-primary/60"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]"
                    style={{ background: p.bg, color: p.text }}
                  >
                    {m.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-primary">{m.name}</div>
                    <div className="truncate text-xs text-text-tertiary">{m.teamName}</div>
                  </div>
                  {focus === 'IN_PROGRESS' && (
                    <span className="flex items-center gap-1 rounded-pill bg-info-bg px-2 py-0.5 text-[11px] text-info-text">
                      <BriefcaseIcon className="h-3 w-3" />
                      {m.ticketCount}
                    </span>
                  )}
                  <ArrowRightIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MemberCard({
  member,
  standup,
  tickets,
  onOpen,
}: {
  member: Member;
  standup?: Standup;
  tickets: TicketLite[];
  onOpen: () => void;
}) {
  const palette = paletteFor(member.id);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface-primary p-4 transition-colors duration-fast hover:border-border-strong">
      <header className="mb-3 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="-m-1 flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-surface-secondary"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
            style={{ background: palette.bg, color: palette.text }}
          >
            {member.initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-md font-medium text-text-primary">{member.name}</div>
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
                <li className="text-xs text-text-tertiary">+{tickets.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
