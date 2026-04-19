import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { ChevronDownIcon, LogoutIcon, UserIcon } from './icons';

const avatarPalettes = [
  { bg: 'var(--avatar-1-bg)', text: 'var(--avatar-1-text)' },
  { bg: 'var(--avatar-2-bg)', text: 'var(--avatar-2-text)' },
  { bg: 'var(--avatar-3-bg)', text: 'var(--avatar-3-text)' },
  { bg: 'var(--avatar-4-bg)', text: 'var(--avatar-4-text)' },
  { bg: 'var(--avatar-5-bg)', text: 'var(--avatar-5-text)' },
  { bg: 'var(--avatar-6-bg)', text: 'var(--avatar-6-text)' },
];

const paletteFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

export function UserMenu() {
  const { user, logout } = useAuth();
  const { openUser } = useUserDetail();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const palette = paletteFor(user.id);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const handleViewProfile = () => {
    setOpen(false);
    openUser(user.id);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-border bg-surface-primary px-1 py-0.5 pr-2 text-left transition-colors duration-fast hover:bg-surface-secondary"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs"
          style={{ background: palette.bg, color: palette.text }}
        >
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight md:flex">
          <span className="truncate text-sm text-text-primary">{user.name.split(' ')[0]}</span>
          <span className="truncate text-[10px] text-text-tertiary">
            {user.role.replace('_', ' ').toLowerCase()}
          </span>
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-text-tertiary transition-transform duration-fast ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface-primary shadow-float animate-fade-in"
        >
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs"
                style={{ background: palette.bg, color: palette.text }}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm text-text-primary">{user.name}</div>
                <div className="truncate text-xs text-text-tertiary">{user.email}</div>
              </div>
            </div>
          </div>

          <button
            role="menuitem"
            onClick={handleViewProfile}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <UserIcon className="h-4 w-4" />
            View my profile
          </button>

          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-text-secondary hover:bg-danger-bg hover:text-danger-text"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
