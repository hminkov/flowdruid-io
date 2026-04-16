import { trpc } from '../lib/trpc';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  DENIED: 'bg-red-100 text-red-800',
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Approve Leaves</h1>

      {pendingQuery.data?.length === 0 && (
        <p className="text-sm text-gray-400">No pending leave requests</p>
      )}

      <div className="space-y-3">
        {pendingQuery.data?.map((leave) => (
          <div key={leave.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                  {leave.user.initials}
                </span>
                <div>
                  <span className="font-medium">{leave.user.name}</span>
                  <span className="ml-2 text-sm text-gray-500">{leave.user.team?.name}</span>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[leave.status]}`}>
                {leave.status}
              </span>
            </div>
            <div className="mb-3 text-sm text-gray-600">
              <span className="font-medium">{leave.type.replace('_', ' ')}</span> &middot;{' '}
              {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
              {leave.note && <p className="mt-1 text-gray-500">Note: {leave.note}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approveMutation.mutate({ leaveId: leave.id })}
                disabled={approveMutation.isPending}
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => denyMutation.mutate({ leaveId: leave.id })}
                disabled={denyMutation.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
