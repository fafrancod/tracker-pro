import { getSupabaseAdmin } from './supabaseAdmin.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { redactPii } from './lib/redactPii.js';
import type { ErrorSeverity } from './errors.js';

export interface ErrorLogPayload {
  uid?: string | null;
  severity: ErrorSeverity;
  operation: string;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
  userAgent?: string | null;
  ip?: string | null;
}

export async function logError(payload: ErrorLogPayload): Promise<void> {
  try {
    await getSupabaseAdmin().from('error_logs').insert({
      uid: payload.uid ?? null,
      severity: payload.severity,
      operation: payload.operation,
      message: payload.message,
      stack: payload.stack ?? null,
      meta: payload.meta ? redactPii(payload.meta) : null,
      user_agent: payload.userAgent ?? null,
      ip: payload.ip ?? null,
      version: config.version,
      channel: config.channel,
      build_id: config.buildId,
    });
  } catch (err) {
    logger.warn({ err }, 'failed to write error_logs');
  }
}