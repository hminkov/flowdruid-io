import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const leaveTypes = [
  { value: 'ANNUAL', label: 'Annual Leave' },
  { value: 'PARTIAL_AM', label: 'Partial (Morning)' },
  { value: 'PARTIAL_PM', label: 'Partial (Afternoon)' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'SICK', label: 'Sick Leave' },
] as const;

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  DENIED: 'bg-red-100 text-red-800',
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
      <h1 className="mb-6 text-2xl font-bold">Leave Request</h1>

      <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>{lt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Optional note"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notifySlack}
              onChange={(e) => setNotifySlack(e.target.checked)}
              className="rounded"
            />
            Notify team via Slack
          </label>
          {requestMutation.error && (
            <p className="text-sm text-red-600">{requestMutation.error.message}</p>
          )}
          <button
            type="submit"
            disabled={requestMutation.isPending}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Submit Request
          </button>
        </form>
      </div>

      <h2 className="mb-3 text-lg font-semibold">My Requests</h2>
      <div className="space-y-2">
        {myLeaves.data?.map((leave) => (
          <div key={leave.id} className="flex items-center justify-between rounded border bg-white p-3 shadow-sm">
            <div>
              <span className="text-sm font-medium">{leave.type.replace('_', ' ')}</span>
              <span className="ml-2 text-sm text-gray-500">
                {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
              </span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[leave.status]}`}>
              {leave.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
