import { getSupabase } from '../supabase';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import type { AnalyticsData } from '../types';

export type AnalyticsUnsubscribe = () => void;

export async function fetchAnalytics(uid: string, weekId: string): Promise<AnalyticsData | null> {
  const { data, error } = await getSupabase()
    .from('analytics')
    .select('*')
    .eq('user_id', uid)
    .eq('week_id', weekId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAnalytics(weekId, data) : null;
}

export function subscribeAnalytics(
  uid: string,
  weekId: string,
  cb: (data: AnalyticsData | null) => void
): AnalyticsUnsubscribe {
  if (isDemoMode()) return () => undefined;

  void fetchAnalytics(uid, weekId).then(cb);

  return subscribeTable({
    topic: `analytics:${uid}:${weekId}`,
    table: 'analytics',
    filter: `user_id=eq.${uid}`,
    onChange: () => {
      void fetchAnalytics(uid, weekId).then(cb);
    },
  });
}

function mapAnalytics(weekId: string, row: Record<string, unknown>): AnalyticsData {
  return {
    weekId,
    completionsByDay: (row.completions_by_day as Record<string, number>) ?? {},
    completionsByProject: (row.completions_by_project as Record<string, number>) ?? {},
    streakCount: (row.streak_count as number) ?? 0,
  };
}