import { useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { AlertIcon, CalendarIcon, CheckIcon } from '../components/icons';

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

const formatRange = (a: string | Date, b: string | Date) => {
  const start = typeof a === 'string' ? new Date(a) : a;
  const end = typeof b === 'string' ? new Date(b) : b;
  const fmt = { month: 'short' as const, day: 'numeric' as const };
  return `${start.toLocaleDateString(undefined, fmt)} — ${end.toLocaleDateString(undefined, fmt)}`;
};

export function ProdSupportPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();

  const [teamFilter, setTeamFilter] = useState<string>(user?.teamId ?? 'all');
  const [year] = useState(new Date().getFullYear());

  const teamsQuery = trpc.teams.list.useQuery();
  const rotaQuery = trpc.resources.prodSupport.useQuery({
    teamId: teamFilter === 'all' ? undefined : teamFilter,
    year,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = useMemo(() => {
    const rota = rotaQuery.data ?? [];
    const current = rota.find((r) => {
      const s = new Date(r.startDate);
      const e = new Date(r.endDate);
      return s <= today && today <= e;
    });
    const upcoming = rota
      .filter((r) => new Date(r.startDate) > today)
      .slice(0, 5);
    const past = rota
      .filter((r) => new Date(r.endDate) < today)
      .slice(-5);
    return { current, upcoming, past };
  }, [rotaQuery.data, today]);

  const renderPerson = (u: { id: string; name: string; initials: string }) => {
    const p = paletteFor(u.id);
    return (
      <button
        onClick={() => openUser(u.id)}
        className="flex items-center gap-2 rounded-pill border border-border bg-surface-primary py-1 pl-1 pr-3 text-sm hover:border-border-strong"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
          style={{ background: p.bg, color: p.text }}
        >
          {u.initials}
        </span>
        <span className="text-text-primary">{u.name}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>Prod support rota</h1>
        <p className="mt-1 text-base text-text-secondary">
          Weekly pair responsible for production defects on their team.
        </p>
      </header>

      {/* Filter chips */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
        <button
          onClick={() => setTeamFilter('all')}
          className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
            teamFilter === 'all'
              ? 'bg-brand-600 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All teams
        </button>
        {teamsQuery.data?.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeamFilter(t.id)}
            className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
              teamFilter === t.id
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* This week */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <AlertIcon className="h-4 w-4 text-danger-text" />
          <h2>On call this week</h2>
        </div>
        {now.current ? (
          <div className="rounded-lg border border-danger-text/30 bg-danger-bg/30 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-text-primary">{now.current.team.name}</span>
              <span className="flex items-center gap-1 text-text-tertiary">
                <CalendarIcon className="h-3 w-3" />
                Week {now.current.weekNumber} · {formatRange(now.current.startDate, now.current.endDate)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {renderPerson(now.current.primary)}
              {renderPerson(now.current.secondary)}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface-primary p-4 text-center text-sm text-text-tertiary">
            {teamFilter === 'all'
              ? 'No one on rota for this week.'
              : 'This team has no assignment for the current week.'}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section className="mb-6">
        <h2 className="mb-2">Upcoming</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
          {now.upcoming.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-tertiary">Nothing scheduled.</p>
          ) : (
            <ul>
              {now.upcoming.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
                      {a.team.name}
                    </span>
                    <span className="flex items-center gap-1 text-text-tertiary">
                      <CalendarIcon className="h-3 w-3" />W{a.weekNumber} ·{' '}
                      {formatRange(a.startDate, a.endDate)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderPerson(a.primary)}
                    {renderPerson(a.secondary)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Past */}
      <section>
        <h2 className="mb-2 text-text-secondary">Recent history</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary opacity-80">
          {now.past.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-tertiary">No history.</p>
          ) : (
            <ul>
              {now.past.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
                      {a.team.name}
                    </span>
                    <span className="flex items-center gap-1 text-text-tertiary">
                      <CalendarIcon className="h-3 w-3" />W{a.weekNumber} ·{' '}
                      {formatRange(a.startDate, a.endDate)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderPerson(a.primary)}
                    {renderPerson(a.secondary)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-1.5 text-xs text-text-tertiary">
        <CheckIcon className="h-3 w-3" />
        Replaces the "VIS-2 PROD Support.xlsx" spreadsheet. Per-team pairs handle production defects for their domain.
      </div>
    </div>
  );
}
