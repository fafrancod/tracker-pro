import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getDb } from '../firebase';
import { isDemoMode } from '../lib/demoMode';
import type { AnalyticsData } from '../types';

function analyticsDoc(uid: string, weekId: string) {
  return doc(getDb(), 'users', uid, 'analytics', weekId);
}

export async function fetchAnalytics(uid: string, weekId: string): Promise<AnalyticsData | null> {
  const snap = await getDoc(analyticsDoc(uid, weekId));
  if (!snap.exists()) return null;
  return { weekId, ...snap.data() } as AnalyticsData;
}

export function subscribeAnalytics(
  uid: string,
  weekId: string,
  cb: (data: AnalyticsData | null) => void
): Unsubscribe {
  if (isDemoMode()) return () => undefined;
  return onSnapshot(analyticsDoc(uid, weekId), snap => {
    if (!snap.exists()) {
      cb(null);
    } else {
      cb({ weekId, ...snap.data() } as AnalyticsData);
    }
  });
}
