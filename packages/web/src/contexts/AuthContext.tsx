import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseReady } from '@core/firebase';
import { bootstrapUserProfile, subscribeUserProfile } from '@core/services/userService';
import { useStore } from '@core/store';
import { isDemoMode } from '@core/lib/demoMode';
import { getDemoSeed } from '@/lib/demoSeed';
import { disableDemo } from '@/lib/firebase';
import { loadDemoState, saveDemoState, clearDemoState } from '@/lib/demoPersistence';
import type { UserProfile } from '@core/types';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True si la sesion existe pero el perfil no se pudo cargar/crear. */
  profileError: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const { showToast } = useToast();

  const setUid = useStore(s => s.setUid);
  const setProfile = useStore(s => s.setProfile);
  const setAuthLoading = useStore(s => s.setAuthLoading);
  const setProjects = useStore(s => s.setProjects);
  const setDayTasks = useStore(s => s.setDayTasks);
  const setCurrentWeek = useStore(s => s.setCurrentWeek);

  useEffect(() => {
    // --- Demo mode: usuario fake + datos sembrados o hidratados de localStorage.
    if (isDemoMode()) {
      const fakeUser = {
        uid: 'demo-user',
        email: 'demo@local',
        displayName: 'Demo',
        photoURL: null,
        getIdToken: async () => 'demo-token',
      } as unknown as User;
      setUser(fakeUser);
      setUid('demo-user');

      const persisted = loadDemoState();
      const seed = persisted ?? getDemoSeed();
      const defaultProfile: UserProfile = {
        name: 'Demo',
        email: 'demo@local',
        plan: 'pro', // Demo desbloquea Pro para mostrar todas las features.
        createdAt: new Date().toISOString(),
        settings: {
          autoRollIncomplete: false,
          defaultProjectId: null,
          weekStartsOnMonday: true,
          language:
            typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')
              ? 'es'
              : 'en',
        },
      };
      const initialProfile: UserProfile = persisted?.profile ?? defaultProfile;

      setProfile(initialProfile);
      setProjects(seed.projects);
      setCurrentWeek(seed.currentWeekId);
      for (const [dayId, tasks] of Object.entries(seed.tasksByDay[seed.currentWeekId] ?? {})) {
        setDayTasks(seed.currentWeekId, dayId, tasks);
      }

      setLoading(false);
      setAuthLoading(false);

      // Subscribe a cambios del store para persistir en localStorage.
      // Lo hago con un timeout debounce de 300ms para no escribir en cada keystroke.
      let pending: ReturnType<typeof setTimeout> | null = null;
      const unsubStore = useStore.subscribe(state => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          saveDemoState({
            profile: state.profile ?? initialProfile,
            projects: state.projects,
            tasksByDay: state.tasksByDay,
            currentWeekId: state.currentWeekId,
          });
        }, 300);
      });

      return () => {
        if (pending) clearTimeout(pending);
        unsubStore();
      };
    }

    if (!isFirebaseReady()) {
      setLoading(false);
      setAuthLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    let profileUnsub: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async fbUser => {
      setUser(fbUser);
      setUid(fbUser?.uid ?? null);
      setProfileError(false);

      // Limpiar el listener anterior antes de cualquier cambio de usuario.
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (fbUser) {
        try {
          // 1. Bootstrap via backend: crea perfil + usage si no existen,
          //    es idempotente, y devuelve el perfil para el primer render.
          const profile = await bootstrapUserProfile(fbUser.displayName ?? undefined);
          setProfile(profile);

          // 2. Listener realtime para que cambios de plan/settings (incluso
          //    desde otra pestaña) refresquen la UI sin recargar.
          profileUnsub = subscribeUserProfile(fbUser.uid, p => {
            if (p) setProfile(p);
          });
        } catch (err) {
          console.error('[auth] failed to bootstrap profile', err);
          setProfile(null);
          setProfileError(true);
          showToast(
            'No pudimos cargar tu perfil. Probá recargar; si persiste, escribinos.',
            'error'
          );
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
      setAuthLoading(false);
    });

    return () => {
      unsub();
      if (profileUnsub) profileUnsub();
    };
  }, [setUid, setProfile, setAuthLoading, setProjects, setDayTasks, setCurrentWeek, showToast]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
    },
    []
  );

  const signOut = useCallback(async () => {
    if (isDemoMode()) {
      clearDemoState();
      disableDemo();
      window.location.reload();
      return;
    }
    await fbSignOut(getFirebaseAuth());
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
