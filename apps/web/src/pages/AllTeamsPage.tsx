import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';

const availabilityColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  BUSY: 'bg-amber-100 text-amber-800',
  REMOTE: 'bg-blue-100 text-blue-800',
  ON_LEAVE: 'bg-red-100 text-red-800',
};

export function AllTeamsPage() {
  const { user } = useAuth();
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const utils = trpc.useUtils();
  const teamsQuery = trpc.teams.list.useQuery();
  const broadcastMutation = trpc.integrations.broadcastSlack.useMutation({
    onSuccess: () => setBroadcastMsg(''),
  });
  const createTeamMutation = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      setShowCreateTeam(false);
      setNewTeamName('');
    },
  });

  const handleBroadcast = (e: FormEvent) => {
    e.preventDefault();
    broadcastMutation.mutate({ message: broadcastMsg });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Teams</h1>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowCreateTeam(true)}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            New Team
          </button>
        )}
      </div>

      {/* Broadcast box — admin only */}
      {user?.role === 'ADMIN' && (
        <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Broadcast to All Teams</h2>
          <form onSubmit={handleBroadcast} className="flex gap-2">
            <input
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Type a message to send to all team channels..."
              required
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Send to all
            </button>
          </form>
          {broadcastMutation.data && (
            <p className="mt-2 text-xs text-green-600">
              Sent to {broadcastMutation.data.channelCount} channels
            </p>
          )}
        </div>
      )}

      {/* Teams grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamsQuery.data?.map((team) => (
          <div key={team.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{team.name}</h3>
              <span className="text-xs text-gray-400">{team.members.length} members</span>
            </div>
            <div className="space-y-2">
              {team.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-medium text-brand-800">
                      {member.initials}
                    </span>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${availabilityColors[member.availability]}`}>
                    {member.availability.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {team._count.tickets} tickets
            </div>
          </div>
        ))}
      </div>

      {/* Create team modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Team</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTeamMutation.mutate({ name: newTeamName });
              }}
              className="space-y-3"
            >
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                required
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateTeam(false)} className="rounded px-3 py-1.5 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
