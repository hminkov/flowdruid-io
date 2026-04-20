import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { useToast, useConfirm } from '../../components/ui';
import { AlertIcon, CalendarIcon, SpinnerIcon, TrashIcon, XIcon } from '../../components/icons';

type Existing = {
  id: string;
  teamId: string;
  weekNumber: number;
  startDate: string | Date;
  endDate: string | Date;
  primaryId: string;
  secondaryId: string;
  team: { id: string; name: string };
};

type Props = {
  // Edit mode when provided; create mode requires teamId + Monday ISO.
  existing: Existing | null;
  teamId?: string;
  teamName?: string;
  weekStartIso?: string;
  weekNumber?: number;
  onClose: () => void;
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ProdSupportModal({
  existing,
  teamId,
  teamName,
  weekStartIso,
  weekNumber,
  onClose,
}: Props) {
  const isEdit = !!existing;
  const toast = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const teamsQuery = trpc.teams.list.useQuery();

  const existingTeamId = existing?.teamId ?? teamId ?? '';
  const existingStart = existing ? new Date(existing.startDate) : null;
  const initialStart = existing
    ? toIsoDate(existingStart!)
    : weekStartIso ?? toIsoDate(nextMonday(new Date()));

  const [primaryId, setPrimaryId] = useState(existing?.primaryId ?? '');
  const [secondaryId, setSecondaryId] = useState(existing?.secondaryId ?? '');
  const [startDate, setStartDate] = useState(initialStart);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const upsert = trpc.resources.createProdSupport.useMutation({
    onSuccess: () => {
      utils.resources.prodSupport.invalidate();
      toast.push({ kind: 'success', title: isEdit ? 'Rota updated' : 'Rota slot created' });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.push({ kind: 'error', title: 'Save failed', message: err.message });
    },
  });

  const del = trpc.resources.deleteProdSupport.useMutation({
    onSuccess: () => {
      utils.resources.prodSupport.invalidate();
      toast.push({ kind: 'success', title: 'Slot removed' });
      onClose();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Delete failed', message: err.message }),
  });

  const team = (teamsQuery.data ?? []).find((t) => t.id === existingTeamId);
  const teamMembers = team?.members ?? [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!primaryId || !secondaryId) {
      setError('Pick a primary and a secondary');
      return;
    }
    if (primaryId === secondaryId) {
      setError('Primary and secondary must be different people');
      return;
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      setError('Invalid start date');
      return;
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 4);

    upsert.mutate({
      teamId: existingTeamId,
      startDate,
      endDate: toIsoDate(end),
      weekNumber: weekNumber ?? isoWeekNumber(start),
      primaryId,
      secondaryId,
    });
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    const ok = await confirm({
      title: 'Remove this rota slot?',
      message: `${existing!.team.name} — week ${existing!.weekNumber}. It can be recreated later.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) del.mutate({ assignmentId: existing!.id });
  };

  const busy = upsert.isPending || del.isPending;
  const resolvedTeamName = teamName ?? existing?.team.name ?? team?.name ?? '';

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="animate-modal-in relative w-full max-w-card overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2>{isEdit ? 'Edit rota slot' : 'Set on-call pair'}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
              <CalendarIcon className="h-3 w-3" />
              {resolvedTeamName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Week starting (Monday)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isEdit}
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary disabled:opacity-60"
            />
            {isEdit && (
              <p className="mt-1 text-[10px] text-text-tertiary">
                Week start is keyed — delete and recreate to shift it.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Primary</label>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
            >
              <option value="">Select a teammate…</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Secondary</label>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
            >
              <option value="">Select a teammate…</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === primaryId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-xs text-danger-text">
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex min-h-input items-center gap-1.5 rounded border border-border px-3 text-sm text-text-secondary hover:border-danger-text/30 hover:bg-danger-bg hover:text-danger-text disabled:opacity-60"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy && <SpinnerIcon className="h-4 w-4" />}
                {isEdit ? 'Save changes' : 'Assign pair'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function nextMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstThuDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDayNum + 3);
  return 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
}
