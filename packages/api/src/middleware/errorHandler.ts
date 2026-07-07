import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors.js';
import { logError } from '../errorLogs.js';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = async (err, req, res, _next) => {
  let apiErr: ApiError;

  if (err instanceof ApiError) {
    apiErr = err;
  } else if (err instanceof ZodError) {
    apiErr = ApiError.badRequest('Invalid payload', err.flatten());
  } else {
    apiErr = ApiError.internal(
      err instanceof Error ? err.message : 'Unexpected error'
    );
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
