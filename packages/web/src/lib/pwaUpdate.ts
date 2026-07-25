/**
 * Actualización de PWA (app instalada en escritorio / móvil).
 * Usa virtual:pwa-register de vite-plugin-pwa.
 */

export type PwaUpdateListener = (state: {
  needRefresh: boolean;
  offlineReady: boolean;
}) => void;

let needRefresh = false;
let offlineReady = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<PwaUpdateListener>();

function emit() {
  const state = { needRefresh, offlineReady };
  listeners.forEach(fn => {
    try {
      fn(state);
    } catch {
      /* ignore */
    }
  });
}

/** true si corre como ventana instalada (standalone / iOS home screen). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function subscribePwaUpdate(listener: PwaUpdateListener): () => void {
  listeners.add(listener);
  listener({ needRefresh, offlineReady });
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaUpdateState() {
  return { needRefresh, offlineReady };
}

/**
 * Aplica la nueva versión del service worker y recarga la página.
 */
export async function applyPwaUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW(true);
    return;
  }
  window.location.reload();
}

/**
 * Pide al SW registrado que compruebe actualizaciones en el servidor.
 */
export async function checkForPwaUpdate(): Promise<boolean> {
  try {
    if (registration) {
      await registration.update();
      // Dar un instante a que se dispare onNeedRefresh si hay update
      await new Promise(r => setTimeout(r, 800));
      return needRefresh;
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        registration = reg;
        await reg.update();
        await new Promise(r => setTimeout(r, 800));
        return needRefresh;
      }
    }
  } catch (err) {
    console.warn('[pwa] checkForUpdate failed', err);
  }
  return needRefresh;
}

/**
 * Desregistra SW, borra caches de Workbox y recarga.
 * Útil cuando la app instalada se queda “pegada” a un build viejo.
 */
export async function hardResetPwaAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (err) {
    console.warn('[pwa] unregister failed', err);
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (err) {
    console.warn('[pwa] cache clear failed', err);
  }
  // Cache-buster por si el navegador reusa index.html
  const url = new URL(window.location.href);
  url.searchParams.set('_pwa_reset', String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Registrar SW una sola vez (llamar desde main en producción).
 */
export async function initPwaUpdates(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // En dev el plugin suele estar desactivado
  if (import.meta.env.DEV) return;

  try {
    const { registerSW } = await import('virtual:pwa-register');
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh = true;
        emit();
      },
      onOfflineReady() {
        offlineReady = true;
        emit();
      },
      onRegisteredSW(_swUrl, reg) {
        if (!reg) return;
        registration = reg;
        // Comprobar updates al volver a primer plano y cada 30 min
        const tick = () => {
          void reg.update().catch(() => undefined);
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') tick();
        });
        window.addEventListener('focus', tick);
        window.setInterval(tick, 30 * 60 * 1000);
        // Primera comprobación al arrancar
        tick();
      },
      onRegisterError(err) {
        console.warn('[pwa] register error', err);
      },
    });
  } catch (err) {
    // virtual:pwa-register no existe fuera del build con plugin
    console.warn('[pwa] init skipped', err);
  }
}
