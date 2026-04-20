import { useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { useConfirm, useToast } from '../components/ui';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
} from '../components/icons';

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

const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
};

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export function ParkingPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);

  const spotsQuery = trpc.resources.parkingSpots.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const confirm = useConfirm();
  const assignmentsQuery = trpc.resources.parkingAssignments.useQuery({
    startDate: toIso(weekStart),
    endDate: toIso(weekEnd),
  });
  const claim = trpc.resources.claimParking.useMutation({
    onSuccess: () => {
      utils.resources.parkingAssignments.invalidate();
      toast.push({ kind: 'success', title: 'Spot claimed' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Claim failed', message: err.message }),
  });
  const release = trpc.resources.releaseParking.useMutation({
    onSuccess: () => {
      utils.resources.parkingAssignments.invalidate();
      toast.push({ kind: 'success', title: 'Spot released' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Release failed', message: err.message }),
  });

  const handleRelease = async (spotId: string, date: string, label: string) => {
    const ok = await confirm({
      title: `Release ${label}?`,
      message: 'It will become available for anyone to claim.',
      confirmLabel: 'Release',
      tone: 'danger',
    });
    if (ok) release.mutate({ spotId, date });
  };

  const shiftWeek = (deltaWeeks: number) => {
    const w = new Date(weekStart);
    w.setDate(w.getDate() + deltaWeeks * 7);
    setWeekStart(w);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = useMemo(() => {
    return DAYS.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof assignmentsQuery.data>[number]>();
    for (const a of assignmentsQuery.data ?? []) {
      const d = new Date(a.date);
      const key = `${a.spotId}:${toIso(d)}`;
      map.set(key, a);
    }
    return map;
  }, [assignmentsQuery.data]);

  const label = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Parking</h1>
          <p className="mt-1 text-base text-text-secondary">
            7 spots, Mon-Fri. Click an empty slot to claim it; click yours to release.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded border border-border bg-surface-primary p-0.5">
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
            className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="min-w-[12rem] px-2 text-center text-sm text-text-primary">{label}</div>
          <button
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
            className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="ml-1 rounded px-2 py-1 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            This week
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-surface-primary">
        <div
          className="grid text-sm"
          style={{ gridTemplateColumns: '120px repeat(5, minmax(0, 1fr))' }}
        >
          <div className="border-b border-r border-border bg-surface-secondary p-2 text-xs text-text-tertiary">
            Spot
          </div>
          {DAYS.map((d, i) => {
            const date = dates[i]!;
            const isToday = date.getTime() === today.getTime();
            return (
              <div
                key={d}
                className={`border-b border-r border-border p-2 text-center ${
                  isToday ? 'bg-brand-50 text-brand-600' : 'bg-surface-secondary text-text-tertiary'
                }`}
              >
                <div className="text-xs">{d}</div>
                <div className="text-xs">
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}

          {spotsQuery.data?.map((spot) => (
            <div key={spot.id} className="contents">
              <div className="flex items-center border-b border-r border-border bg-surface-secondary p-2 font-mono text-sm text-text-primary">
                {spot.name}
              </div>
              {dates.map((date, di) => {
                const key = `${spot.id}:${toIso(date)}`;
                const a = assignmentMap.get(key);
                const isMine = a?.user.id === user?.id;
                const isToday = date.getTime() === today.getTime();
                const base = 'h-12 border-b border-r border-border p-1 text-left';
                if (!a) {
                  return (
                    <button
                      key={di}
                      onClick={() =>
                        claim.mutate({
                          spotId: spot.id,
                          date: toIso(date),
                        })
                      }
                      className={`${base} transition-colors duration-fast hover:bg-brand-50 ${
                        isToday ? 'bg-brand-50/40' : ''
                      }`}
                      title="Claim this spot"
                    >
                      <div className="flex h-full items-center justify-center gap-1 text-xs text-text-tertiary">
                        <PlusIcon className="h-3 w-3" />
                        FREE
                      </div>
                    </button>
                  );
                }
                const palette = paletteFor(a.user.id);
                return (
                  <div
                    key={di}
                    className={`${base} flex items-center gap-1.5 ${isToday ? 'bg-brand-50/40' : ''}`}
                  >
                    <button
                      onClick={() => openUser(a.user.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                      title={`View ${a.user.name}`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]"
                        style={{ background: palette.bg, color: palette.text }}
                      >
                        {a.user.initials}
                      </span>
                      <span className="truncate text-xs text-text-primary">
                        {a.user.name.split(' ')[0]}
                      </span>
                    </button>
                    {isMine && (
                      <button
                        onClick={() =>
                          handleRelease(
                            spot.id,
                            toIso(date),
                            `${spot.name} on ${date.toLocaleDateString()}`
                          )
                        }
                        aria-label="Release"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-danger-bg hover:text-danger-text"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Today is highlighted in brand purple
        </span>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3" />
          Replaces "Cloudruid Parking 2026.xlsx"
        </span>
      </div>
    </div>
  );
}
