import { doc, getDoc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { getDb } from '../firebase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type { UserProfile, UserSettings } from '../types';

function profileDoc(uid: string) {
  return doc(getDb(), 'users', uid, 'profile', 'data');
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * Listener realtime sobre `users/{uid}/profile/data`. Util para que la UI
 * refleje cambios de plan o settings instantaneamente.
 */
export function subscribeUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void
): Unsubscribe {
  if (isDemoMode()) return () => undefined;
  return onSnapshot(profileDoc(uid), snap => {
    cb(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

interface BootstrapResponse {
  uid: string;
  created: boolean;
  profile: UserProfile;
}

/**
 * Llama a `POST /api/auth/bootstrap`. Idempotente: si el perfil ya existe lo
 * devuelve, si no, lo crea + inicializa `users/{uid}/usage/{period}` con counters
 * en cero. Usar despues de `onAuthStateChanged` con user != null.
 */
export async function bootstrapUserProfile(name?: string): Promise<UserProfile> {
  const res = await api.post<BootstrapResponse>('/api/auth/bootstrap', name ? { name } : {});
  return res.profile;
}

/**
 * Actualiza settings del usuario. Las rules permiten que el cliente edite
 * `settings` y `name`, pero no `plan` ni `createdAt`.
 */
export async function updateUserSettings(
  uid: string,
  settings: Partial<UserSettings>
): Promise<void> {
  if (isDemoMode()) {
    // En demo las settings persisten via localStorage en SettingsContext.
    return;
  }
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    updates[`settings.${k}`] = v;
  }
  await updateDoc(profileDoc(uid), updates);
}
