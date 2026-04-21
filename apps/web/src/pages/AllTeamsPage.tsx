import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { APP_BRAND } from '../config/brand';
import {
  CheckIcon,
  MegaphoneIcon,
  PlusIcon,
  SendIcon,
  SpinnerIcon,
  TeamsIcon,
  ZapIcon,
} from '../components/icons';
import { useToast } from '../components/ui';

const availabilityTones: Record<string, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-danger-bg text-danger-text',
};

const avatarPalettes = [
  ['var(--avatar-1-bg)', 'var(--avatar-1-text)'],
  ['var(--avatar-2-bg)', 'var(--avatar-2-text)'],
  ['var(--avatar-3-bg)', 'var(--avatar-3-text)'],
  ['var(--avatar-4-bg)', 'var(--avatar-4-text)'],
  ['var(--avatar-5-bg)', 'var(--avatar-5-text)'],
  ['var(--avatar-6-bg)', 'var(--avatar-6-text)'],
];

const paletteFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

export function AllTeamsPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamChannel, setNewTeamChannel] = useState('');
  // Team whose Slack channel is currently being edited inline.
  const [editingChannelFor, setEditingChannelFor] = useState<string | null>(null);
  const [channelDraft, setChannelDraft] = useState('');

  const utils = trpc.useUtils();
  const toast = useToast();
  const teamsQuery = trpc.teams.list.useQuery();
  const todayIso = new Date().toISOString().slice(0, 10);
  const standupsTodayQuery = trpc.standups.list.useQuery({ date: todayIso });

  const teamCapacity = (teamId: string): { avg: number | null; posted: number } => {
    const teamStandups = (standupsTodayQuery.data ?? []).filter((s) => s.teamId === teamId);
    if (teamStandups.length === 0) return { avg: null, posted: 0 };
    return {
      avg: Math.round(
        teamStandups.reduce((sum, s) => sum + s.capacityPct, 0) / teamStandups.length
      ),
      posted: teamStandups.length,
    };
  };

  const capacityTone = (pct: number) =>
    pct >= 90 ? 'bg-capacity-full' : pct >= 70 ? 'bg-capacity-high' : 'bg-capacity-normal';
  const broadcastMutation = trpc.integrations.broadcastSlack.useMutation({
    onSuccess: (data) => {
      setBroadcastMsg('');
      toast.push({
        kind: 'success',
        title: 'Broadcast sent',
        message: `Delivered to ${data.channelCount} ${data.channelCount === 1 ? 'channel' : 'channels'}`,
      });
    },
    onError: (err) =>
      toast.push({ kind: 'error', title: 'Broadcast failed', message: err.message }),
  });
  const createTeamMutation = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      setShowCreateTeam(false);
      setNewTeamName('');
      setNewTeamChannel('');
      toast.push({ kind: 'success', title: 'Team created' });
    },
    onError: (err) =>
      toast.push({ kind: 'error', title: 'Create failed', message: err.message }),
  });

  const updateTeamMutation = trpc.teams.update.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      setEditingChannelFor(null);
      toast.push({ kind: 'success', title: 'Slack channel saved' });
    },
    onError: (err) =>
      toast.push({ kind: 'error', title: 'Save failed', message: err.message }),
  });

  const startEditChannel = (teamId: string, current: string | null) => {
    setEditingChannelFor(teamId);
    setChannelDraft(current ?? '');
  };

  // Accept either a raw channel ID or the full "Copy link" URL — users
  // paste whichever they happen to have on the clipboard. A Slack
  // channel link looks like https://<ws>.slack.com/archives/<ID>, and
  // the ID format is always a letter (C/G/D) followed by alphanumerics.
  const extractChannelId = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const urlMatch = trimmed.match(/\/archives\/([A-Z0-9]+)/i);
    if (urlMatch) return urlMatch[1]!.toUpperCase();
    const idMatch = trimmed.match(/^([CGD][A-Z0-9]{8,})$/i);
    if (idMatch) return idMatch[1]!.toUpperCase();
    return null;
  };

  const saveChannel = (teamId: string) => {
    const trimmed = channelDraft.trim();
    if (trimmed === '') {
      updateTeamMutation.mutate({ teamId, slackChannelId: null });
      return;
    }
    const id = extractChannelId(trimmed);
    if (!id) {
      toast.push({
        kind: 'error',
        title: 'Invalid channel',
        message: 'Paste a Slack channel URL or an ID starting with C/G/D.',
      });
      return;
    }
    updateTeamMutation.mutate({ teamId, slackChannelId: id });
  };

  const handleBroadcast = (e: FormEvent) => {
    e.preventDefault();
    broadcastMutation.mutate({ message: broadcastMsg });
  };

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1>All teams</h1>
          <p className="mt-1 text-base text-text-secondary">
            Team composition and live availability across {APP_BRAND}.
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowCreateTeam(true)}
            className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4" />
            New team
          </button>
        )}
      </header>

      {user?.role === 'ADMIN' && (
        <section className="mb-6 rounded-lg border border-border bg-surface-primary p-4">
          <div className="mb-2 flex items-center gap-2">
            <MegaphoneIcon className="h-4 w-4 text-brand-600" />
            <h2 className="text-md text-text-primary">Broadcast to all teams</h2>
          </div>
          <form onSubmit={handleBroadcast} className="flex gap-2">
            <input
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Type a message to send to all team Slack channels…"
              required
              className="min-h-input flex-1 rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
            <button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-4 text-base text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {broadcastMutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
              Send
            </button>
          </form>
          {broadcastMutation.data && (
            <div className="mt-2 flex items-center gap-2 text-xs text-success-text">
              <CheckIcon className="h-3.5 w-3.5" />
              Sent to {broadcastMutation.data.channelCount} channels
            </div>
          )}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamsQuery.data?.map((team) => {
          const cap = teamCapacity(team.id);
          return (
          <div key={team.id} className="rounded-lg border border-border bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <TeamsIcon className="h-4 w-4" />
                </span>
                <h3>{team.name}</h3>
              </div>
              <span className="text-xs text-text-tertiary">
                {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="mb-3 rounded border border-border bg-surface-secondary p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-text-tertiary">
                <span className="flex items-center gap-1">
                  <ZapIcon className="h-3 w-3" />
                  Team capacity
                </span>
                <span>{cap.posted}/{team.members.length} posted</span>
              </div>
              {cap.avg === null ? (
                <p className="text-xs text-text-tertiary">No standups today.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-primary">
                    <div className={`h-full ${capacityTone(cap.avg)}`} style={{ width: `${cap.avg}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-text-tertiary">{cap.avg}%</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {team.members.map((member) => {
                const [bg, text] = paletteFor(member.id);
                return (
                  <div key={member.id} className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => openUser(member.id)}
                      className="-m-1 flex items-center gap-2 rounded p-1 text-left transition-colors duration-fast hover:bg-surface-secondary"
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                        style={{ background: bg, color: text }}
                      >
                        {member.initials}
                      </span>
                      <span className="text-base text-text-primary">{member.name}</span>
                    </button>
                    <span className={`rounded-pill px-2 py-0.5 text-[10px] ${availabilityTones[member.availability]}`}>
                      {member.availability.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                );
              })}
              {team.members.length === 0 && (
                <p className="text-sm text-text-tertiary">No members</p>
              )}
            </div>

            <div className="mt-3 border-t border-border pt-3 text-xs text-text-tertiary">
              {team._count.tickets} {team._count.tickets === 1 ? 'ticket' : 'tickets'}
            </div>

            {user?.role === 'ADMIN' && (
              <div className="mt-2 border-t border-border pt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-text-tertiary">
                  <span>Slack channel</span>
                  {editingChannelFor !== team.id && (
                    <button
                      type="button"
                      onClick={() => startEditChannel(team.id, team.slackChannelId)}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      {team.slackChannelId ? 'Edit' : 'Set'}
                    </button>
                  )}
                </div>
                {editingChannelFor === team.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveChannel(team.id);
                    }}
                    className="flex gap-1"
                  >
                    <input
                      autoFocus
                      value={channelDraft}
                      onChange={(e) => setChannelDraft(e.target.value)}
                      placeholder="C0123ABCD or Slack channel URL"
                      className="min-h-input flex-1 rounded border border-border bg-surface-primary px-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary"
                    />
                    <button
                      type="submit"
                      disabled={updateTeamMutation.isPending}
                      className="min-h-input rounded bg-brand-600 px-2 text-xs text-white hover:bg-brand-800 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingChannelFor(null)}
                      className="min-h-input rounded px-2 text-xs text-text-secondary hover:bg-surface-secondary"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p className="font-mono text-xs text-text-secondary">
                    {team.slackChannelId ?? <span className="text-text-tertiary">— not set —</span>}
                  </p>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {showCreateTeam && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)]"
          onClick={() => setShowCreateTeam(false)}
        >
          <div
            className="w-full max-w-card rounded-lg bg-surface-primary p-5 shadow-float animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4">New team</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const extracted = extractChannelId(newTeamChannel);
                if (newTeamChannel.trim() !== '' && !extracted) {
                  toast.push({
                    kind: 'error',
                    title: 'Invalid channel',
                    message: 'Paste a Slack channel URL or an ID starting with C/G/D.',
                  });
                  return;
                }
                createTeamMutation.mutate({
                  name: newTeamName,
                  slackChannelId: extracted ?? undefined,
                });
              }}
              className="space-y-3"
            >
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                required
                autoFocus
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <div>
                <input
                  value={newTeamChannel}
                  onChange={(e) => setNewTeamChannel(e.target.value)}
                  placeholder="Slack channel ID (optional, e.g. C0123ABCD)"
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Right-click channel in Slack → Copy link → last path segment.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTeam(false)}
                  className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-input rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
