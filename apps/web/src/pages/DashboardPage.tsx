import { useAuth } from '../hooks/useAuth';
import { trpc } from '../lib/trpc';

const availabilityColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  BUSY: 'bg-amber-100 text-amber-800',
  REMOTE: 'bg-blue-100 text-blue-800',
  ON_LEAVE: 'bg-red-100 text-red-800',
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
    {
      label: 'Teams',
      value: teamsQuery.data?.length ?? 0,
      accent: 'from-primary-500 to-primary-700',
      iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    },
    {
      label: 'Available Now',
      value: `${availableMembers}/${totalMembers}`,
      accent: 'from-emerald-500 to-emerald-700',
      iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
    },
    {
      label: 'On Leave',
      value: onLeaveMembers,
      accent: 'from-amber-500 to-amber-700',
      iconPath: 'M3 4h18M8 4V2M16 4V2M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    },
    {
      label: 'Active Tasks',
      value: activeTaskCount,
      accent: 'from-blue-500 to-blue-700',
      iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {firstName ? `Welcome back, ${firstName} 👋` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening across your teams today.
        </p>
      </header>

      {/* Stats */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div
              className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${stat.accent} opacity-10`}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.accent} text-white shadow`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d={stat.iconPath} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Team Availability */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Team Availability</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teamsQuery.data?.map((team) => (
            <div key={team.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md">
              <h3 className="mb-3 font-medium">{team.name}</h3>
              <div className="space-y-2">
                {team.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                        {member.initials}
                      </span>
                      <span className="text-sm">{member.name}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${availabilityColors[member.availability]}`}>
                      {member.availability.replace('_', ' ')}
                    </span>
                  </div>
                ))}
                {team.members.length === 0 && (
                  <p className="text-sm text-gray-400">No members</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Active Tasks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Active Tasks</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {ticketsQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-gray-400">No tasks in progress</p>
          )}
          {ticketsQuery.data?.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between border-b border-gray-100 p-4 transition last:border-b-0 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs font-mono font-medium ${
                  ticket.source === 'JIRA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
                </span>
                <span className="text-sm">{ticket.title}</span>
              </div>
              <div className="flex -space-x-1">
                {ticket.assignees.map((a) => (
                  <span
                    key={a.user.id}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700 ring-2 ring-white"
                    title={a.user.name}
                  >
                    {a.user.initials}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
