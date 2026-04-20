import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { trpc } from '../lib/trpc';
import { ThemeToggle } from './ThemeToggle';
import { HeaderSearch } from './HeaderSearch';
import { UserMenu } from './UserMenu';
import { OnCallBanner } from './OnCallBanner';
import { BellIcon, XIcon } from './icons';
import { Logo } from './ui/Logo';
import { RouteErrorBoundary } from './ui';
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const Icon = {
  Dashboard: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Tasks: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  Standup: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2l-3 3v-3H9a2 2 0 0 1-2-2" />
      <path d="M14 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10l3-3h6a2 2 0 0 0 2-2Z" />
    </svg>
  ),
  Calendar: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Leave: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v6M12 2 9 5M12 2l3 3" />
      <path d="M5 12h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  Approve: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  Teams: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Integrations: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="2" width="9" height="9" rx="1" />
      <rect x="13" y="13" width="9" height="9" rx="1" />
      <path d="M11 6.5h4a2 2 0 0 1 2 2V13M6.5 13v-1.5" />
    </svg>
  ),
  Inbox: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  ),
  QaEnv: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  Parking: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6h-4" />
    </svg>
  ),
  ProdSupport: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2a10 10 0 1 0 10 10h-4a6 6 0 1 1-6-6z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

type NavItem = {
  path: string;
  label: string;
  minRole: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
  icon: (p: SVGProps<SVGSVGElement>) => JSX.Element;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { path: '/dashboard', label: 'Dashboard', minRole: 'DEVELOPER', icon: Icon.Dashboard },
      { path: '/inbox', label: 'Inbox', minRole: 'DEVELOPER', icon: Icon.Inbox },
      { path: '/tasks', label: 'Tasks & tickets', minRole: 'DEVELOPER', icon: Icon.Tasks },
      { path: '/standup', label: 'Standup feed', minRole: 'DEVELOPER', icon: Icon.Standup },
      { path: '/calendar', label: 'Leave calendar', minRole: 'DEVELOPER', icon: Icon.Calendar },
      { path: '/leave/request', label: 'Leave request', minRole: 'DEVELOPER', icon: Icon.Leave },
    ],
  },
  {
    label: 'Resources',
    items: [
      { path: '/qa', label: 'QA environments', minRole: 'DEVELOPER', icon: Icon.QaEnv },
      { path: '/parking', label: 'Parking', minRole: 'DEVELOPER', icon: Icon.Parking },
      { path: '/prod-support', label: 'Prod support', minRole: 'DEVELOPER', icon: Icon.ProdSupport },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin/leaves', label: 'Approve leaves', minRole: 'TEAM_LEAD', icon: Icon.Approve },
      { path: '/all-teams', label: 'All teams', minRole: 'TEAM_LEAD', icon: Icon.Teams },
      { path: '/admin/users', label: 'Users & roles', minRole: 'ADMIN', icon: Icon.Users },
      { path: '/admin/integrations', label: 'Integrations', minRole: 'ADMIN', icon: Icon.Integrations },
    ],
  },
];

const roleHierarchy = { ADMIN: 3, TEAM_LEAD: 2, DEVELOPER: 1 };

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000, // lightweight polling — real-time wiring lands alongside WebSocket push
  });
  const unreadCount = unreadQuery.data ?? 0;

  const visibleSections = user
    ? navSections
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => roleHierarchy[user.role] >= roleHierarchy[i.minRole]),
        }))
        .filter((s) => s.items.length > 0)
    : [];

  const allVisibleItems = visibleSections.flatMap((s) => s.items);

  const currentItem = allVisibleItems.find((i) => i.path === location.pathname);
  const currentLabel = currentItem?.label ?? '';
  const CurrentIcon = currentItem?.icon;
  const currentSection = visibleSections.find((s) =>
    s.items.some((i) => i.path === location.pathname)
  );

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex h-screen bg-surface-tertiary">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-drawer bg-[var(--overlay-backdrop)] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
        className={`fixed inset-y-0 left-0 z-drawer flex w-64 flex-col border-r border-border transition-transform duration-default md:static md:translate-x-0 md:w-16 lg:w-64 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}>
            <Logo variant="wordmark" size={28} />
          </div>
          <div className={`${mobileOpen ? 'hidden' : 'block'} lg:hidden`}>
            <Logo size={28} />
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-white/10 hover:text-text-primary md:hidden"
            aria-label="Close menu"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {visibleSections.map((section, idx) => (
            <div key={section.label} className={idx === 0 ? '' : 'mt-4'}>
              <div className={`mb-1 px-3 ${mobileOpen ? 'block' : 'hidden'} lg:block`}>
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary">
                  {section.label}
                </span>
              </div>
              {idx > 0 && !mobileOpen && (
                <div className="mx-2 mb-2 border-t border-border md:block lg:hidden" aria-hidden="true" />
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = location.pathname === item.path;
                  const IconCmp = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`group flex items-center gap-3 rounded px-3 py-2 text-base transition-colors duration-fast ${
                        active
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'
                      }`}
                    >
                      <IconCmp className="h-4 w-4 shrink-0" />
                      <span className={`${mobileOpen ? 'inline' : 'hidden'} lg:inline`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user && (
          <div className="border-t border-border p-3">
            <button
              onClick={() => openUser(user.id)}
              title="View my profile"
              className="flex w-full items-center gap-3 rounded p-1 text-left transition-colors duration-fast hover:bg-white/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
                {initials}
              </span>
              <div className={`${mobileOpen ? 'block' : 'hidden'} min-w-0 flex-1 lg:block`}>
                <p className="truncate text-base text-text-primary">{user.name}</p>
                <p className="text-xs text-text-tertiary">
                  {user.role.replace('_', ' ').toLowerCase()}
                </p>
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-2 border-b border-border bg-surface-primary px-3 md:gap-4 md:px-6">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-surface-secondary hover:text-text-primary md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Left — breadcrumb */}
          <div className="flex min-w-0 items-center gap-2">
            {currentSection && (
              <>
                <span className="hidden text-xs text-text-tertiary md:inline">
                  {currentSection.label}
                </span>
                <span className="hidden text-text-tertiary md:inline">/</span>
              </>
            )}
            <div className="flex items-center gap-1.5">
              {CurrentIcon && (
                <CurrentIcon className="h-4 w-4 shrink-0 text-brand-600" />
              )}
              <h2 className="truncate text-md text-text-primary">{currentLabel}</h2>
            </div>
          </div>

          {/* Center — search (hidden on smallest screens) */}
          <div className="mx-auto hidden w-full max-w-sm sm:flex">
            <HeaderSearch />
          </div>

          {/* Right — actions */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
            <Link
              to="/inbox"
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-primary text-text-secondary transition-colors duration-fast hover:border-border-strong hover:text-text-primary"
              title={
                unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'Inbox'
              }
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread notifications`
                  : 'Inbox'
              }
            >
              <BellIcon className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-bg px-1 text-[10px] text-danger-text ring-2 ring-surface-primary">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <OnCallBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <RouteErrorBoundary>{children}</RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
