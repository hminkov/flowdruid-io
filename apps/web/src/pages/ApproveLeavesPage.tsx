import { trpc } from '../lib/trpc';
import { CalendarIcon, CheckIcon, InfoIcon, XIcon } from '../components/icons';

const statusTones: Record<string, string> = {
  PENDING: 'bg-warning-bg text-warning-text',
  APPROVED: 'bg-success-bg text-success-text',
  DENIED: 'bg-danger-bg text-danger-text',
};

const leaveTypeTones: Record<string, string> = {
  ANNUAL: 'bg-brand-50 text-brand-600',
  PARTIAL_AM: 'bg-warning-bg text-warning-text',
  PARTIAL_PM: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  SICK: 'bg-danger-bg text-danger-text',
};

export function ApproveLeavesPage() {
  const utils = trpc.useUtils();
  const pendingQuery = trpc.leaves.pending.useQuery();
  const approveMutation = trpc.leaves.approve.useMutation({
    onSuccess: () => utils.leaves.pending.invalidate(),
  });
  const denyMutation = trpc.leaves.deny.useMutation({
    onSuccess: () => utils.leaves.pending.invalidate(),
  });

  const items = pendingQuery.data ?? [];

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>Approve leaves</h1>
        <p className="mt-1 text-base text-text-secondary">
          {items.length === 0 ? 'Nothing to review.' : `${items.length} request${items.length === 1 ? '' : 's'} waiting on you.`}
        </p>
      </header>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center">
          <CheckIcon className="mx-auto mb-2 h-6 w-6 text-success-text" />
          <p className="text-sm text-text-secondary">You're all caught up.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((leave) => (
          <div key={leave.id} className="rounded-lg border border-border bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-sm text-[var(--avatar-1-text)]">
                  {leave.user.initials}
                </span>
                <div>
                  <div className="text-md text-text-primary">{leave.user.name}</div>
                  <div className="text-xs text-text-tertiary">{leave.user.team?.name ?? 'No team'}</div>
                </div>
              </div>
              <span className={`rounded-pill px-2 py-0.5 text-xs ${statusTones[leave.status]}`}>
                {leave.status.toLowerCase()}
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs ${leaveTypeTones[leave.type]}`}>
                {leave.type.replace('_', ' ').toLowerCase()}
              </span>
              <span className="inline-flex items-center gap-1 text-text-secondary">
                <CalendarIcon className="h-3.5 w-3.5" />
                {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
              </span>
            </div>

            {leave.note && (
              <div className="mb-3 flex items-start gap-2 rounded border border-border bg-surface-secondary p-2 text-sm text-text-secondary">
                <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                <span>{leave.note}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => approveMutation.mutate({ leaveId: leave.id })}
                disabled={approveMutation.isPending}
                className="flex min-h-input items-center gap-1.5 rounded bg-success-bg px-3 text-base text-success-text transition-colors duration-fast hover:brightness-95 disabled:opacity-60"
              >
                <CheckIcon className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => denyMutation.mutate({ leaveId: leave.id })}
                disabled={denyMutation.isPending}
                className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-base text-text-secondary transition-colors duration-fast hover:border-danger-text/30 hover:bg-danger-bg hover:text-danger-text disabled:opacity-60"
              >
                <XIcon className="h-4 w-4" />
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
