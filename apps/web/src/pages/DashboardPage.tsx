import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { useTeamDetail } from '../hooks/useTeamDetail';
import { usePersistedLocalState } from '../hooks/usePersistedState';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { trpc } from '../lib/trpc';
import type { Ticket } from '../features/tasks/types';

const TicketDetailModal = lazy(() =>
  import('../features/tasks/TicketDetailModal').then((m) => ({
    default: m.TicketDetailModal,
  })),
);
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

const availabilityEmojiMap: Record<string, string> = {
  REMOTE: '🏠',
  ON_LEAVE: '🌴',
};

// Renders an emoji for REMOTE/ON_LEAVE and a coloured dot for AVAILABLE/BUSY.
function AvailGlyph({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) {
  const emoji = availabilityEmojiMap[status];
  const fontSize = size === 'xs' ? '10px' : '12px';
  const dotSize = size === 'xs' ? 'h-1 w-1' : 'h-1.5 w-1.5';
  if (emoji) {
    return (
      <span className="inline-block leading-none" style={{ fontSize }}>
        {emoji}
      </span>
    );
  }
  return <span className={`inline-block rounded-full ${dotSize} ${availabilityDotMap[status]}`} />;
}

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

// Deterministic mock capacity per user — used when a standup hasn't been posted
// today. Gives every member a plausible-looking load % in the 45–95% range,
// stable across reloads so the UI never flickers between numbers.
const mockCapacity = (userId: string, availability: string): number => {
  if (availability === 'ON_LEAVE') return 0;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return 45 + (Math.abs(hash) % 50);
};

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
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
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

type MemberWithCapacity = {
  id: string;
  name: string;
  initials: string;
  availability: string;
  role?: string;
  capacity: number;
  capacityFromStandup: boolean;
};

type TeamStats = {
  id: string;
  name: string;
  memberCount: number;
  avail: number;
  busy: number;
  remote: number;
  leave: number;
  avgCapacity: number;
  standupsPosted: number;
  members: MemberWithCapacity[];
  lead?: MemberWithCapacity;
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
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  // Rect of the stat card that triggered the popover — drives the popover's
  // on-screen position so it lands under the card that was clicked.
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);

  const openFocusPopover = (
    next: Exclude<FocusFilter, null>,
    e: React.MouseEvent<HTMLElement>,
  ) => {
    if (focus === next) {
      setFocus(null);
      setPopoverAnchor(null);
      return;
    }
    setPopoverAnchor(e.currentTarget.getBoundingClientRect());
    setFocus(next);
  };

  const openTeamsPopover = (e: React.MouseEvent<HTMLElement>) => {
    setPopoverAnchor(e.currentTarget.getBoundingClientRect());
    setTeamsModalOpen(true);
  };

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

  // Look up each member's capacity %: use today's standup if posted, otherwise
  // fall back to a deterministic mock. Drives both per-dev and per-team numbers.
  const memberCapacity = (
    m: { id: string; availability: string },
  ): { capacity: number; capacityFromStandup: boolean } => {
    const standup = standupByUser.get(m.id);
    if (standup) return { capacity: standup.capacityPct, capacityFromStandup: true };
    return { capacity: mockCapacity(m.id, m.availability), capacityFromStandup: false };
  };

  // Pre-computed team stats used by the overview section.
  const teamStats: TeamStats[] = (teamsQuery.data ?? []).map((team) => {
    const standups = (standupsTodayQuery.data ?? []).filter((s) => s.teamId === team.id);
    const members: MemberWithCapacity[] = team.members.map((m) => ({
      ...m,
      ...memberCapacity(m),
    }));
    const avgCap =
      members.length > 0
        ? Math.round(members.reduce((sum, m) => sum + m.capacity, 0) / members.length)
        : 0;
    const lead = members.find((m) => m.role === 'TEAM_LEAD');
    return {
      id: team.id,
      name: team.name,
      memberCount: members.length,
      avail: members.filter((m) => m.availability === 'AVAILABLE').length,
      busy: members.filter((m) => m.availability === 'BUSY').length,
      remote: members.filter((m) => m.availability === 'REMOTE').length,
      leave: members.filter((m) => m.availability === 'ON_LEAVE').length,
      avgCapacity: avgCap,
      standupsPosted: standups.length,
      members,
      lead,
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
          onClick={openTeamsPopover}
          active={teamsModalOpen}
        />
        <StatCard
          label="Available now"
          value={`${availableMembers}/${totalMembers}`}
          hint={remoteMembers > 0 ? `${remoteMembers} remote` : 'everyone on-site'}
          accent="success"
          Icon={CheckIcon}
          active={focus === 'AVAILABLE'}
          onClick={(e) => openFocusPopover('AVAILABLE', e)}
        />
        <StatCard
          label="On leave"
          value={onLeaveMembers}
          hint={onLeaveMembers === 0 ? 'All hands on deck' : 'today'}
          accent="warning"
          Icon={PlaneIcon}
          active={focus === 'ON_LEAVE'}
          onClick={(e) => openFocusPopover('ON_LEAVE', e)}
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          hint={`${ticketsQuery.data?.length ?? 0} tickets total`}
          accent="info"
          Icon={BriefcaseIcon}
          active={focus === 'IN_PROGRESS'}
          onClick={(e) => openFocusPopover('IN_PROGRESS', e)}
        />
      </section>

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

        {/* Compact = concise 4-col cards */}
        {overviewView === 'compact' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamStats.map((t) => (
              <button
                key={t.id}
                onClick={() => openTeam(t.id)}
                className="rounded-lg border border-border bg-surface-primary p-4 text-left transition-colors duration-fast hover:border-brand-500"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
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
                      <AvailGlyph status="AVAILABLE" />
                      {t.avail} available
                    </span>
                  )}
                  {t.busy > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-2 py-0.5 text-[10px] text-warning-text">
                      <AvailGlyph status="BUSY" />
                      {t.busy} busy
                    </span>
                  )}
                  {t.remote > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-2 py-0.5 text-[10px] text-info-text">
                      <AvailGlyph status="REMOTE" />
                      {t.remote} remote
                    </span>
                  )}
                  {t.leave > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] text-danger-text">
                      <AvailGlyph status="ON_LEAVE" />
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
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                      <div
                        className={`h-full ${capacityTone(t.avgCapacity)}`}
                        style={{ width: `${t.avgCapacity}%` }}
                      />
                    </div>
                    <span className="tabular-nums">{t.avgCapacity}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Grid = larger 2-col cards with per-member capacity and team lead */}
        {overviewView === 'grid' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {teamStats.map((t) => (
              <article
                key={t.id}
                className="rounded-lg border border-border bg-surface-primary p-5 transition-colors duration-fast hover:border-border-strong"
              >
                <header className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <TeamsIcon className="h-4 w-4" />
                      </span>
                      <h3 className="truncate text-lg font-semibold">{t.name}</h3>
                      {t.isMyTeam && (
                        <span className="rounded-pill bg-brand-50 px-2 py-0.5 text-[10px] text-brand-600">
                          mine
                        </span>
                      )}
                    </div>
                    {t.lead && (
                      <button
                        onClick={() => openUser(t.lead!.id)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
                      >
                        <span className="uppercase text-[10px] tracking-wider">Lead</span>
                        <span className="text-text-secondary">·</span>
                        <span className="text-text-primary">{t.lead.name}</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => openTeam(t.id)}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-surface-primary px-2.5 text-xs text-text-secondary hover:border-brand-500 hover:text-text-primary"
                  >
                    Open team
                    <ArrowRightIcon className="h-3 w-3" />
                  </button>
                </header>

                {/* Headline: avg capacity big + standups / member count */}
                <div className="mb-4 flex items-end gap-4 rounded-md bg-surface-secondary p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Team capacity
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-text-primary">
                      {t.avgCapacity}%
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-primary">
                      <div
                        className={`h-full ${capacityTone(t.avgCapacity)}`}
                        style={{ width: `${t.avgCapacity}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-text-tertiary">
                      {t.standupsPosted}/{t.memberCount} posted standups today ·{' '}
                      {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {/* Availability breakdown */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {t.avail > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-2 py-0.5 text-[10px] text-success-text">
                      <AvailGlyph status="AVAILABLE" />
                      {t.avail} available
                    </span>
                  )}
                  {t.busy > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-2 py-0.5 text-[10px] text-warning-text">
                      <AvailGlyph status="BUSY" />
                      {t.busy} busy
                    </span>
                  )}
                  {t.remote > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-2 py-0.5 text-[10px] text-info-text">
                      <AvailGlyph status="REMOTE" />
                      {t.remote} remote
                    </span>
                  )}
                  {t.leave > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] text-danger-text">
                      <AvailGlyph status="ON_LEAVE" />
                      {t.leave} on leave
                    </span>
                  )}
                </div>

                {/* Per-member capacity list */}
                <ul className="space-y-1.5">
                  {t.members.map((m) => {
                    const p = paletteFor(m.id);
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => openUser(m.id)}
                          className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-surface-secondary"
                        >
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]"
                            style={{ background: p.bg, color: p.text }}
                          >
                            {m.initials}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                            {m.name}
                          </span>
                          <div className="flex w-28 shrink-0 items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                              <div
                                className={`h-full ${capacityTone(m.capacity)}`}
                                style={{ width: `${m.capacity}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[11px] tabular-nums text-text-tertiary">
                              {m.capacity}%
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}

        {/* Table = dense row-style list with more info */}
        {overviewView === 'table' && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-primary">
            <li className="hidden sm:flex items-center gap-3 bg-surface-secondary px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary">
              <span className="w-7" />
              <span className="flex-1">Team</span>
              <span className="w-[88px]">Lead</span>
              <span className="w-[140px]">Availability</span>
              <span className="w-[70px] text-right">Standups</span>
              <span className="w-[140px]">Capacity</span>
              <span className="w-3" />
            </li>
            {teamStats.map((t) => (
              <li
                key={t.id}
                onClick={() => openTeam(t.id)}
                className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-surface-secondary sm:flex-nowrap"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <TeamsIcon className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text-primary">{t.name}</span>
                  {t.isMyTeam && (
                    <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                      mine
                    </span>
                  )}
                  <div className="hidden items-center -space-x-1 lg:flex">
                    {t.members.slice(0, 4).map((m) => {
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
                    {t.memberCount > 4 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-secondary text-[9px] text-text-tertiary ring-2 ring-surface-primary">
                        +{t.memberCount - 4}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-[88px] shrink-0 truncate text-xs text-text-tertiary">
                  {t.lead ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUser(t.lead!.id);
                      }}
                      className="truncate text-text-secondary hover:text-text-primary hover:underline"
                    >
                      {t.lead.name.split(' ')[0]}
                    </button>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="flex w-[140px] shrink-0 flex-wrap gap-1">
                  {t.avail > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-1.5 py-0.5 text-[10px] text-success-text">
                      <AvailGlyph status="AVAILABLE" size="xs" />
                      {t.avail}
                    </span>
                  )}
                  {t.busy > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-bg px-1.5 py-0.5 text-[10px] text-warning-text">
                      <AvailGlyph status="BUSY" size="xs" />
                      {t.busy}
                    </span>
                  )}
                  {t.remote > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-info-bg px-1.5 py-0.5 text-[10px] text-info-text">
                      <AvailGlyph status="REMOTE" size="xs" />
                      {t.remote}
                    </span>
                  )}
                  {t.leave > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger-text">
                      <AvailGlyph status="ON_LEAVE" size="xs" />
                      {t.leave}
                    </span>
                  )}
                </div>
                <div className="w-[70px] shrink-0 text-right text-xs tabular-nums text-text-tertiary">
                  {t.standupsPosted}/{t.memberCount}
                </div>
                <div className="flex w-[140px] shrink-0 items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                    <div
                      className={`h-full ${capacityTone(t.avgCapacity)}`}
                      style={{ width: `${t.avgCapacity}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-text-tertiary">
                    {t.avgCapacity}%
                  </span>
                </div>
                <ArrowRightIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
              </li>
            ))}
          </ul>
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
                              onOpenTicket={(t) => setOpenTicket(t as Ticket)}
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

      {focus && (
        <PeopleModal
          focus={focus}
          teamStats={teamStats}
          activeTicketsByUser={activeTicketsByUser}
          anchor={popoverAnchor}
          onOpenUser={(id) => {
            setFocus(null);
            setPopoverAnchor(null);
            openUser(id);
          }}
          onClose={() => {
            setFocus(null);
            setPopoverAnchor(null);
          }}
        />
      )}

      {teamsModalOpen && (
        <TeamsModal
          teamStats={teamStats}
          anchor={popoverAnchor}
          onOpenTeam={(id) => {
            setTeamsModalOpen(false);
            setPopoverAnchor(null);
            openTeam(id);
          }}
          onClose={() => {
            setTeamsModalOpen(false);
            setPopoverAnchor(null);
          }}
        />
      )}

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

function ModalShell({
  title,
  subtitle,
  onClose,
  anchor,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  anchor?: DOMRect | null;
  children: React.ReactNode;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // When an anchor rect is passed, render as a popover positioned just
  // below the clicked element. The card that triggered the popover is
  // typically ~300px wide; we let the popover grow wider (min 360) but
  // keep the left edge aligned with the card and clamp to viewport.
  const popoverStyle: React.CSSProperties | undefined = anchor
    ? (() => {
        const width = Math.max(Math.min(anchor.width * 1.6, 440), 320);
        const left = Math.max(
          8,
          Math.min(anchor.left, window.innerWidth - width - 8),
        );
        return {
          position: 'fixed',
          top: anchor.bottom + 8,
          left,
          width,
          maxHeight: `calc(100vh - ${anchor.bottom + 24}px)`,
        };
      })()
    : undefined;

  return (
    <div ref={trapRef} className="fixed inset-0 z-modal" role="dialog" aria-modal="true">
      {/* Transparent capture layer — click outside the popover dismisses
          without dimming the rest of the page, so it feels like a native
          dropdown. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      {anchor ? (
        <div
          className="animate-fade-in flex flex-col overflow-hidden rounded-lg border border-border bg-surface-primary shadow-float"
          style={popoverStyle}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              {subtitle && <p className="truncate text-xs text-text-tertiary">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </header>
          {children}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-start justify-center bg-[var(--overlay-backdrop)] p-4 pt-16">
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-in relative flex w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface-primary shadow-float"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{title}</h2>
                {subtitle && <p className="truncate text-xs text-text-tertiary">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </header>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleModal({
  focus,
  teamStats,
  activeTicketsByUser,
  anchor,
  onOpenUser,
  onClose,
}: {
  focus: Exclude<FocusFilter, null>;
  teamStats: TeamStats[];
  activeTicketsByUser: Map<string, Array<{ id: string; title: string }>>;
  anchor?: DOMRect | null;
  onOpenUser: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const titleMap: Record<typeof focus, string> = {
    AVAILABLE: 'Available now',
    ON_LEAVE: 'On leave today',
    IN_PROGRESS: 'Working on tickets in progress',
  };

  const rows = teamStats
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
        })),
    )
    .sort((a, b) => {
      if (a.teamName !== b.teamName) return a.teamName.localeCompare(b.teamName);
      return a.name.localeCompare(b.name);
    });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.teamName.toLowerCase().includes(q) ||
          r.initials.toLowerCase().includes(q),
      )
    : rows;

  return (
    <ModalShell
      title={titleMap[focus]}
      subtitle={`${rows.length} ${rows.length === 1 ? 'person' : 'people'} across all teams`}
      anchor={anchor}
      onClose={onClose}
    >
      <div className="border-b border-border p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or team…"
          className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-tertiary"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-tertiary">
            {rows.length === 0
              ? 'Nobody matches this filter right now.'
              : `No one matches "${query}".`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m) => {
              const p = paletteFor(m.id);
              return (
                <li key={m.id}>
                  <button
                    onClick={() => onOpenUser(m.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-fast hover:bg-surface-secondary"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px]"
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
      </div>
    </ModalShell>
  );
}

function TeamsModal({
  teamStats,
  anchor,
  onOpenTeam,
  onClose,
}: {
  teamStats: TeamStats[];
  anchor?: DOMRect | null;
  onOpenTeam: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? teamStats.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.members.some((m) => m.name.toLowerCase().includes(q)),
      )
    : teamStats;

  return (
    <ModalShell
      title="Teams"
      subtitle={`${teamStats.length} team${teamStats.length === 1 ? '' : 's'}`}
      anchor={anchor}
      onClose={onClose}
    >
      <div className="border-b border-border p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams or members…"
          className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-tertiary"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-tertiary">
            No team matches "{query}".
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onOpenTeam(t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-secondary"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <TeamsIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">
                        {t.name}
                      </span>
                      {t.isMyTeam && (
                        <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                          mine
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-text-tertiary">
                      {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                      {t.lead ? ` · Lead ${t.lead.name.split(' ')[0]}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-pill bg-surface-secondary px-2 py-0.5 text-[11px] text-text-tertiary">
                      <ZapIcon className="h-3 w-3" />
                      <span className="tabular-nums">{t.avgCapacity}%</span>
                    </span>
                  </div>
                  <ArrowRightIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

function MemberCard({
  member,
  standup,
  tickets,
  onOpen,
  onOpenTicket,
}: {
  member: Member;
  standup?: Standup;
  tickets: TicketLite[];
  onOpen: () => void;
  onOpenTicket: (ticket: TicketLite) => void;
}) {
  const palette = paletteFor(member.id);
  const glyph = availabilityEmojiMap[member.availability];
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface-primary p-4 transition-colors duration-fast hover:border-border-strong">
      <header className="mb-3 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="-m-1 flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-surface-secondary"
        >
          <span className="relative shrink-0">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
              style={{ background: palette.bg, color: palette.text }}
            >
              {member.initials}
            </span>
            {glyph && (
              <span
                title={member.availability.toLowerCase().replace('_', ' ')}
                aria-label={member.availability.toLowerCase().replace('_', ' ')}
                className="pointer-events-none absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center text-[11px] leading-none"
              >
                {glyph}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-md font-medium text-text-primary">{member.name}</div>
          </div>
        </button>
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
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTicket(t)}
                    className="flex w-full items-center gap-2 rounded border border-border bg-surface-secondary px-2 py-1 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-primary"
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
                  </button>
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
