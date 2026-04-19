import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './ui/Logo';
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
  Logout: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
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
      { path: '/tasks', label: 'Tasks & tickets', minRole: 'DEVELOPER', icon: Icon.Tasks },
      { path: '/standup', label: 'Standup feed', minRole: 'DEVELOPER', icon: Icon.Standup },
      { path: '/calendar', label: 'Leave calendar', minRole: 'DEVELOPER', icon: Icon.Calendar },
      { path: '/leave/request', label: 'Leave request', minRole: 'DEVELOPER', icon: Icon.Leave },
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleSections = user
    ? navSections
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => roleHierarchy[user.role] >= roleHierarchy[i.minRole]),
        }))
        .filter((s) => s.items.length > 0)
    : [];

  const allVisibleItems = visibleSections.flatMap((s) => s.items);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const currentLabel = allVisibleItems.find((i) => i.path === location.pathname)?.label ?? '';

  return (
    <div className="flex h-screen bg-surface-tertiary">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col border-r border-border bg-surface-primary lg:w-64">
        <div className="flex h-12 items-center border-b border-border px-4">
          <div className="hidden lg:block">
            <Logo variant="wordmark" size={28} />
          </div>
          <div className="lg:hidden">
            <Logo size={28} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {visibleSections.map((section, idx) => (
            <div key={section.label} className={idx === 0 ? '' : 'mt-4'}>
              <div className="mb-1 hidden px-3 lg:block">
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary">
                  {section.label}
                </span>
              </div>
              {idx > 0 && (
                <div className="mx-2 mb-2 border-t border-border lg:hidden" aria-hidden="true" />
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
                          : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                      }`}
                    >
                      <IconCmp className="h-4 w-4 shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="hidden items-center gap-3 lg:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--avatar-1-bg)] text-xs text-[var(--avatar-1-text)]">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base text-text-primary">{user?.name}</p>
              <p className="text-xs text-text-tertiary">{user?.role.replace('_', ' ').toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-border px-3 py-1 text-base text-text-secondary transition-colors duration-fast hover:border-border-strong hover:bg-surface-secondary hover:text-text-primary"
            title="Sign out"
          >
            <Icon.Logout className="h-4 w-4" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center justify-between border-b border-border bg-surface-primary px-6">
          <h2 className="text-md text-text-primary">{currentLabel}</h2>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-text-tertiary sm:flex">
              <span className="h-1 w-1 rounded-full bg-success-text" />
              All systems operational
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
