import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { trpc, createTrpcClient } from './lib/trpc';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './hooks/useAuth';
import { UserDetailProvider } from './hooks/useUserDetail';
import { TeamDetailProvider } from './hooks/useTeamDetail';
import { KeyboardShortcutsProvider } from './hooks/useKeyboardShortcuts';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ToastProvider, ConfirmProvider, RouteErrorBoundary } from './components/ui';
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
import { QaEnvironmentsPage } from './pages/QaEnvironmentsPage';
import { ParkingPage } from './pages/ParkingPage';
import { ProdSupportPage } from './pages/ProdSupportPage';
import { TicketShortlinkPage } from './pages/TicketShortlinkPage';
import { ProfilePage } from './pages/ProfilePage';
import { InboxPage } from './pages/InboxPage';
import { AuditLogPage } from './pages/AuditLogPage';

export function App() {
  const [trpcClient] = useState(createTrpcClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
            <ConfirmProvider>
            <UserDetailProvider>
            <TeamDetailProvider>
            <KeyboardShortcutsProvider>
            <ShortcutsHelp />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/t/:ticketId"
                element={
                  <ProtectedRoute>
                    <TicketShortlinkPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/me"
                element={
                  <ProtectedRoute>
                    <Layout><ProfilePage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inbox"
                element={
                  <ProtectedRoute>
                    <Layout><InboxPage /></Layout>
                  </ProtectedRoute>
                }
              />
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
                path="/qa"
                element={
                  <ProtectedRoute>
                    <Layout><QaEnvironmentsPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parking"
                element={
                  <ProtectedRoute>
                    <Layout><ParkingPage /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prod-support"
                element={
                  <ProtectedRoute>
                    <Layout><ProdSupportPage /></Layout>
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
              <Route
                path="/admin/audit"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Layout><AuditLogPage /></Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
            </KeyboardShortcutsProvider>
            </TeamDetailProvider>
            </UserDetailProvider>
            </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
