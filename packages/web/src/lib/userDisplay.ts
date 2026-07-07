import type { User } from '@supabase/supabase-js';

export function userDisplayName(user: User | null | undefined): string {
  if (!user) return 'Invitado';
  const meta = user.user_metadata ?? {};
  return (
    (meta.name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    user.email ??
    'Invitado'
  );
}

export function userAvatarUrl(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null;
}