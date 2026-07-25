import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors.js';
import { logError } from '../errorLogs.js';
import { logger } from '../logger.js';

function extractUnknownError(err: unknown): { message: string; details?: unknown } {
  if (err instanceof Error) {
    return { message: err.message || 'Unexpected error' };
  }
  // PostgrestError / objetos de Supabase a veces no son instanceof Error
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const message =
      typeof e.message === 'string' && e.message.trim()
        ? e.message
        : 'Unexpected error';
    return {
      message,
      details: {
        code: e.code,
        details: e.details,
        hint: e.hint,
      },
    };
  }
  return { message: 'Unexpected error' };
}

export const errorHandler: ErrorRequestHandler = async (err, req, res, _next) => {
  let apiErr: ApiError;

  if (err instanceof ApiError) {
    apiErr = err;
  } else if (err instanceof ZodError) {
    apiErr = ApiError.badRequest('Invalid payload', err.flatten());
  } else {
    const extracted = extractUnknownError(err);
    apiErr = ApiError.internal(extracted.message, extracted.details);
  }

  if (apiErr.status >= 500) {
    logger.error({ err, path: req.path }, 'unhandled api error');
  } else {
    logger.warn({ status: apiErr.status, code: apiErr.code, path: req.path }, 'api error');
  }

  // No bloquear la response esperando al log.
  void logError({
    uid: req.user?.uid ?? null,
    severity: apiErr.severity,
    operation: `${req.method} ${req.route?.path ?? req.path}`,
    message: apiErr.message,
    stack: err instanceof Error ? err.stack : undefined,
    meta: { code: apiErr.code, details: apiErr.details },
    userAgent: req.header('User-Agent') ?? null,
    ip: req.ip ?? null,
  });

  res.status(apiErr.status).json({
    error: {
      code: apiErr.code,
      message: apiErr.message,
      details: apiErr.details,
    },
  });
};
