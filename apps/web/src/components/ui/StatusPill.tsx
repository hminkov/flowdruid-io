type TicketStatus =
  | 'TODO'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'READY_FOR_VERIFICATION'
  | 'DONE';

const TONE: Record<TicketStatus, string> = {
  TODO: 'bg-neutral-bg text-neutral-text',
  BLOCKED: 'bg-danger-bg text-danger-text',
  IN_PROGRESS: 'bg-info-bg text-info-text',
  IN_REVIEW: 'bg-warning-bg text-warning-text',
  READY_FOR_VERIFICATION: 'bg-brand-50 text-brand-600',
  DONE: 'bg-success-bg text-success-text',
};

const LABEL: Record<TicketStatus, string> = {
  TODO: 'Open issues',
  BLOCKED: 'Blocked',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'Developer review',
  READY_FOR_VERIFICATION: 'Ready for verification',
  DONE: 'Done',
};

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs ${TONE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
