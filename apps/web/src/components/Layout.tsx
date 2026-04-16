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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-primary-800 text-white">
        <div className="flex h-14 items-center px-4">
          <span className="text-xl font-bold tracking-tight">Flowdruid</span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block rounded px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-100 hover:bg-primary-700 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-primary-700 px-4 py-3">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-primary-300">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs text-primary-300 hover:text-white"
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
