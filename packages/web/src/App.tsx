import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SupabaseConfigGate } from '@/components/SupabaseConfigGate';
import { Layout } from '@/components/Layout';
import { Placeholder } from '@/pages/Placeholder';
import { BoardPage } from '@/pages/BoardPage';
import { LoginPage } from '@/pages/Login';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';

// Pages secundarias: lazy para chunks separados y cargar sólo si se navega.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const EisenhowerPage = lazy(() =>
  import('@/pages/EisenhowerPage').then(m => ({ default: m.EisenhowerPage }))
);
const ActivityPage = lazy(() =>
  import('@/pages/ActivityPage').then(m => ({ default: m.ActivityPage }))
);

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
    </div>
  );
}

function lazyRoute(El: React.ComponentType): React.ReactNode {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageFallback />}>
        <El />
      </Suspense>
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
                <PwaInstallBanner />
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Navigate to="/board" replace />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/board"
                    element={
                      <ProtectedRoute>
                        <BoardPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/dashboard" element={lazyRoute(DashboardPage)} />
                  <Route path="/eisenhower" element={lazyRoute(EisenhowerPage)} />
                  <Route path="/projects" element={lazyRoute(ProjectsPage)} />
                  <Route path="/analytics" element={lazyRoute(AnalyticsPage)} />
                  <Route path="/settings" element={lazyRoute(SettingsPage)} />

                  <Route path="/activity" element={lazyRoute(ActivityPage)} />

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <Layout title="Admin" showFab={false}>
                          <Placeholder
                            title="Admin"
                            description="Analytics, Estado web, Fallos. Próxima sesión."
                          />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
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
