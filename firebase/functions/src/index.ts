import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();
const db = admin.firestore();

// Update analytics aggregates whenever a task changes
export const onTaskWrite = onDocumentWritten(
  'users/{uid}/weeks/{weekId}/days/{dayId}/tasks/{taskId}',
  async (event) => {
    const { uid, weekId, dayId } = event.params;

    const tasksSnap = await db
      .collection(`users/${uid}/weeks/${weekId}/days/${dayId}/tasks`)
      .get();

    const tasks = tasksSnap.docs.map(d => d.data());
    const completed = tasks.filter(t => t.completed).length;

    const analyticsRef = db.doc(`users/${uid}/analytics/${weekId}`);
    await analyticsRef.set(
      { [`completionsByDay.${dayId}`]: completed },
      { merge: true }
    );
  }
);

// Auto-roll incomplete tasks to next week on Sunday at 23:59
export const onWeekEnd = onSchedule('59 23 * * 0', async () => {
  const usersSnap = await db.collectionGroup('profile').get();

  for (const profileDoc of usersSnap.docs) {
    const uid = profileDoc.ref.parent.parent?.id;
    if (!uid) continue;

    const profile = profileDoc.data();
    if (!profile.settings?.autoRollIncomplete) continue;

    // Logic to move incomplete tasks to next week would go here
    // Omitted for brevity — implement based on business rules
  }
});

// Stripe checkout session (stub)
export const createCheckoutSession = onCall(async (request) => {
  const { uid } = request.auth ?? {};
  if (!uid) throw new Error('Unauthenticated');

  // TODO: integrate Stripe SDK
  return { url: null, error: 'Stripe not configured yet' };
});

// Stripe webhook (stub)
export const stripeWebhook = onRequest(async (req, res) => {
  // TODO: verify Stripe signature and update plan field
  res.status(200).send('ok');
});
