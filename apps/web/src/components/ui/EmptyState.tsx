import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  message,
  cta,
  className = '',
}: {
  icon?: ReactNode;
  title?: string;
  message?: string;
  cta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center ${className}`}
    >
      {icon && (
        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-text-tertiary">
          {icon}
        </div>
      )}
      {title && <p className="text-md text-text-primary">{title}</p>}
      {message && <p className="mt-1 text-sm text-text-secondary">{message}</p>}
      {cta && <div className="mt-3 flex justify-center">{cta}</div>}
    </div>
  );
}
