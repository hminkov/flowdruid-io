import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import {
  CheckIcon,
  KeyIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
} from '../components/icons';
import { useConfirm, useToast } from '../components/ui';

const roleTones: Record<string, string> = {
  ADMIN: 'bg-accent-bg text-accent-text',
  TEAM_LEAD: 'bg-info-bg text-info-text',
  DEVELOPER: 'bg-neutral-bg text-neutral-text',
};

const roleIcon = (r: string) => (r === 'ADMIN' ? ShieldIcon : r === 'TEAM_LEAD' ? KeyIcon : UserIcon);

export function UsersRolesPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [role, setRole] = useState<'DEVELOPER' | 'TEAM_LEAD' | 'ADMIN'>('DEVELOPER');
  const [teamId, setTeamId] = useState('');
  const [tempPass, setTempPass] = useState('');

  const utils = trpc.useUtils();
  const toast = useToast();
  const confirm = useConfirm();
  const usersQuery = trpc.users.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();
  const inviteMutation = trpc.users.invite.useMutation({
    onSuccess: (data) => {
      setTempPass(data.tempPassword);
      utils.users.list.invalidate();
      toast.push({ kind: 'success', title: 'User invited' });
    },
    onError: (e) => toast.push({ kind: 'error', title: 'Invite failed', message: e.message }),
  });
  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.push({ kind: 'success', title: 'User updated' });
    },
    onError: (e) => toast.push({ kind: 'error', title: 'Update failed', message: e.message }),
  });
  const deactivateMutation = trpc.users.deactivate.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.push({ kind: 'success', title: 'User deactivated' });
    },
    onError: (e) => toast.push({ kind: 'error', title: 'Deactivation failed', message: e.message }),
  });

  const handleDeactivate = async (userId: string, userName: string) => {
    const ok = await confirm({
      title: `Deactivate ${userName}?`,
      message:
        "They won't be able to log in. Their tickets, standups, and history stay intact.",
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (ok) deactivateMutation.mutate({ userId });
  };

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
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1>Users & roles</h1>
          <p className="mt-1 text-base text-text-secondary">
            Manage members, roles, and team assignments.
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setTempPass(''); }}
          className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98]"
        >
          <PlusIcon className="h-4 w-4" />
          Invite user
        </button>
      </header>

      {/* Desktop table ≥ md — same layout as before */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface-primary md:block">
        <table className="w-full text-base">
          <thead className="border-b border-border bg-surface-secondary">
            <tr>
              <th className="p-3 text-left text-sm text-text-tertiary">Name</th>
              <th className="p-3 text-left text-sm text-text-tertiary">Email</th>
              <th className="p-3 text-left text-sm text-text-tertiary">Role</th>
              <th className="p-3 text-left text-sm text-text-tertiary">Team</th>
              <th className="p-3 text-left text-sm text-text-tertiary"></th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data?.map((u) => {
              const RoleIcon = roleIcon(u.role);
              return (
                <tr key={u.id} className="border-b border-border last:border-b-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
                        {u.initials}
                      </span>
                      <span className="text-text-primary">{u.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-text-secondary">{u.email}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${roleTones[u.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                      </span>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateMutation.mutate({
                            userId: u.id,
                            role: e.target.value as 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER',
                          })
                        }
                        className="rounded border border-border bg-surface-primary px-2 py-1 text-sm text-text-primary"
                      >
                        <option value="DEVELOPER">Developer</option>
                        <option value="TEAM_LEAD">Team lead</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
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
                      className="rounded border border-border bg-surface-primary px-2 py-1 text-sm text-text-primary"
                    >
                      <option value="">No team</option>
                      {teamsQuery.data?.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDeactivate(u.id, u.name)}
                      title="Deactivate"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-danger-bg hover:text-danger-text"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards < md */}
      <div className="space-y-2 md:hidden">
        {usersQuery.data?.map((u) => {
          const RoleIcon = roleIcon(u.role);
          return (
            <div key={u.id} className="rounded-lg border border-border bg-surface-primary p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
                    {u.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text-primary">{u.name}</div>
                    <div className="truncate text-xs text-text-tertiary">{u.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeactivate(u.id, u.name)}
                  title="Deactivate"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-danger-bg hover:text-danger-text"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center gap-2 text-xs text-text-tertiary">
                  <span className="w-12 shrink-0">Role</span>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${roleTones[u.role]}`}>
                    <RoleIcon className="h-3 w-3" />
                  </span>
                  <select
                    value={u.role}
                    onChange={(e) =>
                      updateMutation.mutate({
                        userId: u.id,
                        role: e.target.value as 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER',
                      })
                    }
                    className="min-h-input flex-1 rounded border border-border bg-surface-primary px-2 text-sm text-text-primary"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="TEAM_LEAD">Team lead</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-text-tertiary">
                  <span className="w-12 shrink-0">Team</span>
                  <select
                    value={u.teamId ?? ''}
                    onChange={(e) =>
                      updateMutation.mutate({
                        userId: u.id,
                        teamId: e.target.value || null,
                      })
                    }
                    className="min-h-input flex-1 rounded border border-border bg-surface-primary px-2 text-sm text-text-primary"
                  >
                    <option value="">No team</option>
                    {teamsQuery.data?.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {showInvite && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)]"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="w-full max-w-modal rounded-lg bg-surface-primary p-5 shadow-float animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4">Invite user</h2>
            {tempPass ? (
              <div>
                <div className="mb-3 flex items-center gap-2 rounded border border-success-text/20 bg-success-bg p-2 text-sm text-success-text">
                  <CheckIcon className="h-4 w-4" />
                  User created. Share the temporary password with them.
                </div>
                <code className="block rounded border border-border bg-surface-secondary p-3 font-mono text-base text-text-primary">
                  {tempPass}
                </code>
                <button
                  onClick={() => { setShowInvite(false); setEmail(''); setName(''); setInitials(''); }}
                  className="mt-4 min-h-input rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                  autoFocus
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@cloudruid.com"
                  required
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
                />
                <input
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  placeholder="Initials (e.g. JD)"
                  maxLength={3}
                  required
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
                >
                  <option value="DEVELOPER">Developer</option>
                  <option value="TEAM_LEAD">Team lead</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
                >
                  <option value="">No team</option>
                  {teamsQuery.data?.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-input rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800"
                  >
                    Invite
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
