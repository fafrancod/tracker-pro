import { useEffect } from 'react';
import { useStore } from '../store';
import { subscribeAnalytics } from '../services/analyticsService';

export function useAnalytics(weekId: string) {
  const uid = useStore(s => s.uid);
  const data = useStore(s => s.analyticsCache[weekId] ?? null);
  const { setAnalytics } = useStore();

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeAnalytics(uid, weekId, analytics => {
      if (analytics) setAnalytics(weekId, analytics);
    });
    return unsub;
  }, [uid, weekId, setAnalytics]);

  return { data };
}
