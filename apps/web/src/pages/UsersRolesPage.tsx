import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';

export function UsersRolesPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [role, setRole] = useState<'DEVELOPER' | 'TEAM_LEAD' | 'ADMIN'>('DEVELOPER');
  const [teamId, setTeamId] = useState('');
  const [tempPass, setTempPass] = useState('');

  const utils = trpc.useUtils();
  const usersQuery = trpc.users.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();
  const inviteMutation = trpc.users.invite.useMutation({
    onSuccess: (data) => {
      setTempPass(data.tempPassword);
      utils.users.list.invalidate();
    },
  });
  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });
  const deactivateMutation = trpc.users.deactivate.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      email,
      name,
      initials: initials.toUpperCase(),
      role,
      teamId: teamId || undefined,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <button
          onClick={() => { setShowInvite(true); setTempPass(''); }}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Invite User
        </button>
      </div>

      {/* Users table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3 text-left font-medium text-gray-600">Name</th>
              <th className="p-3 text-left font-medium text-gray-600">Email</th>
              <th className="p-3 text-left font-medium text-gray-600">Role</th>
              <th className="p-3 text-left font-medium text-gray-600">Team</th>
              <th className="p-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data?.map((u) => (
              <tr key={u.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {u.initials}
                    </span>
                    {u.name}
                  </div>
                </td>
                <td className="p-3 text-gray-500">{u.email}</td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      updateMutation.mutate({
                        userId: u.id,
                        role: e.target.value as 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER',
                      })
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={u.teamId ?? ''}
                    onChange={(e) =>
                      updateMutation.mutate({
                        userId: u.id,
                        teamId: e.target.value || null,
                      })
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="">No team</option>
                    {teamsQuery.data?.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => deactivateMutation.mutate({ userId: u.id })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Invite User</h2>
            {tempPass ? (
              <div>
                <p className="mb-2 text-sm">User created. Temporary password:</p>
                <code className="block rounded bg-gray-100 p-3 text-sm font-mono">{tempPass}</code>
                <button
                  onClick={() => { setShowInvite(false); setEmail(''); setName(''); setInitials(''); }}
                  className="mt-4 rounded bg-primary-600 px-3 py-1.5 text-sm text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required className="w-full rounded border px-3 py-2 text-sm" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required className="w-full rounded border px-3 py-2 text-sm" />
                <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="Initials (e.g. JD)" maxLength={3} required className="w-full rounded border px-3 py-2 text-sm" />
                <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-full rounded border px-3 py-2 text-sm">
                  <option value="DEVELOPER">Developer</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                  <option value="">No team</option>
                  {teamsQuery.data?.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowInvite(false)} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                  <button type="submit" className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Invite</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
