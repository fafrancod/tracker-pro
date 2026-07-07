import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type { UserProfile, UserSettings } from '../types';

export type ProfileUnsubscribe = () => void;

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export function subscribeUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void
): ProfileUnsubscribe {
  if (isDemoMode()) return () => undefined;

  const supabase = getSupabase();
  void fetchUserProfile(uid).then(cb);

  const channel = supabase
    .channel(`profile:${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
      async () => {
        cb(await fetchUserProfile(uid));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

interface BootstrapResponse {
  uid: string;
  created: boolean;
  profile: UserProfile;
}

export async function bootstrapUserProfile(name?: string): Promise<UserProfile> {
  const res = await api.post<BootstrapResponse>('/api/auth/bootstrap', name ? { name } : {});
  return res.profile;
}

export async function updateUserSettings(
  uid: string,
  settings: Partial<UserSettings>
): Promise<void> {
  if (isDemoMode()) return;

  const current = await fetchUserProfile(uid);
  if (!current) throw new Error('Profile not found');

  const nextSettings = { ...current.settings, ...settings };
  const { error } = await getSupabase()
    .from('profiles')
    .update({ settings: nextSettings })
    .eq('id', uid);
  if (error) throw error;
}

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    name: row.name as string,
    email: row.email as string,
    plan: row.plan as UserProfile['plan'],
    createdAt: (row.created_at as string) ?? new Date(0).toISOString(),
    settings: row.settings as UserSettings,
  };
}