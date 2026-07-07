import { db, FieldValue } from '../firebaseAdmin.js';
import { currentPeriod } from './period.js';
import type { Plan } from './planLimits.js';

interface UsageDoc {
  tasksCreated?: number;
  projectsCreated?: number;
  updatedAt?: FirebaseFirestore.Timestamp;
}

export async function readUsage(uid: string, period = currentPeriod()): Promise<UsageDoc> {
  const snap = await db.doc(`users/${uid}/usage/${period}`).get();
  return (snap.data() as UsageDoc) ?? {};
}

export async function readProfilePlan(uid: string): Promise<Plan> {
  const snap = await db.doc(`users/${uid}/profile/data`).get();
  const plan = (snap.get('plan') as Plan | undefined) ?? 'free';
  return plan === 'pro' ? 'pro' : 'free';
}

export async function countProjects(uid: string): Promise<number> {
  const snap = await db.collection(`users/${uid}/projects`).count().get();
  return snap.data().count;
}

interface BumpCounters {
  tasksCreated?: number;
  projectsCreated?: number;
}

/**
 * Actualiza el contador de uso del mes. Idempotente cuando se pasa `eventId`
 * (usado para no doble-contar reintentos del cliente).
 */
export async function bumpUsage(
  uid: string,
  counters: BumpCounters,
  eventId?: string
): Promise<void> {
  const period = currentPeriod();
  const usageRef = db.doc(`users/${uid}/usage/${period}`);

  if (eventId) {
    const eventRef = db.doc(`users/${uid}/usageEvents/${eventId}`);
    await db.runTransaction(async tx => {
      const existing = await tx.get(eventRef);
      if (existing.exists) return; // ya procesado
      tx.set(eventRef, {
        period,
        counters,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        usageRef,
        {
          ...Object.fromEntries(
            Object.entries(counters).map(([k, v]) => [k, FieldValue.increment(v ?? 0)])
          ),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    return;
  }

  await usageRef.set(
    {
      ...Object.fromEntries(
        Object.entries(counters).map(([k, v]) => [k, FieldValue.increment(v ?? 0)])
      ),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
