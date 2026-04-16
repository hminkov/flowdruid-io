import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { trpc, createTrpcClient } from './lib/trpc';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { StandupPage } from './pages/StandupPage';
import { LeaveRequestPage } from './pages/LeaveRequestPage';
import { LeaveCalendarPage } from './pages/LeaveCalendarPage';
import { ApproveLeavesPage } from './pages/ApproveLeavesPage';
import { UsersRolesPage } from './pages/UsersRolesPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { AllTeamsPage } from './pages/AllTeamsPage';

export function App() {
  const [trpcClient] = useState(createTrpcClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout><DashboardPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <Layout><TasksPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/standup"
                element={
                  <ProtectedRoute>
                    <Layout><StandupPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <Layout><LeaveCalendarPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leave/request"
                element={
                  <ProtectedRoute>
                    <Layout><LeaveRequestPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/leaves"
                element={
                  <ProtectedRoute requiredRole="TEAM_LEAD">
                    <Layout><ApproveLeavesPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/all-teams"
                element={
                  <ProtectedRoute requiredRole="TEAM_LEAD">
                    <Layout><AllTeamsPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Layout><UsersRolesPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/integrations"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Layout><IntegrationsPage /></Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
