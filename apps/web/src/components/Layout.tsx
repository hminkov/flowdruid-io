import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', minRole: 'DEVELOPER' as const },
  { path: '/tasks', label: 'Tasks', minRole: 'DEVELOPER' as const },
  { path: '/standup', label: 'Standup', minRole: 'DEVELOPER' as const },
  { path: '/calendar', label: 'Calendar', minRole: 'DEVELOPER' as const },
  { path: '/leave/request', label: 'Leave', minRole: 'DEVELOPER' as const },
  { path: '/admin/leaves', label: 'Approve Leaves', minRole: 'TEAM_LEAD' as const },
  { path: '/all-teams', label: 'All Teams', minRole: 'TEAM_LEAD' as const },
  { path: '/admin/users', label: 'Users', minRole: 'ADMIN' as const },
  { path: '/admin/integrations', label: 'Integrations', minRole: 'ADMIN' as const },
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-gradient-to-b from-primary-800 to-primary-900 text-white shadow-lg">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold shadow-sm">
            F
          </span>
          <span className="text-xl font-bold tracking-tight">Flowdruid</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-primary-600/80 text-white shadow-sm'
                    : 'text-primary-100 hover:bg-primary-700/60 hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-white" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-primary-700/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-primary-300">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-primary-700 px-3 py-1.5 text-xs font-medium text-primary-200 transition-colors hover:border-primary-500 hover:bg-primary-700/50 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  );
}
