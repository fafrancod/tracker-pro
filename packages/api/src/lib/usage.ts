import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { currentPeriod } from './period.js';
import type { Plan } from './planLimits.js';

interface UsageRow {
  tasks_created?: number;
  projects_created?: number;
  updated_at?: string;
}

export async function readUsage(uid: string, period = currentPeriod()): Promise<UsageRow> {
  const { data } = await getSupabaseAdmin()
    .from('usage_counters')
    .select('tasks_created, projects_created, updated_at')
    .eq('user_id', uid)
    .eq('period', period)
    .maybeSingle();
  return data ?? {};
}

export async function readProfilePlan(uid: string): Promise<Plan> {
  const { data } = await getSupabaseAdmin()
    .from('profiles')
    .select('plan')
    .eq('id', uid)
    .maybeSingle();
  const plan = data?.plan as Plan | undefined;
  return plan === 'pro' ? 'pro' : 'free';
}

export async function countProjects(uid: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid);
  if (error) throw error;
  return count ?? 0;
}

interface BumpCounters {
  tasksCreated?: number;
  projectsCreated?: number;
}

export async function bumpUsage(
  uid: string,
  counters: BumpCounters,
  eventId?: string
): Promise<void> {
  const period = currentPeriod();
  const now = new Date().toISOString();

  if (eventId) {
    const { data: existing } = await getSupabaseAdmin()
      .from('usage_events')
      .select('event_id')
      .eq('user_id', uid)
      .eq('event_id', eventId)
      .maybeSingle();
    if (existing) return;

    const { error: eventError } = await getSupabaseAdmin().from('usage_events').insert({
      user_id: uid,
      event_id: eventId,
      period,
      counters,
    });
    if (eventError) throw eventError;
  }

  const { data: usage } = await getSupabaseAdmin()
    .from('usage_counters')
    .select('tasks_created, projects_created')
    .eq('user_id', uid)
    .eq('period', period)
    .maybeSingle();

  const nextTasks = (usage?.tasks_created ?? 0) + (counters.tasksCreated ?? 0);
  const nextProjects = (usage?.projects_created ?? 0) + (counters.projectsCreated ?? 0);

  const { error } = await getSupabaseAdmin().from('usage_counters').upsert(
    {
      user_id: uid,
      period,
      tasks_created: nextTasks,
      projects_created: nextProjects,
      updated_at: now,
    },
    { onConflict: 'user_id,period' }
  );
  if (error) throw error;
}