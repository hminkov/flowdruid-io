// apps/web/src/components/ui/Logo.tsx
//
// Flowdruid logo — rotating triskelion with optional wordmark.
//
// Usage:
//   <Logo />                         — default 32px animated mark
//   <Logo size={48} />               — larger
//   <Logo variant="wordmark" />      — mark + "Flowdruid" text
//   <Logo animated={false} />        — static (for email, print, prefers-reduced-motion contexts)
//   <Logo color="#FFFFFF" />         — override fill colour (e.g. on dark backgrounds)
//
// The mark uses CSS @keyframes and automatically respects
// `prefers-reduced-motion` — no JS needed to pause animation
// for users who disable motion.

import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  variant?: 'mark' | 'wordmark';
  animated?: boolean;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

export function Logo({
  size = 32,
  variant = 'mark',
  animated = true,
  color,
  className = '',
  style,
}: LogoProps) {
  if (variant === 'wordmark') {
    return (
      <span
        className={`inline-flex items-center gap-2 ${className}`}
        style={style}
      >
        <LogoMark size={size} animated={animated} color={color} />
        <span
          className="font-medium tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.72) }}
        >
          Flow
          <span style={{ color: color ?? 'var(--brand-600, #534AB7)' }}>
            druid
          </span>
        </span>
      </span>
    );
  }

  return (
    <LogoMark
      size={size}
      animated={animated}
      color={color}
      className={className}
      style={style}
    />
  );
}

type LogoMarkProps = {
  size: number;
  animated: boolean;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

function LogoMark({ size, animated, color, className = '', style }: LogoMarkProps) {
  const fill = color ?? 'var(--brand-600, #534AB7)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Flowdruid"
      className={className}
      style={style}
    >
      <title>Flowdruid</title>
      <g
        className={animated ? 'fd-logo-rotate' : undefined}
        style={
          animated
            ? {
                transformOrigin: '32px 32px',
                animation: 'fd-logo-spin 20s linear infinite',
              }
            : undefined
        }
      >
        <g transform="translate(32 32)">
          <path
            d="M 0 -4 C 6 -10, 18 -14, 20 -26 C 14 -24, 4 -20, 0 -4 Z"
            fill={fill}
          />
          <g transform="rotate(120)">
            <path
              d="M 0 -4 C 6 -10, 18 -14, 20 -26 C 14 -24, 4 -20, 0 -4 Z"
              fill={fill}
            />
          </g>
          <g transform="rotate(240)">
            <path
              d="M 0 -4 C 6 -10, 18 -14, 20 -26 C 14 -24, 4 -20, 0 -4 Z"
              fill={fill}
            />
          </g>
          <circle r="4" fill={fill} />
        </g>
      </g>
    </svg>
  );
}

/*
 * Add these keyframes once to your global CSS (globals.css).
 * Inlining them in every component would duplicate rules on every render.
 *
 * @keyframes fd-logo-spin {
 *   from { transform: rotate(0deg); }
 *   to   { transform: rotate(360deg); }
 * }
 * @media (prefers-reduced-motion: reduce) {
 *   .fd-logo-rotate { animation: none !important; }
 * }
 */
