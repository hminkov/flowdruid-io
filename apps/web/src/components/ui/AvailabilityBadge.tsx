type Availability = 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';

const TONE: Record<Availability, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-warning-bg text-warning-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-danger-bg text-danger-text',
};

export const AVAILABILITY_DOT: Record<Availability, string> = {
  AVAILABLE: 'bg-success-text',
  BUSY: 'bg-warning-text',
  REMOTE: 'bg-info-text',
  ON_LEAVE: 'bg-danger-text',
};

const LABEL: Record<Availability, string> = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  REMOTE: 'remote',
  ON_LEAVE: 'on leave',
};

export function AvailabilityBadge({
  status,
  size = 'md',
  withDot = false,
}: {
  status: Availability;
  size?: 'xs' | 'sm' | 'md';
  withDot?: boolean;
}) {
  const sizeClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'sm'
        ? 'px-2 py-0.5 text-xs'
        : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill ${sizeClass} ${TONE[status]}`}>
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${AVAILABILITY_DOT[status]}`} />}
      {LABEL[status]}
    </span>
  );
}
