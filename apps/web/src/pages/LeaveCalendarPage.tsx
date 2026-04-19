import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { CalendarIcon, HomeIcon } from '../components/icons';

const leaveTypeTones: Record<string, string> = {
  ANNUAL: 'bg-brand-50 text-brand-600',
  PARTIAL_AM: 'bg-warning-bg text-warning-text',
  PARTIAL_PM: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  SICK: 'bg-danger-bg text-danger-text',
};

export function LeaveCalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const teamsQuery = trpc.teams.list.useQuery();

  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 0).toISOString();

  const calendarQuery = trpc.leaves.calendar.useQuery({
    startDate,
    endDate,
    teamId: teamFilter || undefined,
  });

  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();
  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === mon;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = Array(firstDayOfWeek).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
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

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1>Leave calendar</h1>
          <p className="mt-1 text-base text-text-secondary">
            See who's away across the team.
          </p>
        </div>
        <div className="flex gap-1 rounded border border-border bg-surface-primary p-0.5">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors duration-fast ${
              viewMode === 'calendar' ? 'bg-brand-50 text-brand-600' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors duration-fast ${
              viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            List
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="min-h-input rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
        >
          <option value="">All teams</option>
          {teamsQuery.data?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {viewMode === 'calendar' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
          <div className="grid grid-cols-7 border-b border-border bg-surface-secondary">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="p-2 text-center text-xs text-text-tertiary">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const isToday = day !== null && isCurrentMonth && todayDate.getDate() === day;
              return (
                <div
                  key={i}
                  className={`min-h-[72px] border-b border-r border-border p-1 ${
                    isToday ? 'bg-brand-50' : ''
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-xs ${isToday ? 'text-brand-600' : 'text-text-tertiary'}`}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {leavesForDay(day).slice(0, 3).map((leave) => (
                          <div
                            key={leave.id}
                            title={`${leave.user.name} — ${leave.type.replace('_', ' ').toLowerCase()}`}
                            className={`truncate rounded px-1 text-[10px] ${leaveTypeTones[leave.type]}`}
                          >
                            {leave.user.initials} · {leave.type.replace('_', ' ').toLowerCase()}
                          </div>
                        ))}
                        {leavesForDay(day).length > 3 && (
                          <div className="text-[10px] text-text-tertiary">
                            +{leavesForDay(day).length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {calendarQuery.data?.map((leave) => (
            <div key={leave.id} className="flex items-center justify-between rounded border border-border bg-surface-primary p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
                  {leave.user.initials}
                </span>
                <div>
                  <div className="text-md text-text-primary">{leave.user.name}</div>
                  <div className="text-xs text-text-tertiary">{leave.user.team?.name ?? 'No team'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-pill px-2 py-0.5 text-xs ${leaveTypeTones[leave.type]}`}>
                  {leave.type.replace('_', ' ').toLowerCase()}
                </span>
                <span className="flex items-center gap-1 text-sm text-text-secondary">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {calendarQuery.data?.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center">
              <HomeIcon className="mx-auto mb-2 h-6 w-6 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No leave scheduled this month.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
