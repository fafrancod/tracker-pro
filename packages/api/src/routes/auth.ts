import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { currentPeriod } from '../lib/period.js';
import { ApiError } from '../errors.js';

export const authRouter = Router();

authRouter.use(requireAuth);
// Bootstrap se llama una vez por sesion, pero un cliente con bug podria
// llamarlo muchas veces. Rate limit suave por usuario:
authRouter.use(rateLimit({ windowMs: 60_000, max: 20 }));

const bootstrapSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

const DEFAULT_SETTINGS = {
  autoRollIncomplete: false,
  defaultProjectId: null,
  weekStartsOnMonday: true,
  language: 'es' as const,
};

/**
 * Idempotente: si el perfil existe lo devuelve sin tocarlo. Si no existe lo
 * crea con plan=free, settings default, y crea tambien el doc de usage del
 * mes para que los counters arranquen visibles desde el frontend.
 *
 * Es la unica forma "oficial" de crear el doc users/{uid}/profile/data — las
 * rules siguen permitiendo create client-side como fallback, pero esto centraliza
 * la inicializacion (defaults, usage, fecha createdAt confiable).
 */
authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const { uid, email } = req.user!;
    if (!email) {
      throw ApiError.badRequest('El token no tiene email asociado.');
    }
    const { name } = bootstrapSchema.parse(req.body ?? {});

    const profileRef = db.doc(`users/${uid}/profile/data`);
    const usageRef = db.doc(`users/${uid}/usage/${currentPeriod()}`);

    const result = await db.runTransaction(async tx => {
      const profileSnap = await tx.get(profileRef);
      if (profileSnap.exists) {
        return { profile: profileSnap.data(), created: false };
      }

      const newProfile = {
        name: name ?? email.split('@')[0],
        email,
        plan: 'free' as const,
        createdAt: FieldValue.serverTimestamp(),
        settings: DEFAULT_SETTINGS,
      };
      tx.set(profileRef, newProfile);
      tx.set(
        usageRef,
        {
          tasksCreated: 0,
          projectsCreated: 0,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      // El timestamp del server no es legible inline; devolvemos un placeholder
      // que el cliente reemplaza cuando lee el doc real.
      return {
        profile: { ...newProfile, createdAt: new Date().toISOString() },
        created: true,
      };
    });

    res.status(result.created ? 201 : 200).json({
      uid,
      created: result.created,
      profile: result.profile,
    });
  } catch (err) {
    next(err);
  }
});
