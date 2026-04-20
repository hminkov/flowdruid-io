type Ref = { createdAt?: string | Date | null; updatedAt?: string | Date | null };

/**
 * 14-day booking-density mini chart.
 * Each bar = one day, height proportional to bookings touched that day
 * (createdAt OR updatedAt falling in the day). Purely presentational.
 */
export function BookingSparkline({ refs }: { refs: Ref[] }) {
  const days = 14;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const counts = new Array(days).fill(0);

  for (const r of refs) {
    const timestamps = [r.createdAt, r.updatedAt].filter(Boolean) as (string | Date)[];
    for (const t of timestamps) {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
      if (diffDays >= 0 && diffDays < days) {
        counts[days - 1 - diffDays] += 1;
      }
    }
  }

  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-text-tertiary">
        <span>Last 14 days</span>
        <span>{total} {total === 1 ? 'event' : 'events'}</span>
      </div>
      <div className="flex h-8 items-end gap-0.5" aria-label="Booking activity, last 14 days">
        {counts.map((c, i) => {
          const pct = (c / max) * 100;
          const empty = c === 0;
          return (
            <div
              key={i}
              title={`Day ${-(days - 1 - i)}: ${c} event${c === 1 ? '' : 's'}`}
              className="flex-1 rounded-sm"
              style={{
                height: empty ? '4px' : `${Math.max(8, pct)}%`,
                background: empty ? 'var(--border-default)' : 'var(--brand-500)',
                opacity: empty ? 0.5 : 0.7 + 0.3 * (c / max),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
