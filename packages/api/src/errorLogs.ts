import { db, FieldValue } from './firebaseAdmin.js';
import { config } from './config.js';
import { logger } from './logger.js';
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

/**
 * Escribe a errorLogs/{logId} para que el panel Admin pueda triagear fallos.
 * No tira si falla: el logging propio nunca debe romper la response.
 */
export async function logError(payload: ErrorLogPayload): Promise<void> {
  try {
    await db.collection('errorLogs').add({
      ...payload,
      version: config.version,
      channel: config.channel,
      buildId: config.buildId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn({ err }, 'failed to write errorLogs');
  }
}
