const tone = (pct: number) =>
  pct >= 90 ? 'bg-capacity-full' : pct >= 70 ? 'bg-capacity-high' : 'bg-capacity-normal';

type Props = {
  pct: number;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
};

export function CapacityBar({ pct, size = 'sm', showLabel = true, className = '' }: Props) {
  const height = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${height} flex-1 overflow-hidden rounded-full bg-surface-secondary`}>
        <div className={`h-full ${tone(pct)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {showLabel && <span className="text-xs tabular-nums text-text-tertiary">{pct}%</span>}
    </div>
  );
}
