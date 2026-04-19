import { useAuth } from '../hooks/useAuth';
import { trpc } from '../lib/trpc';

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
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length];
};

export function DashboardPage() {
  const { user } = useAuth();
  const teamsQuery = trpc.teams.list.useQuery();
  const ticketsQuery = trpc.tickets.list.useQuery({
    teamId: user?.teamId ?? undefined,
    status: 'IN_PROGRESS',
  });

  const firstName = user?.name?.split(' ')[0];

  const totalMembers =
    teamsQuery.data?.reduce((acc, t) => acc + t.members.length, 0) ?? 0;
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
  const activeTaskCount = ticketsQuery.data?.length ?? 0;

  const stats = [
    { label: 'Teams', value: teamsQuery.data?.length ?? 0 },
    { label: 'Available now', value: `${availableMembers}/${totalMembers}` },
    { label: 'On leave', value: onLeaveMembers },
    { label: 'Active tasks', value: activeTaskCount },
  ];

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
        <p className="mt-1 text-base text-text-secondary">
          Here's what's happening across your teams today.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-surface-primary p-4"
          >
            <p className="text-sm text-text-tertiary">{stat.label}</p>
            <p className="mt-2 text-2xl text-text-primary">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="mb-3">Team availability</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamsQuery.data?.map((team) => (
            <div
              key={team.id}
              className="rounded-lg border border-border bg-surface-primary p-4"
            >
              <h3 className="mb-3">{team.name}</h3>
              <div className="space-y-2">
                {team.members.map((member) => {
                  const palette = paletteFor(member.id);
                  return (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                          style={{ background: palette.bg, color: palette.text }}
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
                  );
                })}
                {team.members.length === 0 && (
                  <p className="text-sm text-text-tertiary">No members</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3">Active tasks</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
          {ticketsQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-text-tertiary">No tasks in progress</p>
          )}
          {ticketsQuery.data?.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between border-b border-border p-3 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 font-mono text-xs ${
                    ticket.source === 'JIRA'
                      ? 'bg-info-bg text-info-text'
                      : 'bg-neutral-bg text-neutral-text'
                  }`}
                >
                  {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
                </span>
                <span className="text-base text-text-primary">{ticket.title}</span>
              </div>
              <div className="flex -space-x-1">
                {ticket.assignees.map((a) => {
                  const palette = paletteFor(a.user.id);
                  return (
                    <span
                      key={a.user.id}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs ring-2 ring-surface-primary"
                      style={{ background: palette.bg, color: palette.text }}
                      title={a.user.name}
                    >
                      {a.user.initials}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
