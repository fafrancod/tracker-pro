import type { Request, Response, NextFunction } from 'express';
import { isAdminUser } from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
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
 * Lee Authorization: Bearer <Supabase access token> y deja `req.user` armado.
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
    const { data, error } = await getSupabaseAdmin().auth.getUser(match[1]);
    if (error || !data.user) {
      throw error ?? new Error('invalid token');
    }
    const user = data.user;
    req.user = {
      uid: user.id,
      email: user.email ?? null,
      isAdmin: isAdminUser({
        email: user.email,
        appMetadata: user.app_metadata as { admin?: unknown } | null,
      }),
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