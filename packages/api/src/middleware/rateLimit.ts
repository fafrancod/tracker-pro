import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors.js';

/**
 * Rate limit in-memory por (uid o ip) + bucket de ventana fija.
 *
 * Limitacion conocida: en horizontal cada proceso tiene su contador. Antes de
 * abrir trafico real, mover a Redis o Firestore counters (ver SCALABILITY_OPERATIONS).
 */
export function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function rateLimitMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    const key = req.user?.uid ?? req.ip ?? 'anon';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (entry.count >= opts.max) {
      next(ApiError.tooManyRequests());
      return;
    }

    entry.count += 1;
    next();
  };
}
