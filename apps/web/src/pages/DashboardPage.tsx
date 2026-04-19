import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { trpc } from '../lib/trpc';
import { AlertIcon, CalendarIcon, CheckIcon, PlaneIcon, ZapIcon } from '../components/icons';

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

function CapacityBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary">
        <div className={`h-full ${capacityTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-text-tertiary">{pct}%</span>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const teamsQuery = trpc.teams.list.useQuery();
  const todayIso = new Date().toISOString().slice(0, 10);

  const ticketsQuery = trpc.tickets.list.useQuery({
    teamId: user?.teamId ?? undefined,
  });
  const standupsTodayQuery = trpc.standups.list.useQuery({
    teamId: user?.teamId ?? undefined,
    date: todayIso,
  });

  const standupByUser = useMemo(() => {
    type Standup = NonNullable<typeof standupsTodayQuery.data>[number];
    const map = new Map<string, Standup>();
    for (const s of standupsTodayQuery.data ?? []) map.set(s.user.id, s);
    return map;
  }, [standupsTodayQuery.data]);

  const activeTicketsByUser = useMemo(() => {
    const map = new Map<string, typeof ticketsQuery.data>();
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
  const onLeaveMembers =
    teamsQuery.data?.reduce(
      (acc, t) => acc + t.members.filter((m) => m.availability === 'ON_LEAVE').length,
      0
    ) ?? 0;
  const inProgressCount =
    ticketsQuery.data?.filter((t) => t.status === 'IN_PROGRESS').length ?? 0;

  const stats = [
    { label: 'Teams', value: teamsQuery.data?.length ?? 0 },
    { label: 'Available now', value: `${availableMembers}/${totalMembers}` },
    { label: 'On leave', value: onLeaveMembers },
    { label: 'In progress', value: inProgressCount },
  ];

  const avgTeamCapacity = (teamId: string): number | null => {
    const teamStandups = (standupsTodayQuery.data ?? []).filter((s) => s.teamId === teamId);
    if (teamStandups.length === 0) return null;
    return Math.round(
      teamStandups.reduce((sum, s) => sum + s.capacityPct, 0) / teamStandups.length
    );
  };

  const allMembers = (teamsQuery.data ?? []).flatMap((team) =>
    team.members.map((m) => ({ ...m, teamId: team.id, teamName: team.name }))
  );

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
        <p className="mt-1 text-base text-text-secondary">
          Here's what's happening across your teams today.
        </p>
      </header>

      {/* Stats */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface-primary p-4">
            <p className="text-sm text-text-tertiary">{stat.label}</p>
            <p className="mt-2 text-2xl text-text-primary">{stat.value}</p>
          </div>
        ))}
      </section>

      {/* Team availability with capacity rollup */}
      <section className="mb-6">
        <h2 className="mb-3">Team availability</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamsQuery.data?.map((team) => {
            const avgCap = avgTeamCapacity(team.id);
            const postedCount = (standupsTodayQuery.data ?? []).filter(
              (s) => s.teamId === team.id
            ).length;
            return (
              <div key={team.id} className="rounded-lg border border-border bg-surface-primary p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3>{team.name}</h3>
                  <span className="text-xs text-text-tertiary">
                    {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {/* Capacity rollup */}
                <div className="mb-3 rounded border border-border bg-surface-secondary p-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <ZapIcon className="h-3 w-3" />
                      Team capacity
                    </span>
                    <span>
                      {postedCount}/{team.members.length} posted
                    </span>
                  </div>
                  {avgCap === null ? (
                    <p className="text-xs text-text-tertiary">No standups posted yet today.</p>
                  ) : (
                    <CapacityBar pct={avgCap} />
                  )}
                </div>

                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                          style={{
                            background: paletteFor(member.id).bg,
                            color: paletteFor(member.id).text,
                          }}
                        >
                          {member.initials}
                        </span>
                        <span className="text-base text-text-primary">{member.name}</span>
                      </div>
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs ${availabilityToneMap[member.availability]}`}
                      >
                        {member.availability.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  ))}
                  {team.members.length === 0 && (
                    <p className="text-sm text-text-tertiary">No members</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Who's working on what */}
      <section className="mb-6">
        <h2 className="mb-1">Who's working on what</h2>
        <p className="mb-3 text-sm text-text-tertiary">
          Each person's current load — today's standup and open tickets.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allMembers.map((member) => {
            const standup = standupByUser.get(member.id);
            const tickets = (activeTicketsByUser.get(member.id) ?? []) as NonNullable<
              typeof ticketsQuery.data
            >;
            const palette = paletteFor(member.id);
            return (
              <article
                key={member.id}
                className="flex flex-col rounded-lg border border-border bg-surface-primary p-4"
              >
                <header className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
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
                  </div>
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
                        <CheckIcon className="h-3 w-3" />
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
          {allMembers.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
              No team members yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
