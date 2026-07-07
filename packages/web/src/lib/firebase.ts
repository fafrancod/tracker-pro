import {
  initFirebase,
  isFirebaseReady,
  getFirebaseApp,
  type FirebaseConfig,
} from '@core/firebase';
import { configureApi } from '@core/lib/api';
import { setDemoMode } from '@core/lib/demoMode';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from 'firebase/app-check';

let appCheck: AppCheck | null = null;

const FIREBASE_LS_KEY = 'daily-tracker:firebase-config:v1';

export interface RuntimeFirebaseConfig extends FirebaseConfig {
  appCheckSiteKey?: string;
}

/** Lee config del runtime (localStorage) si existe; usado como override de las env vars de Vite. */
function loadRuntimeConfig(): RuntimeFirebaseConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FIREBASE_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeFirebaseConfig>;
    if (!parsed.apiKey || !parsed.projectId || !parsed.authDomain || !parsed.appId) return null;
    return parsed as RuntimeFirebaseConfig;
  } catch {
    return null;
  }
}

export function saveRuntimeConfig(cfg: RuntimeFirebaseConfig): void {
  try {
    window.localStorage.setItem(FIREBASE_LS_KEY, JSON.stringify(cfg));
  } catch {
    // noop
  }
}

export function clearRuntimeConfig(): void {
  try {
    window.localStorage.removeItem(FIREBASE_LS_KEY);
  } catch {
    // noop
  }
}

export function hasRuntimeConfig(): boolean {
  return loadRuntimeConfig() !== null;
}

function readConfig(): FirebaseConfig {
  // 1) Runtime override (formulario en pantalla)
  const runtime = loadRuntimeConfig();
  if (runtime) {
    return {
      apiKey: runtime.apiKey,
      authDomain: runtime.authDomain,
      projectId: runtime.projectId,
      storageBucket: runtime.storageBucket ?? '',
      messagingSenderId: runtime.messagingSenderId ?? '',
      appId: runtime.appId,
    };
  }

  // 2) Env vars de Vite (.env.local)
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.warn(
      `[firebase] missing env vars: ${missing.join(', ')}. ` +
        'Use el formulario en pantalla, o copiá packages/web/.env.example a .env.local.'
    );
  }
  return cfg as FirebaseConfig;
}

function setupAppCheck(): void {
  const runtime = loadRuntimeConfig();
  const siteKey = runtime?.appCheckSiteKey || import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return;
  try {
    appCheck = initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // initializeAppCheck tira si se llama dos veces o si reCAPTCHA no carga.
    // En dev no es crítico: el backend respeta ENFORCE_APP_CHECK=false.
    console.warn('[appCheck] init failed', err);
  }
}

async function appCheckTokenGetter(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const result = await getToken(appCheck, /* forceRefresh */ false);
    return result.token;
  } catch (err) {
    console.warn('[appCheck] getToken failed', err);
    return null;
  }
}

export type AppCheckState = 'no-key' | 'initialized' | 'token-ok' | 'token-error';

/**
 * Estado reactivo de App Check para mostrar en Settings/Admin. No mantiene
 * cache: lee el estado actual cada vez para reflejar `getToken()` reciente.
 */
export async function getAppCheckStatus(): Promise<AppCheckState> {
  if (!import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) return 'no-key';
  if (!appCheck) return 'no-key';
  try {
    const result = await getToken(appCheck, false);
    return result.token ? 'token-ok' : 'initialized';
  } catch {
    return 'token-error';
  }
}

const DEMO_LS_KEY = 'daily-tracker:demo-mode';

export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get('demo') === '1') return true;
  try {
    return window.localStorage.getItem(DEMO_LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableDemo(): void {
  try {
    window.localStorage.setItem(DEMO_LS_KEY, '1');
  } catch {
    // sin localStorage no podemos persistir; el query param sigue funcionando.
  }
}

export function disableDemo(): void {
  try {
    window.localStorage.removeItem(DEMO_LS_KEY);
  } catch {
    /* noop */
  }
}

export function bootstrapFirebase(): void {
  if (isDemoActive()) {
    setDemoMode(true);
    configureApi({
      baseUrl: 'http://localhost:4000', // ignorado en demo
      appCheckTokenGetter: async () => null,
    });
    return;
  }

  initFirebase(readConfig());

  if (isFirebaseReady()) {
    setupAppCheck();
  }

  configureApi({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
    appCheckTokenGetter,
  });
}
