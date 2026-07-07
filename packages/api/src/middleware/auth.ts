import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin.js';
import { ApiError } from '../errors.js';

export interface AuthUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Lee el Authorization: Bearer <Firebase ID token> y deja `req.user` armado.
 * Tira 401 si falta o es invalido.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.header('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    next(ApiError.unauthorized('Missing bearer token'));
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      // El claim custom `admin: true` se setea desde un script offline.
      isAdmin: decoded.admin === true,
    };
    next();
  } catch (err) {
    next(
      new ApiError(401, 'Invalid auth token', 'invalid_token', 'low', {
        cause: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(ApiError.unauthorized());
    return;
  }
  if (!req.user.isAdmin) {
    next(ApiError.forbidden('Admin only'));
    return;
  }
  next();
}
