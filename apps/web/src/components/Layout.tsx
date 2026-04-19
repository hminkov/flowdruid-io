import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const Icon = {
  Dashboard: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Tasks: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  Standup: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2l-3 3v-3H9a2 2 0 0 1-2-2" />
      <path d="M14 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10l3-3h6a2 2 0 0 0 2-2Z" />
    </svg>
  ),
  Calendar: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Leave: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v6M12 2 9 5M12 2l3 3" />
      <path d="M5 12h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  Approve: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  Teams: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Integrations: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="2" width="9" height="9" rx="1" />
      <rect x="13" y="13" width="9" height="9" rx="1" />
      <path d="M11 6.5h4a2 2 0 0 1 2 2V13M6.5 13v-1.5" />
    </svg>
  ),
  Logout: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  ),
};

const navItems = [
  { path: '/dashboard', label: 'Dashboard', minRole: 'DEVELOPER' as const, icon: Icon.Dashboard },
  { path: '/tasks', label: 'Tasks', minRole: 'DEVELOPER' as const, icon: Icon.Tasks },
  { path: '/standup', label: 'Standup', minRole: 'DEVELOPER' as const, icon: Icon.Standup },
  { path: '/calendar', label: 'Calendar', minRole: 'DEVELOPER' as const, icon: Icon.Calendar },
  { path: '/leave/request', label: 'Leave', minRole: 'DEVELOPER' as const, icon: Icon.Leave },
  { path: '/admin/leaves', label: 'Approve Leaves', minRole: 'TEAM_LEAD' as const, icon: Icon.Approve },
  { path: '/all-teams', label: 'All Teams', minRole: 'TEAM_LEAD' as const, icon: Icon.Teams },
  { path: '/admin/users', label: 'Users', minRole: 'ADMIN' as const, icon: Icon.Users },
  { path: '/admin/integrations', label: 'Integrations', minRole: 'ADMIN' as const, icon: Icon.Integrations },
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

  const visibleNav = navItems.filter(
    (item) => user && roleHierarchy[user.role] >= roleHierarchy[item.minRole]
  );

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const currentLabel = navItems.find((i) => i.path === location.pathname)?.label ?? '';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-gradient-to-b from-primary-800 via-primary-800 to-primary-900 text-white shadow-xl">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-base font-bold shadow-lg ring-1 ring-white/10">
            F
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">Flowdruid</span>
            <span className="text-[10px] uppercase tracking-widest text-primary-300">
              Workspace
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            const IconCmp = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-primary-600/80 text-white shadow-sm'
                    : 'text-primary-100 hover:bg-primary-700/60 hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-white" />
                )}
                <IconCmp
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    active ? 'text-white' : 'text-primary-300 group-hover:text-white'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-primary-700/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-semibold shadow ring-2 ring-primary-800">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-primary-300">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-primary-700 px-3 py-1.5 text-xs font-medium text-primary-200 transition-colors hover:border-primary-500 hover:bg-primary-700/50 hover:text-white"
          >
            <Icon.Logout className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {currentLabel}
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            All systems operational
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
