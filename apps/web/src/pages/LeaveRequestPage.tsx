import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { AlertIcon, CalendarIcon, SendIcon, SpinnerIcon } from '../components/icons';

const leaveTypes = [
  { value: 'ANNUAL', label: 'Annual leave' },
  { value: 'PARTIAL_AM', label: 'Partial (morning)' },
  { value: 'PARTIAL_PM', label: 'Partial (afternoon)' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'SICK', label: 'Sick leave' },
] as const;

const statusTones: Record<string, string> = {
  PENDING: 'bg-warning-bg text-warning-text',
  APPROVED: 'bg-success-bg text-success-text',
  DENIED: 'bg-danger-bg text-danger-text',
};

const typeTones: Record<string, string> = {
  ANNUAL: 'bg-brand-50 text-brand-600',
  PARTIAL_AM: 'bg-warning-bg text-warning-text',
  PARTIAL_PM: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  SICK: 'bg-danger-bg text-danger-text',
};

export function LeaveRequestPage() {
  const [type, setType] = useState<string>('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [notifySlack, setNotifySlack] = useState(true);

  const utils = trpc.useUtils();
  const myLeaves = trpc.leaves.list.useQuery({});
  const requestMutation = trpc.leaves.request.useMutation({
    onSuccess: () => {
      utils.leaves.list.invalidate();
      setStartDate('');
      setEndDate('');
      setNote('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    requestMutation.mutate({
      type: type as 'ANNUAL' | 'PARTIAL_AM' | 'PARTIAL_PM' | 'REMOTE' | 'SICK',
      startDate,
      endDate: endDate || startDate,
      note: note || undefined,
      notifySlack,
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1>Leave request</h1>
        <p className="mt-1 text-base text-text-secondary">
          Submit time off — your lead will get a Slack notification.
        </p>
      </header>

      <div className="mb-8 rounded-lg border border-border bg-surface-primary p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>{lt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-secondary">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              placeholder="Optional context for your lead"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={notifySlack}
              onChange={(e) => setNotifySlack(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-600"
            />
            Notify my team via Slack
          </label>

          {requestMutation.error && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{requestMutation.error.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={requestMutation.isPending}
            className="flex min-h-input items-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
          >
            {requestMutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
            {requestMutation.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>

      <h2 className="mb-3">My requests</h2>
      <div className="space-y-2">
        {myLeaves.data?.map((leave) => (
          <div key={leave.id} className="flex items-center justify-between rounded border border-border bg-surface-primary p-3">
            <div className="flex items-center gap-3">
              <span className={`rounded-pill px-2 py-0.5 text-xs ${typeTones[leave.type]}`}>
                {leave.type.replace('_', ' ').toLowerCase()}
              </span>
              <span className="flex items-center gap-1 text-sm text-text-secondary">
                <CalendarIcon className="h-3.5 w-3.5" />
                {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
              </span>
            </div>
            <span className={`rounded-pill px-2 py-0.5 text-xs ${statusTones[leave.status]}`}>
              {leave.status.toLowerCase()}
            </span>
          </div>
        ))}
        {myLeaves.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
            No requests yet.
          </div>
        )}
      </div>
    </div>
  );
}
