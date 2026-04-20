import { useMemo, useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useUserDetail } from '../hooks/useUserDetail';
import { useConfirm, useToast } from '../components/ui';
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
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

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export function ParkingPage() {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);

  const spotsQuery = trpc.resources.parkingSpots.useQuery();
  const utils = trpc.useUtils();
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

  // Admin spot CRUD
  const createSpot = trpc.resources.createParkingSpot.useMutation({
    onSuccess: () => {
      utils.resources.parkingSpots.invalidate();
      toast.push({ kind: 'success', title: 'Spot added' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Add failed', message: err.message }),
  });
  const updateSpot = trpc.resources.updateParkingSpot.useMutation({
    onSuccess: () => {
      utils.resources.parkingSpots.invalidate();
      toast.push({ kind: 'success', title: 'Spot renamed' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Rename failed', message: err.message }),
  });
  const deleteSpot = trpc.resources.deleteParkingSpot.useMutation({
    onSuccess: () => {
      utils.resources.parkingSpots.invalidate();
      toast.push({ kind: 'success', title: 'Spot removed' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Remove failed', message: err.message }),
  });

  const shiftWeek = (deltaWeeks: number) => {
    const w = new Date(weekStart);
    w.setDate(w.getDate() + deltaWeeks * 7);
    setWeekStart(w);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = useMemo(
    () =>
      DAYS.map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const assignmentMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof assignmentsQuery.data>[number]>();
    for (const a of assignmentsQuery.data ?? []) {
      const d = new Date(a.date);
      const key = `${a.spotId}:${toIso(d)}`;
      map.set(key, a);
    }
    return map;
  }, [assignmentsQuery.data]);

  // Which dates does the signed-in user already have a slot on?
  const myDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of assignmentsQuery.data ?? []) {
      if (a.user.id === user?.id) {
        set.add(toIso(new Date(a.date)));
      }
    }
    return set;
  }, [assignmentsQuery.data, user?.id]);

  const spots = spotsQuery.data ?? [];
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Per-day occupancy for the stats row
  const totalCells = spots.length * 5;
  const filled = (assignmentsQuery.data ?? []).length;

  const [showAddSpot, setShowAddSpot] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; current: string } | null>(null);

  const handleClaim = (spotId: string, date: string) => {
    if (myDates.has(date)) {
      toast.push({
        kind: 'error',
        title: 'Already booked today',
        message: 'You can only hold one spot per day — release your current one first.',
      });
      return;
    }
    claim.mutate({ spotId, date });
  };

  const handleRelease = async (spotId: string, date: string, label: string) => {
    const ok = await confirm({
      title: `Release ${label}?`,
      message: 'It will become available for anyone to claim.',
      confirmLabel: 'Release',
      tone: 'danger',
    });
    if (ok) release.mutate({ spotId, date });
  };

  const handleDeleteSpot = async (spotId: string, name: string) => {
    const ok = await confirm({
      title: `Remove ${name}?`,
      message:
        'This only works if the spot has no future bookings. Release any future claims first.',
      confirmLabel: 'Remove spot',
      tone: 'danger',
    });
    if (ok) deleteSpot.mutate({ spotId });
  };

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Parking</h1>
          <p className="mt-1 text-base text-text-secondary">
            {spots.length} spots, Mon–Fri. Click a free cell to claim; click yours to release.
            One slot per person per day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-border bg-surface-primary p-0.5">
            <button
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
              className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-[12rem] px-2 text-center text-sm text-text-primary">
              {weekLabel}
            </div>
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
          {isAdmin && (
            <button
              onClick={() => setShowAddSpot(true)}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add spot
            </button>
          )}
        </div>
      </header>

      {/* Summary strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-primary p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-pill bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
            {filled} / {totalCells} booked
          </span>
          <span className="text-xs text-text-tertiary">
            {Math.round(((totalCells - filled) / Math.max(totalCells, 1)) * 100)}% free
          </span>
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary">
          <div
            className="h-full bg-brand-500"
            style={{ width: `${Math.min(100, Math.round((filled / Math.max(totalCells, 1)) * 100))}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-primary">
        <div
          className="grid min-w-[640px] text-sm"
          style={{ gridTemplateColumns: '140px repeat(5, minmax(0, 1fr))' }}
        >
          {/* Corner cell + day headers */}
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
                  isToday
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-secondary text-text-tertiary'
                }`}
              >
                <div className="text-xs">{d}</div>
                <div className={`text-xs ${isToday ? 'opacity-90' : ''}`}>
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}

          {spots.map((spot) => (
            <div key={spot.id} className="contents">
              <div className="flex items-center justify-between gap-2 border-b border-r border-border bg-surface-secondary p-2 text-sm">
                <span className="font-mono text-text-primary">{spot.name}</span>
                {isAdmin && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setRenaming({ id: spot.id, current: spot.name })}
                      title="Rename"
                      className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-primary hover:text-text-primary"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteSpot(spot.id, spot.name)}
                      title="Remove spot"
                      className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-danger-bg hover:text-danger-text"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {dates.map((date, di) => {
                const iso = toIso(date);
                const key = `${spot.id}:${iso}`;
                const a = assignmentMap.get(key);
                const isMine = a?.user.id === user?.id;
                const isToday = date.getTime() === today.getTime();
                const cellBase = `h-14 border-b border-r border-border p-1.5 text-left`;
                const cellTint = isToday ? 'bg-brand-50/60' : '';
                const iHaveSlotThisDay = myDates.has(iso);

                if (!a) {
                  const blocked = iHaveSlotThisDay;
                  return (
                    <button
                      key={di}
                      onClick={() => handleClaim(spot.id, iso)}
                      disabled={blocked}
                      className={`${cellBase} ${cellTint} transition-colors duration-fast ${
                        blocked
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-brand-50'
                      }`}
                      title={
                        blocked
                          ? 'You already have a spot today'
                          : 'Claim this spot'
                      }
                    >
                      <div className="flex h-full items-center justify-center gap-1 text-xs text-text-tertiary">
                        {blocked ? (
                          <AlertIcon className="h-3 w-3" />
                        ) : (
                          <PlusIcon className="h-3 w-3" />
                        )}
                        {blocked ? 'booked elsewhere' : 'FREE'}
                      </div>
                    </button>
                  );
                }
                const palette = paletteFor(a.user.id);
                return (
                  <div
                    key={di}
                    className={`${cellBase} ${cellTint} flex items-center gap-1.5 ${
                      isMine ? 'bg-brand-50/80' : ''
                    }`}
                  >
                    <button
                      onClick={() => openUser(a.user.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                      title={`View ${a.user.name}`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ring-2 ring-surface-primary"
                        style={{ background: palette.bg, color: palette.text }}
                      >
                        {a.user.initials}
                      </span>
                      <span className="truncate text-xs text-text-primary">
                        {a.user.name.split(' ')[0]}
                      </span>
                      {isMine && (
                        <span className="shrink-0 rounded-pill bg-brand-600 px-1.5 py-0 text-[9px] uppercase tracking-widest text-white">
                          you
                        </span>
                      )}
                    </button>
                    {isMine && (
                      <button
                        onClick={() =>
                          handleRelease(spot.id, iso, `${spot.name} on ${date.toLocaleDateString()}`)
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

          {spots.length === 0 && (
            <div className="col-span-6 p-6 text-center text-sm text-text-tertiary">
              No parking spots configured.
              {isAdmin && (
                <button
                  onClick={() => setShowAddSpot(true)}
                  className="ml-2 text-brand-600 underline-offset-2 hover:underline"
                >
                  Add one
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-brand-600" />
          today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-brand-50" />
          your booking
        </span>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3" />
          One slot per person per day
        </span>
        {isAdmin && (
          <span className="flex items-center gap-1.5">
            <CheckIcon className="h-3 w-3" />
            Add / remove spots as the office capacity changes
          </span>
        )}
      </div>

      {showAddSpot && (
        <AddSpotModal
          onClose={() => setShowAddSpot(false)}
          onSubmit={(name) => {
            createSpot.mutate({ name });
            setShowAddSpot(false);
          }}
        />
      )}

      {renaming && (
        <RenameSpotModal
          current={renaming.current}
          onClose={() => setRenaming(null)}
          onSubmit={(name) => {
            updateSpot.mutate({ spotId: renaming.id, name });
            setRenaming(null);
          }}
        />
      )}
    </div>
  );
}

function AddSpotModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };
  return (
    <ModalShell title="Add parking spot" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text-tertiary">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Spot 8" or "Visitor A"'
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-input rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
          >
            Add spot
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RenameSpotModal({
  current,
  onClose,
  onSubmit,
}: {
  current: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(current);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === current) {
      onClose();
      return;
    }
    onSubmit(name.trim());
  };
  return (
    <ModalShell title="Rename spot" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text-tertiary">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-input rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-card overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
