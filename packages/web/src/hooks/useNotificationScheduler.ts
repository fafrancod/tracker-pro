import { useEffect, useRef } from 'react';
import { useStore } from '@core/store';
import { useSettings } from '@/contexts/SettingsContext';
import { rescheduleLocalNotifications } from '@/lib/localNotifications';
import { isDemoMode } from '@core/lib/demoMode';

/**
 * Mantiene el calendario de notificaciones locales alineado con el store.
 * Debounced para no spamear al plugin al editar muchas tareas.
 */
export function useNotificationScheduler(): void {
  const tasksByDay = useStore(s => s.tasksByDay);
  const uid = useStore(s => s.uid);
  const { settings } = useSettings();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid) return;
    if (isDemoMode() && !settings.notifyLocal) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void rescheduleLocalNotifications({
        tasksByDay,
        settings,
        language: settings.language === 'en' ? 'en' : 'es',
      });
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tasksByDay, settings, uid]);
}
