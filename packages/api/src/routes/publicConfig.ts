import { Router } from 'express';
import { config } from '../config.js';

/**
 * Config pública para el frontend (sin secrets).
 * La anon key de Supabase es publicable; la service_role NUNCA va aquí.
 */
export const publicConfigRouter = Router();

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
  });
});
