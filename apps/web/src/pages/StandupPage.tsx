import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { AlertIcon, MegaphoneIcon, SendIcon, SpinnerIcon, ZapIcon } from '../components/icons';

export function StandupPage() {
  const { user } = useAuth();
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [capacityPct, setCapacityPct] = useState(50);

  const utils = trpc.useUtils();
  const todayStandup = trpc.standups.today.useQuery();
  const standupsQuery = trpc.standups.list.useQuery({
    teamId: user?.teamId ?? undefined,
    date: new Date().toISOString().slice(0, 10),
  });

  const postMutation = trpc.standups.post.useMutation({
    onSuccess: () => {
      utils.standups.today.invalidate();
      utils.standups.list.invalidate();
      setYesterday('');
      setToday('');
      setBlockers('');
      setCapacityPct(50);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!user?.teamId) return;
    postMutation.mutate({ teamId: user.teamId, yesterday, today, blockers: blockers || undefined, capacityPct });
  };

  const capacityTone = (pct: number) =>
    pct >= 90 ? 'bg-capacity-full' : pct >= 70 ? 'bg-capacity-high' : 'bg-capacity-normal';

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1>Standup</h1>
        <p className="mt-1 text-base text-text-secondary">
          Share yesterday, today, and anything blocking you.
        </p>
      </header>

      <div className="mb-8 rounded-lg border border-border bg-surface-primary p-6">
        <div className="mb-4 flex items-center gap-2">
          <MegaphoneIcon className="h-4 w-4 text-brand-600" />
          <h2>{todayStandup.data ? 'Update your standup' : 'Post your standup'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Yesterday</label>
            <textarea
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              required
              rows={2}
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              placeholder="What did you work on yesterday?"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Today</label>
            <textarea
              value={today}
              onChange={(e) => setToday(e.target.value)}
              required
              rows={2}
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              placeholder="What will you work on today?"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm text-text-secondary">
              <AlertIcon className="h-3.5 w-3.5 text-danger-text" />
              Blockers
            </label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={2}
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              placeholder="Any blockers? (optional)"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm text-text-secondary">
              <ZapIcon className="h-3.5 w-3.5" />
              Capacity: <span className="text-text-primary">{capacityPct}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={capacityPct}
              onChange={(e) => setCapacityPct(Number(e.target.value))}
              className="range-slider"
            />
          </div>

          <button
            type="submit"
            disabled={postMutation.isPending}
            className="flex min-h-input items-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
          >
            {postMutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
            {postMutation.isPending ? 'Posting…' : 'Post standup'}
          </button>
        </form>
      </div>

      <h2 className="mb-3">Today's standups</h2>
      <div className="space-y-3">
        {standupsQuery.data?.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
                  {s.user.initials}
                </span>
                <span className="text-md text-text-primary">{s.user.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-secondary">
                  <div className={`h-full ${capacityTone(s.capacityPct)}`} style={{ width: `${s.capacityPct}%` }} />
                </div>
                <span className="text-xs text-text-tertiary">{s.capacityPct}%</span>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-text-tertiary">Today:</span> <span className="text-text-primary">{s.today}</span></p>
              <p><span className="text-text-tertiary">Yesterday:</span> <span className="text-text-secondary">{s.yesterday}</span></p>
              {s.blockers && (
                <div className="mt-2 flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-danger-text">
                  <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{s.blockers}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {standupsQuery.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
            No standups posted yet today.
          </div>
        )}
      </div>
    </div>
  );
}
