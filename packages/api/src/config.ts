import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readPackageVersion(): string {
  // Prefer root monorepo version (Docker/runtime cwd = /app).
  // Fallback a packages/api cuando se arranca desde el workspace.
  const candidates = [
    resolve(process.cwd(), 'package.json'),
    resolve(process.cwd(), '../../package.json'),
    resolve(process.cwd(), 'packages/api/package.json'),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // try next
    }
  }
  return '0.0.0';
}

function parsePort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return 4000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 4000;
}

export const config = {
  port: parsePort(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  channel: process.env.APP_CHANNEL ?? 'dev',
  version: readPackageVersion(),
  buildId: process.env.BUILD_ID ?? new Date().toISOString(),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3005,http://localhost:3002')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Anon key: pública por diseño. Sirve al frontend vía /api/public-config
    // si el build de Vite no embebió VITE_* (caso habitual en Docker).
    anonKey:
      process.env.SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      undefined,
  },
  worker: {
    runEmbedded: (process.env.RUN_EMBEDDED_WORKER ?? 'true').toLowerCase() === 'true',
    maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS ?? 5),
    retryBaseDelayMs: Number(process.env.JOB_RETRY_BASE_DELAY_MS ?? 2000),
    retryMaxDelayMs: Number(process.env.JOB_RETRY_MAX_DELAY_MS ?? 120000),
    runningTimeoutMs: Number(process.env.JOB_RUNNING_TIMEOUT_MS ?? 300000),
    scanLimit: Number(process.env.JOB_SCAN_LIMIT ?? 20),
    /** Intervalo del worker de notificaciones email (ms). Default 60s. */
    notificationsIntervalMs: Number(process.env.NOTIFICATIONS_INTERVAL_MS ?? 60_000),
  },
  email: {
    /** Resend API key. Sin key → email deshabilitado (local/tests). */
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Meteora <onboarding@resend.dev>',
    appName: process.env.APP_NAME ?? 'Meteora',
    appUrl: process.env.APP_PUBLIC_URL ?? process.env.ALLOWED_ORIGINS?.split(',')[0] ?? '',
  },
  /** Header x-cron-secret o Authorization Bearer para POST /api/notifications/dispatch */
  cronSecret: process.env.CRON_SECRET ?? '',
} as const;

export type AppConfig = typeof config;