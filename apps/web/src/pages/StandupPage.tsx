import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';

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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Standup</h1>

      {/* Post form */}
      <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {todayStandup.data ? 'Update your standup' : 'Post your standup'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Yesterday</label>
            <textarea
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              required
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="What did you work on yesterday?"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Today</label>
            <textarea
              value={today}
              onChange={(e) => setToday(e.target.value)}
              required
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="What will you work on today?"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Blockers</label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Any blockers? (optional)"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Capacity: {capacityPct}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={capacityPct}
              onChange={(e) => setCapacityPct(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <button
            type="submit"
            disabled={postMutation.isPending}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {postMutation.isPending ? 'Posting...' : 'Post Standup'}
          </button>
        </form>
      </div>

      {/* Feed */}
      <h2 className="mb-3 text-lg font-semibold">Today's Standups</h2>
      <div className="space-y-3">
        {standupsQuery.data?.map((s) => {
          const barColor = s.capacityPct >= 90 ? 'bg-red-500' : s.capacityPct >= 70 ? 'bg-amber-500' : 'bg-green-500';
          return (
            <div key={s.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {s.user.initials}
                  </span>
                  <span className="font-medium">{s.user.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full ${barColor}`} style={{ width: `${s.capacityPct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{s.capacityPct}%</span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium text-gray-600">Today:</span> {s.today}</p>
                <p><span className="font-medium text-gray-600">Yesterday:</span> {s.yesterday}</p>
                {s.blockers && (
                  <p className="text-red-600"><span className="font-medium">Blocker:</span> {s.blockers}</p>
                )}
              </div>
            </div>
          );
        })}
        {standupsQuery.data?.length === 0 && (
          <p className="text-sm text-gray-400">No standups posted yet today</p>
        )}
      </div>
    </div>
  );
}
