import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { EmptyState } from '../components/ui';
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  PlaneIcon,
} from '../components/icons';

const leaveTypeTones: Record<string, string> = {
  ANNUAL: 'bg-brand-50 text-brand-600',
  PARTIAL_AM: 'bg-warning-bg text-warning-text',
  PARTIAL_PM: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  SICK: 'bg-danger-bg text-danger-text',
};

const leaveTypeLabel: Record<string, string> = {
  ANNUAL: 'Annual',
  PARTIAL_AM: 'Partial AM',
  PARTIAL_PM: 'Partial PM',
  REMOTE: 'Remote',
  SICK: 'Sick',
};

const leaveTypeEmoji: Record<string, string> = {
  ANNUAL: '🌴',
  SICK: '🤒',
  REMOTE: '🏠',
  PARTIAL_AM: '⏱️',
  PARTIAL_PM: '⏱️',
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
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function LeaveCalendarPage() {
  const { openUser } = useUserDetail();
  const { user: me } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const teamsQuery = trpc.teams.list.useQuery();

  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 0).toISOString();

  const calendarQuery = trpc.leaves.calendar.useQuery({
    startDate,
    endDate,
    teamId: teamFilter || undefined,
  });

  // Separate "today on my team" query — independent of the month/team
  // filter above so the strip below the calendar always reflects who's
  // actually out on the caller's own team right now.
  const myTeamTodayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const myTeamTodayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);
  const myTeamTodayQuery = trpc.leaves.calendar.useQuery(
    {
      startDate: myTeamTodayStart,
      endDate: myTeamTodayEnd,
      teamId: me?.teamId ?? undefined,
    },
    { enabled: !!me?.teamId },
  );
  const myTeam = useMemo(
    () => teamsQuery.data?.find((t) => t.id === me?.teamId),
    [teamsQuery.data, me?.teamId],
  );

  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();
  const todayDate = new Date();
  const isCurrentMonth =
    todayDate.getFullYear() === year && todayDate.getMonth() + 1 === mon;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = Array(firstDayOfWeek).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const leavesForDay = (day: number) => {
    if (!calendarQuery.data) return [];
    const date = new Date(year, mon - 1, day);
    return calendarQuery.data.filter((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, mon - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setExpandedDay(null);
  };

  const jumpToToday = () => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setExpandedDay(null);
  };

  const monthLabel = `${MONTH_NAMES[mon - 1]} ${year}`;
  const totalLeaves = calendarQuery.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1>Leave calendar</h1>
          <p className="mt-1 text-base text-text-secondary">
            See who's away or remote at a glance — click any name to open their profile.
          </p>
        </div>
        <div className="flex gap-1 rounded border border-border bg-surface-primary p-0.5">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors duration-fast ${
              viewMode === 'calendar'
                ? 'bg-brand-50 text-brand-600'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors duration-fast ${
              viewMode === 'list'
                ? 'bg-brand-50 text-brand-600'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            List
          </button>
        </div>
      </header>

      {/* Month toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded border border-border bg-surface-primary p-0.5">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="min-w-[9rem] px-2 text-center text-base text-text-primary">
            {monthLabel}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={jumpToToday}
          className="rounded border border-border bg-surface-primary px-3 py-1 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          Today
        </button>

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
        >
          <option value="">All teams</option>
          {teamsQuery.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-text-tertiary">
          {totalLeaves} {totalLeaves === 1 ? 'leave' : 'leaves'} this month
        </span>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['ANNUAL', 'SICK', 'PARTIAL_AM', 'REMOTE'] as const).map((t) => (
          <span
            key={t}
            className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs ${leaveTypeTones[t]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {leaveTypeLabel[t]}
          </span>
        ))}
      </div>

      {viewMode === 'calendar' ? (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
            <div className="grid grid-cols-7 border-b border-border bg-surface-secondary">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="p-2 text-center text-xs text-text-tertiary">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const isToday = day !== null && isCurrentMonth && todayDate.getDate() === day;
                const dayLeaves = day ? leavesForDay(day) : [];
                const visible = dayLeaves.slice(0, 3);
                const overflow = dayLeaves.length - visible.length;
                return (
                  <div
                    key={i}
                    className={`min-h-[96px] border-b border-r border-border p-1.5 ${
                      isToday ? 'bg-brand-50' : day === null ? 'bg-surface-secondary/40' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                              isToday
                                ? 'bg-brand-600 text-white'
                                : 'text-text-tertiary'
                            }`}
                          >
                            {day}
                          </span>
                          {dayLeaves.length > 0 && (
                            <span className="text-[10px] text-text-tertiary">
                              {dayLeaves.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          {visible.map((leave) => (
                            <button
                              key={leave.id}
                              type="button"
                              onClick={() => openUser(leave.user.id)}
                              title={`${leave.user.name} — ${leaveTypeLabel[leave.type]}`}
                              className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] transition-opacity duration-fast hover:opacity-80 ${leaveTypeTones[leave.type]}`}
                            >
                              {leave.type === 'REMOTE' ? (
                                <HomeIcon className="h-2.5 w-2.5 shrink-0" />
                              ) : leave.type === 'ANNUAL' ? (
                                <PlaneIcon className="h-2.5 w-2.5 shrink-0" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                              )}
                              <span className="truncate">
                                {leave.user.initials} · {leaveTypeLabel[leave.type]}
                              </span>
                            </button>
                          ))}
                          {overflow > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedDay(day)}
                              className="w-full text-left text-[10px] text-text-tertiary hover:text-text-primary"
                            >
                              +{overflow} more
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded day modal */}
          {expandedDay !== null && (
            <div
              className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)]"
              onClick={() => setExpandedDay(null)}
            >
              <div
                className="w-full max-w-card rounded-lg bg-surface-primary p-5 shadow-float animate-modal-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2>
                    {monthLabel.split(' ')[0]} {expandedDay}
                  </h2>
                  <span className="text-xs text-text-tertiary">
                    {leavesForDay(expandedDay).length} on leave
                  </span>
                </div>
                <div className="space-y-1.5">
                  {leavesForDay(expandedDay).map((leave) => {
                    const palette = paletteFor(leave.user.id);
                    return (
                      <button
                        key={leave.id}
                        type="button"
                        onClick={() => {
                          openUser(leave.user.id);
                          setExpandedDay(null);
                        }}
                        className="flex w-full items-center justify-between rounded border border-border bg-surface-primary p-2 text-left hover:bg-surface-secondary"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                            style={{ background: palette.bg, color: palette.text }}
                          >
                            {leave.user.initials}
                          </span>
                          <span className="text-sm text-text-primary">{leave.user.name}</span>
                        </div>
                        <span
                          className={`rounded-pill px-2 py-0.5 text-xs ${leaveTypeTones[leave.type]}`}
                        >
                          {leaveTypeLabel[leave.type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Who's out today on my team */}
          {me?.teamId && (
            <section className="mt-4 rounded-lg border border-border bg-surface-primary p-4">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-md">
                  <CalendarIcon className="h-4 w-4 text-text-tertiary" />
                  Today on {myTeam?.name ?? 'my team'}
                </h2>
                <span className="text-xs text-text-tertiary">
                  {myTeamTodayQuery.data?.length ?? 0} out of{' '}
                  {myTeam?.members.length ?? 0} members
                </span>
              </header>
              {(myTeamTodayQuery.data?.length ?? 0) === 0 ? (
                <div className="flex items-center gap-3 rounded-md bg-success-bg/50 p-3 text-success-text">
                  <CheckIcon className="h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    The whole team is available today. No one is on leave or remote.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {myTeamTodayQuery.data?.map((leave) => {
                    const palette = paletteFor(leave.user.id);
                    const emoji = leaveTypeEmoji[leave.type];
                    return (
                      <li key={leave.id}>
                        <button
                          type="button"
                          onClick={() => openUser(leave.user.id)}
                          className="flex w-full items-center gap-3 rounded-md border border-border bg-surface-secondary p-2.5 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-primary"
                        >
                          <span className="relative shrink-0">
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-full text-xs"
                              style={{ background: palette.bg, color: palette.text }}
                            >
                              {leave.user.initials}
                            </span>
                            {emoji && (
                              <span
                                title={leaveTypeLabel[leave.type]}
                                aria-label={leaveTypeLabel[leave.type]}
                                className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-primary text-[11px] leading-none ring-2 ring-surface-primary"
                              >
                                {emoji}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-text-primary">
                              {leave.user.name}
                            </div>
                            <div className="truncate text-xs text-text-tertiary">
                              {new Date(leave.startDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                              {' — '}
                              {new Date(leave.endDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${leaveTypeTones[leave.type]}`}
                          >
                            {leaveTypeLabel[leave.type]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {calendarQuery.data?.map((leave) => {
            const palette = paletteFor(leave.user.id);
            return (
              <button
                key={leave.id}
                type="button"
                onClick={() => openUser(leave.user.id)}
                className="flex w-full items-center justify-between rounded border border-border bg-surface-primary p-3 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-secondary"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs"
                    style={{ background: palette.bg, color: palette.text }}
                  >
                    {leave.user.initials}
                  </span>
                  <div>
                    <div className="text-md text-text-primary">{leave.user.name}</div>
                    <div className="text-xs text-text-tertiary">
                      {leave.user.team?.name ?? 'No team'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-pill px-2 py-0.5 text-xs ${leaveTypeTones[leave.type]}`}
                  >
                    {leaveTypeLabel[leave.type]}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {new Date(leave.startDate).toLocaleDateString()} —{' '}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </span>
                </div>
              </button>
            );
          })}
          {calendarQuery.data?.length === 0 && (
            <EmptyState
              icon={<HomeIcon className="h-4 w-4" />}
              message="No leave scheduled this month."
            />
          )}
        </div>
      )}
    </div>
  );
}
