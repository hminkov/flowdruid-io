type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

const TONE: Record<TicketStatus, string> = {
  TODO: 'bg-neutral-bg text-neutral-text',
  IN_PROGRESS: 'bg-info-bg text-info-text',
  IN_REVIEW: 'bg-warning-bg text-warning-text',
  DONE: 'bg-success-bg text-success-text',
};

const LABEL: Record<TicketStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs ${TONE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
