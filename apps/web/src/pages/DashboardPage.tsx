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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Team Availability */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Team Availability</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teamsQuery.data?.map((team) => (
            <div key={team.id} className="rounded-lg border bg-white p-4 shadow-sm">
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
        <h2 className="mb-3 text-lg font-semibold">Active Tasks</h2>
        <div className="rounded-lg border bg-white shadow-sm">
          {ticketsQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-gray-400">No tasks in progress</p>
          )}
          {ticketsQuery.data?.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between border-b p-4 last:border-b-0">
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
