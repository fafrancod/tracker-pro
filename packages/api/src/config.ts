import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  channel: process.env.APP_CHANNEL ?? 'dev',
  version: readPackageVersion(),
  buildId: process.env.BUILD_ID ?? new Date().toISOString(),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3005,http://localhost:3002')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  enforceAppCheck:
    (process.env.ENFORCE_APP_CHECK ?? '').toLowerCase() === 'true',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  worker: {
    runEmbedded: (process.env.RUN_EMBEDDED_WORKER ?? 'true').toLowerCase() === 'true',
    maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS ?? 5),
    retryBaseDelayMs: Number(process.env.JOB_RETRY_BASE_DELAY_MS ?? 2000),
    retryMaxDelayMs: Number(process.env.JOB_RETRY_MAX_DELAY_MS ?? 120000),
    runningTimeoutMs: Number(process.env.JOB_RUNNING_TIMEOUT_MS ?? 300000),
    scanLimit: Number(process.env.JOB_SCAN_LIMIT ?? 20),
  },
} as const;

export type AppConfig = typeof config;
