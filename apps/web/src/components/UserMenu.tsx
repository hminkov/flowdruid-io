import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { trpc } from '../lib/trpc';
import { Avatar, AVAILABILITY_DOT, useToast } from './ui';
import { CalendarIcon, ChevronDownIcon, LogoutIcon, PlaneIcon, UserIcon } from './icons';

type Availability = 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';

const QUICK_SWITCH: Availability[] = ['AVAILABLE', 'BUSY', 'REMOTE'];

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateAvailability = trpc.users.updateAvailability.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      utils.teams.list.invalidate();
    },
    onError: (err) =>
      toast.push({ kind: 'error', title: 'Availability update failed', message: err.message }),
  });

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

  const initials =
    user.initials ??
    user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  const currentAvailability: Availability = user.availability ?? 'AVAILABLE';

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const handleSetAvailability = (a: Availability) => {
    if (a === currentAvailability) return;
    updateAvailability.mutate({ availability: a });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-border bg-surface-primary px-1 py-0.5 pr-2 text-left transition-colors duration-fast hover:bg-surface-secondary"
      >
        <div className="relative">
          <Avatar userId={user.id} initials={initials} name={user.name} size={28} />
          {/* Availability dot overlay */}
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-primary ${AVAILABILITY_DOT[currentAvailability]}`}
            aria-label={currentAvailability.replace('_', ' ').toLowerCase()}
          />
        </div>
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
          className="absolute right-0 top-full z-dropdown mt-1 w-64 overflow-hidden rounded-lg border border-border bg-surface-primary shadow-float animate-fade-in"
        >
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2">
              <Avatar userId={user.id} initials={initials} name={user.name} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm text-text-primary">{user.name}</div>
                <div className="truncate text-xs text-text-tertiary">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Availability quick-switch */}
          <div className="border-b border-border p-3">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-text-tertiary">
              Availability
            </div>
            <div className="flex gap-1 rounded-pill border border-border bg-surface-secondary p-0.5">
              {QUICK_SWITCH.map((opt) => {
                const active = currentAvailability === opt;
                return (
                  <button
                    key={opt}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => handleSetAvailability(opt)}
                    disabled={updateAvailability.isPending}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-pill px-2 py-1 text-xs transition-colors duration-fast ${
                      active
                        ? 'bg-brand-600 text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${AVAILABILITY_DOT[opt]}`} />
                    {opt.toLowerCase()}
                  </button>
                );
              })}
            </div>
            <Link
              to="/leave/request"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              <PlaneIcon className="h-3 w-3" />
              Planning time off? Request leave →
            </Link>
          </div>

          <Link
            role="menuitem"
            to="/me"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <UserIcon className="h-4 w-4" />
            My profile & settings
          </Link>
          <Link
            role="menuitem"
            to="/calendar"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <CalendarIcon className="h-4 w-4" />
            Leave calendar
          </Link>

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
