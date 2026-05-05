import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requiredRole?: 'ADMIN' | 'TEAM_LEAD';
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin of a freshly auto-provisioned (Google) workspace lands on
  // /onboarding instead of /dashboard until they finish setup. The
  // /onboarding route itself is exempt so we don't loop.
  if (
    user.role === 'ADMIN' &&
    user.orgOnboarded === false &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredRole) {
    const roleHierarchy = { ADMIN: 3, TEAM_LEAD: 2, DEVELOPER: 1 };
    if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
