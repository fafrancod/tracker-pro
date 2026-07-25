import { lazy, useEffect } from 'react';
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
import { LoginPage } from '@/pages/Login';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';

// Lazy: el shell permanece montado; solo el outlet muestra un spinner suave.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
);
const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then(m => ({ default: m.ProjectsPage }))
);
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage }))
);
const EisenhowerPage = lazy(() =>
  import('@/pages/EisenhowerPage').then(m => ({ default: m.EisenhowerPage }))
);
const ActivityPage = lazy(() =>
  import('@/pages/ActivityPage').then(m => ({ default: m.ActivityPage }))
);
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage }))
);
const MementoMoriPage = lazy(() =>
  import('@/pages/MementoMoriPage').then(m => ({ default: m.MementoMoriPage }))
);
const ReflectionsPage = lazy(() =>
  import('@/pages/ReflectionsPage').then(m => ({ default: m.ReflectionsPage }))
);

/** Prefetch de chunks tras el primer paint para navegación instantánea. */
function PrefetchAppChunks() {
  useEffect(() => {
    const run = () => {
      void import('@/pages/DashboardPage');
      void import('@/pages/SettingsPage');
      void import('@/pages/MementoMoriPage');
      void import('@/pages/ReflectionsPage');
      void import('@/pages/NotificationsPage');
      void import('@/pages/EisenhowerPage');
      void import('@/pages/ProjectsPage');
      void import('@/pages/AnalyticsPage');
      void import('@/pages/ActivityPage');
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = globalThis.setTimeout(run, 1200);
    return () => globalThis.clearTimeout(t);
  }, []);
  return null;
}

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
      <PrefetchAppChunks />
      <Outlet />
    </ProtectedRoute>
  );
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
                    <Route element={<AppShell />}>
                      <Route index element={<Navigate to="/board" replace />} />
                      <Route path="board" element={<BoardPage />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="eisenhower" element={<EisenhowerPage />} />
                      <Route path="memento-mori" element={<MementoMoriPage />} />
                      <Route path="reflections" element={<ReflectionsPage />} />
                      <Route path="projects" element={<ProjectsPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="activity" element={<ActivityPage />} />
                      <Route
                        path="admin"
                        element={
                          <Layout title="Admin" showFab={false}>
                            <Placeholder
                              title="Admin"
                              description="Analytics, Estado web, Fallos. Próxima sesión."
                            />
                          </Layout>
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
