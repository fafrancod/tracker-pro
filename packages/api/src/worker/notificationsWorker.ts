import { config } from '../config.js';
import { logger } from '../logger.js';
import { dispatchDueEmailNotifications } from '../lib/notificationDispatch.js';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Worker embebido: cada N segundos intenta enviar emails debidos.
 * Seguro si falla (no tumba el proceso). Desactivar con RUN_EMBEDDED_WORKER=false.
 */
export function startNotificationsWorker(): void {
  if (!config.worker.runEmbedded) {
    logger.info('notifications worker disabled (RUN_EMBEDDED_WORKER=false)');
    return;
  }
  if (timer) return;

  const interval = Math.max(15_000, config.worker.notificationsIntervalMs || 60_000);

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await dispatchDueEmailNotifications();
      if (summary.candidates > 0 || summary.sent > 0 || summary.failed > 0) {
        logger.info(summary, 'notifications worker tick');
      }
    } catch (err) {
      logger.error({ err }, 'notifications worker tick failed');
    } finally {
      running = false;
    }
  };

  // Primera pasada tras un breve delay (dejar que Supabase/env arranquen)
  setTimeout(() => {
    void tick();
  }, 8_000).unref?.();

  timer = setInterval(() => {
    void tick();
  }, interval);
  timer.unref?.();

  logger.info({ intervalMs: interval }, 'notifications worker started');
}

export function stopNotificationsWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
