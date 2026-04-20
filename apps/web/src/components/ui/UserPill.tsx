import { useUserDetail } from '../../hooks/useUserDetail';
import { Avatar } from './Avatar';

type Props = {
  userId: string;
  name: string;
  initials: string;
  subtitle?: string; // e.g. team name
  size?: 'sm' | 'md';
};

/**
 * Clickable "name + avatar" chip that opens the user-detail drawer.
 */
export function UserPill({ userId, name, initials, subtitle, size = 'md' }: Props) {
  const { openUser } = useUserDetail();
  const avatarSize = size === 'sm' ? 20 : 24;
  const paddingClass = size === 'sm' ? 'py-0.5 pl-0.5 pr-2' : 'py-1 pl-1 pr-3';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <button
      type="button"
      onClick={() => openUser(userId)}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary ${paddingClass} text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-secondary`}
    >
      <Avatar userId={userId} initials={initials} name={name} size={avatarSize} />
      <span className="min-w-0">
        <span className={`truncate ${textClass} text-text-primary`}>{name}</span>
        {subtitle && (
          <span className="block truncate text-[10px] text-text-tertiary">{subtitle}</span>
        )}
      </span>
    </button>
  );
}
