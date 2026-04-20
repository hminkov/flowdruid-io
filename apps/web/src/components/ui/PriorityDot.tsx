type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

const COLORS: Record<Priority, string> = {
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};

export function PriorityDot({ priority, size = 7 }: { priority: Priority; size?: number }) {
  return (
    <span
      title={`${priority.toLowerCase()} priority`}
      className={`inline-block shrink-0 rounded-full ${COLORS[priority]}`}
      style={{ width: size, height: size }}
    />
  );
}
