import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SupabaseConfigGate } from '@/components/SupabaseConfigGate';
import { AppShell } from '@/components/Layout/AppShell';
import { Layout } from '@/components/Layout';
import { Placeholder } from '@/pages/Placeholder';
import { BoardPage } from '@/pages/BoardPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { CirclePage } from '@/pages/CirclePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { EisenhowerPage } from '@/pages/EisenhowerPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { MementoMoriPage } from '@/pages/MementoMoriPage';
import { ReflectionsPage } from '@/pages/ReflectionsPage';
import { RecetarioPage } from '@/pages/RecetarioPage';
import { FinancesPage } from '@/pages/FinancesPage';
import { LoginPage } from '@/pages/Login';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';

function AuthLoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
    </div>
  );
}

/** Rutas autenticadas: un solo ProtectedRoute + shell estable. */
function AuthenticatedTree() {
  return (
    <ProtectedRoute fallback={<AuthLoadingScreen />}>
      <Outlet />
    </ProtectedRoute>
  );
}

/**
 * Si una página lanza error, el shell no se queda en blanco.
 */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-text-primary">No se pudo cargar esta sección</p>
          <p className="max-w-md text-xs text-text-muted">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-accent-teal"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign('/board');
            }}
          >
            Volver a Tareas
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <SupabaseConfigGate>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <SettingsProvider>
              <TooltipProvider>
                <NotificationBootstrap />
                <OfflineBanner />
                <PwaUpdateBanner />
                <PwaInstallBanner />
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  <Route element={<AuthenticatedTree />}>
                    {/* path="/" ancla el shell; hijos relativos: board, dashboard, … */}
                    <Route path="/" element={<AppShell />}>
                      <Route index element={<Navigate to="/board" replace />} />
                      <Route
                        path="board"
                        element={
                          <RouteErrorBoundary>
                            <BoardPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="dashboard"
                        element={
                          <RouteErrorBoundary>
                            <DashboardPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="notifications"
                        element={
                          <RouteErrorBoundary>
                            <NotificationsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="eisenhower"
                        element={
                          <RouteErrorBoundary>
                            <EisenhowerPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="memento-mori"
                        element={
                          <RouteErrorBoundary>
                            <MementoMoriPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="reflections"
                        element={
                          <RouteErrorBoundary>
                            <ReflectionsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="recetario"
                        element={
                          <RouteErrorBoundary>
                            <RecetarioPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="finances"
                        element={
                          <RouteErrorBoundary>
                            <FinancesPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="projects"
                        element={
                          <RouteErrorBoundary>
                            <ProjectsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="circle"
                        element={
                          <RouteErrorBoundary>
                            <CirclePage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="analytics"
                        element={
                          <RouteErrorBoundary>
                            <AnalyticsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <RouteErrorBoundary>
                            <SettingsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="activity"
                        element={
                          <RouteErrorBoundary>
                            <ActivityPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="admin"
                        element={
                          <RouteErrorBoundary>
                            <Layout title="Admin" showFab={false}>
                              <Placeholder
                                title="Admin"
                                description="Analytics, Estado web, Fallos. Próxima sesión."
                              />
                            </Layout>
                          </RouteErrorBoundary>
                        }
                      />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/board" replace />} />
                </Routes>
              </TooltipProvider>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </SupabaseConfigGate>
  );
}

export default App;
