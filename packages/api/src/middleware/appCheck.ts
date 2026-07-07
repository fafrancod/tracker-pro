import type { Request, Response, NextFunction } from 'express';
import { adminAppCheck } from '../firebaseAdmin.js';
import { config } from '../config.js';
import { ApiError } from '../errors.js';

/**
 * Verifica X-Firebase-AppCheck si ENFORCE_APP_CHECK=true.
 * En dev queda como no-op para no exigir setup completo de App Check.
 */
export async function appCheckMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!config.enforceAppCheck) {
    next();
    return;
  }

  const token = req.header('X-Firebase-AppCheck');
  if (!token) {
    next(ApiError.unauthorized('Missing App Check token'));
    return;
  }

  try {
    await adminAppCheck.verifyToken(token);
    next();
  } catch (err) {
    next(
      new ApiError(401, 'Invalid App Check token', 'app_check_failed', 'medium', {
        cause: err instanceof Error ? err.message : String(err),
      })
    );
  }
}
