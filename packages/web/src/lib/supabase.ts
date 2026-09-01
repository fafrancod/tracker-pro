import { initSupabase, isSupabaseReady, type SupabaseConfig } from '@core/supabase';
import { configureApi } from '@core/lib/api';
import { setDemoMode } from '@core/lib/demoMode';
import { ingestPublicConfig, type PublicConfigPayload } from '@/lib/publicConfig';

const SUPABASE_LS_KEY = 'daily-tracker:supabase-config:v1';

export interface RuntimeSupabaseConfig extends SupabaseConfig {}

function loadRuntimeConfig(): RuntimeSupabaseConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SUPABASE_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSupabaseConfig>;
    if (!parsed.url || !parsed.anonKey) return null;
    return parsed as RuntimeSupabaseConfig;
  } catch {
    return null;
  }
}

export function saveRuntimeConfig(cfg: RuntimeSupabaseConfig): void {
  try {
    window.localStorage.setItem(SUPABASE_LS_KEY, JSON.stringify(cfg));
  } catch {
    // noop
  }
}

export function clearRuntimeConfig(): void {
  try {
    window.localStorage.removeItem(SUPABASE_LS_KEY);
  } catch {
    // noop
  }
}

export function hasRuntimeConfig(): boolean {
  return loadRuntimeConfig() !== null;
}

function readEnvConfig(): SupabaseConfig {
  const runtime = loadRuntimeConfig();
  if (runtime) return runtime;

  return {
    url: import.meta.env.VITE_SUPABASE_URL ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  };
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

/** Base URL de la API. En prod monorepo (mismo dominio) usa '' (same-origin). */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw !== undefined && raw !== '') {
    return raw.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) return 'http://localhost:4000';
  return '';
}

/** Carga config desde la API (runtime): supabase + brand/landing. */
async function fetchPublicConfig(): Promise<PublicConfigPayload | null> {
  try {
    const base = resolveApiBaseUrl();
    const res = await fetch(`${base}/api/public-config`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PublicConfigPayload;
    ingestPublicConfig(data);
    return data;
  } catch {
    // offline / API caida
  }
  return null;
}

/**
 * Inicializa Supabase + API client.
 * Orden: localStorage → VITE_* embebidas → GET /api/public-config (runtime).
 * Siempre pide public-config para landingEnabled/brand, aunque VITE_* exista.
 */
export async function bootstrapSupabase(): Promise<void> {
  if (isDemoActive()) {
    setDemoMode(true);
    configureApi({
      baseUrl: resolveApiBaseUrl() || 'http://localhost:4000',
    });
    return;
  }

  const fromApi = await fetchPublicConfig();
  let cfg = readEnvConfig();
  if (!cfg.url || !cfg.anonKey) {
    if (fromApi?.supabaseUrl && fromApi?.supabaseAnonKey) {
      cfg = { url: fromApi.supabaseUrl, anonKey: fromApi.supabaseAnonKey };
    }
  }

  if (cfg.url && cfg.anonKey) {
    initSupabase(cfg);
  }

  configureApi({
    baseUrl: resolveApiBaseUrl(),
  });
}

export { isSupabaseReady };
