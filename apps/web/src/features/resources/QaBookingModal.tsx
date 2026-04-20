import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { useToast, useConfirm } from '../../components/ui';
import { AlertIcon, SpinnerIcon, TrashIcon, XIcon } from '../../components/icons';
import type { QaBookingStatus } from '@flowdruid/shared';

type Booking = {
  id: string;
  environmentId: string;
  service: string;
  feature: string | null;
  devOwnerId: string | null;
  qaOwnerId: string | null;
  status: QaBookingStatus;
  notes: string | null;
};

type Props = {
  // If provided, edit mode. Otherwise create mode — environmentId required.
  booking: Booking | null;
  environmentId?: string;
  environmentName?: string;
  onClose: () => void;
};

const STATUS_OPTIONS: { v: QaBookingStatus; label: string }[] = [
  { v: 'NEW', label: 'New' },
  { v: 'IN_DEVELOPMENT', label: 'In development' },
  { v: 'TEST_IN_QA', label: 'Test in QA' },
  { v: 'READY_FOR_PROD', label: 'Ready for prod' },
  { v: 'PUSHED_TO_PROD', label: 'Pushed to prod' },
  { v: 'PAUSED', label: 'Paused' },
];

export function QaBookingModal({ booking, environmentId, environmentName, onClose }: Props) {
  const isEdit = !!booking;
  const toast = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const teamsQuery = trpc.teams.list.useQuery();

  const [service, setService] = useState(booking?.service ?? '');
  const [feature, setFeature] = useState(booking?.feature ?? '');
  const [status, setStatus] = useState<QaBookingStatus>(booking?.status ?? 'IN_DEVELOPMENT');
  const [devOwnerId, setDevOwnerId] = useState(booking?.devOwnerId ?? '');
  const [qaOwnerId, setQaOwnerId] = useState(booking?.qaOwnerId ?? '');
  const [notes, setNotes] = useState(booking?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const create = trpc.resources.createQaBooking.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Booking created' });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.push({ kind: 'error', title: 'Create failed', message: err.message });
    },
  });

  const update = trpc.resources.updateQaBooking.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Booking updated' });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.push({ kind: 'error', title: 'Update failed', message: err.message });
    },
  });

  const del = trpc.resources.deleteQaBooking.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Booking removed' });
      onClose();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Delete failed', message: err.message }),
  });

  const allMembers = (teamsQuery.data ?? []).flatMap((team) =>
    team.members.map((m) => ({ ...m, teamName: team.name }))
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!service.trim()) {
      setError('Service is required');
      return;
    }
    if (isEdit) {
      update.mutate({
        bookingId: booking!.id,
        service: service.trim(),
        feature: feature.trim() || null,
        status,
        devOwnerId: devOwnerId || null,
        qaOwnerId: qaOwnerId || null,
        notes: notes.trim() || null,
      });
    } else {
      if (!environmentId) {
        setError('Missing environment');
        return;
      }
      create.mutate({
        environmentId,
        service: service.trim(),
        feature: feature.trim() || undefined,
        status,
        devOwnerId: devOwnerId || undefined,
        qaOwnerId: qaOwnerId || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !booking) return;
    const ok = await confirm({
      title: 'Remove this booking?',
      message: `${booking.service}${booking.feature ? ` · ${booking.feature}` : ''}. This cannot be undone.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) del.mutate({ bookingId: booking.id });
  };

  const busy = create.isPending || update.isPending || del.isPending;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="animate-modal-in relative w-full max-w-modal overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2>{isEdit ? 'Edit booking' : 'New booking'}</h2>
            {environmentName && (
              <p className="mt-1 text-xs text-text-tertiary">
                Environment: <span className="font-mono text-text-primary">{environmentName}</span>
              </p>
            )}
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
            <label className="mb-1 block text-xs text-text-tertiary">Service *</label>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. withdrawal-api"
              autoFocus
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Feature / ticket</label>
            <input
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              placeholder="e.g. Fraud Questionnaire (DW-044)"
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Status</label>
            <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatus(opt.v)}
                  className={`rounded-pill px-3 py-1 text-xs transition-colors duration-fast ${
                    status === opt.v
                      ? 'bg-brand-600 text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Dev owner</label>
              <select
                value={devOwnerId}
                onChange={(e) => setDevOwnerId(e.target.value)}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              >
                <option value="">—</option>
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.teamName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">QA owner</label>
              <select
                value={qaOwnerId}
                onChange={(e) => setQaOwnerId(e.target.value)}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              >
                <option value="">—</option>
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.teamName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional context for the team"
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
            />
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
                {isEdit ? 'Save changes' : 'Create booking'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
