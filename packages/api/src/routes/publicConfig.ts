import { Router } from 'express';
import { config } from '../config.js';

/**
 * Config pública para el frontend (sin secrets).
 * La anon key de Supabase es publicable; la service_role NUNCA va aquí.
 *
 * brand / publicAppUrl / landingEnabled / playStoreUrl son aditivos: clientes
 * viejos los ignoran. LANDING_ENABLED y PLAY_STORE_URL se leen en el request
 * para poder encender la landing sin rebuild del APK.
 */
export const publicConfigRouter = Router();

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw.toLowerCase() === 'true';
}

function resolvePublicAppUrl(): string {
  const fromEnv = config.email.appUrl.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const httpsOrigin = config.allowedOrigins.find((origin) => origin.startsWith('https://'));
  return (httpsOrigin ?? config.allowedOrigins[0] ?? '').replace(/\/$/, '');
}

function resolvePlayStoreUrl(): string | null {
  const raw = process.env.PLAY_STORE_URL?.trim();
  return raw ? raw : null;
}

publicConfigRouter.get('/', (_req, res) => {
  const supabaseUrl = config.supabase.url ?? null;
  const supabaseAnonKey = config.supabase.anonKey ?? null;
  res.json({
    supabaseUrl,
    supabaseAnonKey,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    api: 'daily-tracker-api',
    spaHint: 'same-origin',
    /** Sin secretos: solo si la API puede enviar mail (Resend key presente). */
    emailConfigured: Boolean(config.email.resendApiKey?.trim()),
    /**
     * Google OAuth se configura en Supabase/Google Cloud (no en la API).
     * El cliente solo muestra docs; no se puede saber el estado del provider sin service role.
     */
    googleAuth: 'supabase-provider',
    docsAuthEmail: '/docs/AUTH_AND_EMAIL.md',
    brand: config.email.appName,
    publicAppUrl: resolvePublicAppUrl(),
    landingEnabled: envFlag('LANDING_ENABLED', false),
    playStoreUrl: resolvePlayStoreUrl(),
  });
});
