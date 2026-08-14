import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isDemoMode } from '@core/lib/demoMode';
import { sendPresenceHeartbeat } from '@core/services/adminService';
import { useAuth } from '@/contexts/AuthContext';
import { appVersion } from '@/lib/appVersion';
import { isNativePlatform } from '@/lib/capacitor';

const INTERVAL_MS = 45_000;

/**
 * Presencia ligera: el panel admin usa last_seen para marcar online.
 * No bloquea la UI; si falla (SQL no aplicado) se ignora.
 */
export function AdminHeartbeat() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user || isDemoMode()) return;

    let cancelled = false;

    const ping = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void sendPresenceHeartbeat({
        path: location.pathname.slice(0, 200),
        appVersion: appVersion.version.slice(0, 40),
        platform: isNativePlatform() ? 'native' : 'web',
      }).catch(() => undefined);
    };

    ping();
    const timer = window.setInterval(ping, INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user, location.pathname]);

  return null;
}
