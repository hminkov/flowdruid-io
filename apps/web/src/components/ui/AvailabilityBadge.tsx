type Availability = 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';

const TONE: Record<Availability, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  BUSY: 'bg-danger-bg text-danger-text',
  REMOTE: 'bg-info-bg text-info-text',
  ON_LEAVE: 'bg-warning-bg text-warning-text',
};

// Colour used for the dot marker. BUSY is deliberately red so it reads
// as a "stop" signal at a glance alongside the green AVAILABLE dot.
export const AVAILABILITY_DOT: Record<Availability, string> = {
  AVAILABLE: 'bg-success-text',
  BUSY: 'bg-danger-text',
  REMOTE: 'bg-info-text',
  ON_LEAVE: 'bg-warning-text',
};

// Emoji used in place of a coloured dot for spatial statuses — a house
// for remote work and a palm tree for vacation/leave. AVAILABLE and
// BUSY keep the coloured dot because they communicate urgency, not
// location.
export const AVAILABILITY_EMOJI: Partial<Record<Availability, string>> = {
  REMOTE: '🏠',
  ON_LEAVE: '🌴',
};

const LABEL: Record<Availability, string> = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  REMOTE: 'remote',
  ON_LEAVE: 'on leave',
};

// Small glyph — an emoji if one exists for this status, otherwise a
// coloured dot. Use this anywhere you'd otherwise render a plain dot.
export function AvailabilityGlyph({
  status,
  size = 'sm',
  className = '',
}: {
  status: Availability;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const emoji = AVAILABILITY_EMOJI[status];
  if (emoji) {
    const fontSize = size === 'xs' ? '10px' : size === 'sm' ? '13px' : '15px';
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{ fontSize }}
        aria-label={LABEL[status]}
        title={LABEL[status]}
      >
        {emoji}
      </span>
    );
  }
  const dotSize = size === 'xs' ? 'h-1 w-1' : size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return (
    <span
      className={`inline-block rounded-full ${dotSize} ${AVAILABILITY_DOT[status]} ${className}`}
      aria-label={LABEL[status]}
      title={LABEL[status]}
    />
  );
}

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
      {withDot && <AvailabilityGlyph status={status} size={size === 'md' ? 'sm' : size} />}
      {LABEL[status]}
    </span>
  );
}
