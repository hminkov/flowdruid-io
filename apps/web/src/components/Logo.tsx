import type { SVGProps } from 'react';

type MarkProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Flowdruid brand mark: rounded-square with a gradient and a stylised "F"
 * whose middle stroke is a flow curve — the only non-negotiable motif.
 */
export function FlowdruidMark({ size = 28, className = '', ...rest }: MarkProps) {
  const gradId = `fd-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7F77DD" />
          <stop offset="100%" stopColor="#3C3489" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      {/* Vertical stem */}
      <path
        d="M10.5 8 V 24"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Top horizontal */}
      <path
        d="M10.5 9 H 21.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Middle: wave curve suggesting flow */}
      <path
        d="M10.5 16 q 2.3 -2.8 4.6 0 t 4.4 0"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

type WordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: boolean;
  className?: string;
};

/**
 * Mark + "Flowdruid" wordmark, optionally with the "by Cloudruid" subtitle.
 */
export function FlowdruidLogo({ size = 'md', subtitle = false, className = '' }: WordmarkProps) {
  const markPx = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;
  const titleClass =
    size === 'sm' ? 'text-md' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <FlowdruidMark size={markPx} />
      <div className="flex flex-col leading-tight">
        <span className={`${titleClass} tracking-tight`}>Flowdruid</span>
        {subtitle && (
          <span className="text-xs opacity-70">
            by <span className="tracking-wide">Cloudruid</span>
          </span>
        )}
      </div>
    </div>
  );
}
