import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { getDeviceTimezone } from '@/lib/localNotifications';

/**
 * Arranca el scheduler de notificaciones locales y sincroniza timezone al perfil.
 * Sin sesión no escribe settings (landing / login anónimo).
 */
export function NotificationBootstrap() {
  useNotificationScheduler();
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    if (!user) return;
    const tz = getDeviceTimezone();
    // Solo auto-rellena si el perfil aún no tiene zona (default UTC del bootstrap).
    if (tz && (!settings.timezone || settings.timezone === 'UTC') && tz !== 'UTC') {
      void updateSettings({ timezone: tz });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
