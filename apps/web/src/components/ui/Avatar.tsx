import type { CSSProperties } from 'react';

const AVATAR_PALETTES = [
  { bg: 'var(--avatar-1-bg)', text: 'var(--avatar-1-text)' },
  { bg: 'var(--avatar-2-bg)', text: 'var(--avatar-2-text)' },
  { bg: 'var(--avatar-3-bg)', text: 'var(--avatar-3-text)' },
  { bg: 'var(--avatar-4-bg)', text: 'var(--avatar-4-text)' },
  { bg: 'var(--avatar-5-bg)', text: 'var(--avatar-5-text)' },
  { bg: 'var(--avatar-6-bg)', text: 'var(--avatar-6-text)' },
] as const;

export function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]!;
}

type Props = {
  userId: string;
  initials: string;
  name?: string;
  size?: number;
  ring?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Round avatar with a hash-stable colour palette derived from the user id.
 * No shadow, no ring by default — pass `ring` when overlapping (stack).
 */
export function Avatar({
  userId,
  initials,
  name,
  size = 28,
  ring = false,
  className = '',
  style,
}: Props) {
  const palette = paletteFor(userId);
  const fontSize =
    size <= 20 ? '9px' : size <= 24 ? '10px' : size <= 28 ? '11px' : size <= 36 ? '12px' : '13px';

  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-full ${
        ring ? 'ring-2 ring-surface-primary' : ''
      } ${className}`}
      style={{
        width: size,
        height: size,
        background: palette.bg,
        color: palette.text,
        fontSize,
        ...style,
      }}
    >
      {initials}
    </span>
  );
}
