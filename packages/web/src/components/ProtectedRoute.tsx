import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRef, type ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Pantalla de carga solo en el primer arranque de sesión. */
  fallback?: ReactNode;
}

/**
 * No vuelve a mostrar el loader a pantalla completa en cada cambio de ruta.
 * Solo bloquea mientras la sesión inicial no está resuelta.
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Una vez autenticados, no re-flash aunque loading parpadee.
  const wasAuthed = useRef(false);
  if (user) wasAuthed.current = true;

  if (loading && !wasAuthed.current) {
    return (
      fallback ?? (
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      )
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
