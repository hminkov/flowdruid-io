import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';

const leaveTypeColors: Record<string, string> = {
  ANNUAL: 'bg-purple-200 text-purple-800',
  PARTIAL_AM: 'bg-amber-200 text-amber-800',
  PARTIAL_PM: 'bg-amber-200 text-amber-800',
  REMOTE: 'bg-blue-200 text-blue-800',
  SICK: 'bg-red-200 text-red-800',
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Calendar</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="rounded border px-3 py-1 text-sm"
          >
            {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">All Teams</option>
          {teamsQuery.data?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {viewMode === 'calendar' ? (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => (
              <div key={i} className="min-h-[80px] border-b border-r p-1">
                {day && (
                  <>
                    <span className="text-xs text-gray-500">{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {leavesForDay(day).slice(0, 3).map((leave) => (
                        <div
                          key={leave.id}
                          className={`truncate rounded px-1 text-[10px] font-medium ${leaveTypeColors[leave.type]}`}
                        >
                          {leave.user.initials} {leave.type.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {calendarQuery.data?.map((leave) => (
            <div key={leave.id} className="flex items-center justify-between rounded border bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-800">
                  {leave.user.initials}
                </span>
                <div>
                  <span className="text-sm font-medium">{leave.user.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{leave.user.team?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${leaveTypeColors[leave.type]}`}>
                  {leave.type.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {calendarQuery.data?.length === 0 && (
            <p className="text-sm text-gray-400">No leave scheduled this month</p>
          )}
        </div>
      )}
    </div>
  );
}
