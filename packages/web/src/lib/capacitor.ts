/**
 * Native shell bootstrap (Capacitor). Safe no-ops in plain browser / PWA.
 */

export function isNativePlatform(): boolean {
  try {
    // Avoid hard import crash if Capacitor not injected
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export async function initNativeShell(): Promise<void> {
  if (typeof window === 'undefined') return;

  let Capacitor: typeof import('@capacitor/core').Capacitor;
  try {
    ({ Capacitor } = await import('@capacitor/core'));
  } catch {
    return;
  }

  if (!Capacitor.isNativePlatform()) return;

  // Native WebView is not same-origin with Railway — API base must be absolute.
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!apiBase) {
    console.warn(
      '[capacitor] VITE_API_BASE_URL vacío: en APK las llamadas API fallarán. ' +
        'Compila con VITE_API_BASE_URL=https://tu-host'
    );
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0d1117' });
  } catch {
    /* plugin missing / web */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }

  try {
    const { App } = await import('@capacitor/app');
    // Deep links / OAuth return → navigate in the SPA
    App.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        // Custom scheme: com.cerebrostudios.dailytracker://auth/callback?...
        // or https app links: https://tu-dominio/board
        const path = parsed.pathname || '/';
        const search = parsed.search || '';
        const hash = parsed.hash || '';
        const target = `${path}${search}${hash}` || '/board';
        if (window.location.pathname + window.location.search + window.location.hash !== target) {
          window.history.replaceState({}, '', target.startsWith('/') ? target : `/${target}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch {
        /* ignore bad url */
      }
    });
  } catch {
    /* ignore */
  }

  // Canal de notificaciones locales (Android 8+) — sin pedir permiso aquí
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: 'daily-tracker-reminders',
      name: 'Recordatorios',
      description: 'Tomas y tareas con horario',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* plugin missing / web / no permission yet */
  }

  // Reflect skin changes on the native status bar when possible
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const applyBar = () => {
      const bg =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-background')
          .trim() || '#0d1117';
      const mode = document.documentElement.dataset.theme;
      void StatusBar.setBackgroundColor({ color: bg });
      void StatusBar.setStyle({
        style: mode === 'light' ? Style.Light : Style.Dark,
      });
    };
    applyBar();
    const obs = new MutationObserver(applyBar);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    });
  } catch {
    /* ignore */
  }
}
