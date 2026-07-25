import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { getDeviceTimezone } from '@/lib/localNotifications';

/**
 * Arranca el scheduler de notificaciones locales y sincroniza timezone al perfil.
 */
export function NotificationBootstrap() {
  useNotificationScheduler();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const tz = getDeviceTimezone();
    // Solo auto-rellena si el perfil aún no tiene zona (default UTC del bootstrap).
    if (tz && (!settings.timezone || settings.timezone === 'UTC') && tz !== 'UTC') {
      void updateSettings({ timezone: tz });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
