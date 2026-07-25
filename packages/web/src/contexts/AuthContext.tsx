import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseReady } from '@core/supabase';
import { bootstrapUserProfile, subscribeUserProfile } from '@core/services/userService';
import { useStore } from '@core/store';
import { isDemoMode } from '@core/lib/demoMode';
import { getDemoSeed } from '@/lib/demoSeed';
import { disableDemo } from '@/lib/supabase';
import { loadDemoState, saveDemoState, clearDemoState } from '@/lib/demoPersistence';
import type { UserProfile } from '@core/types';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
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
    if (isDemoMode()) {
      const fakeUser = {
        id: 'demo-user',
        email: 'demo@local',
        user_metadata: { name: 'Demo' },
      } as unknown as User;
      setUser(fakeUser);
      setUid('demo-user');

      const persisted = loadDemoState();
      const seed = persisted ?? getDemoSeed();
      const defaultProfile: UserProfile = {
        name: 'Demo',
        email: 'demo@local',
        plan: 'pro',
        createdAt: new Date().toISOString(),
        settings: {
          autoRollIncomplete: false,
          defaultProjectId: null,
          weekStartsOnMonday: true,
          language:
            typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')
              ? 'es'
              : 'en',
          defaultBoardView: 'continuous',
          skinId: 'dark-github',
          dayStartHour: 7,
          dayEndHour: 22,
          defaultScheduleLayout: 'list',
          notifyLocal: true,
          notifyEmail: false,
          notifyBeforeEnabled: true,
          notifyMinutesBefore: 10,
          notifyDayBefore: true,
          notifyDayBeforeTime: '20:00',
          notifyPastIncomplete: true,
          notifyPastAfterMinutes: 30,
          notifyTasks: true,
          notifyRx: true,
          timezone:
            typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
              : 'UTC',
          birthDate: null,
          expectedLifespanYears: 80,
          lifeGoals: [],
          dailyJournal: [],
        },
      };
      const initialProfile: UserProfile = persisted?.profile ?? defaultProfile;

      setProfile(initialProfile);
      setProjects(seed.projects);
      setCurrentWeek(seed.currentWeekId);
      // Cargar todas las semanas del seed (series recurrentes multi-mes).
      for (const [weekId, days] of Object.entries(seed.tasksByDay)) {
        for (const [dayId, tasks] of Object.entries(days)) {
          setDayTasks(weekId, dayId, tasks);
        }
      }

      setLoading(false);
      setAuthLoading(false);

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

    if (!isSupabaseReady()) {
      setLoading(false);
      setAuthLoading(false);
      return;
    }

    const supabase = getSupabase();
    let profileUnsub: (() => void) | null = null;

    const handleSession = async (sessionUser: User | null) => {
      setUser(sessionUser);
      setUid(sessionUser?.id ?? null);
      setProfileError(false);

      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (sessionUser) {
        try {
          const profile = await bootstrapUserProfile(
            (sessionUser.user_metadata?.name as string | undefined) ??
              sessionUser.user_metadata?.full_name ??
              undefined
          );
          setProfile(profile);
          profileUnsub = subscribeUserProfile(sessionUser.id, p => {
            if (p) setProfile(p);
          });
        } catch (err) {
          console.error('[auth] failed to bootstrap profile', err);
          setProfile(null);
          setProfileError(true);
          showToast(
            'No pudimos cargar tu perfil. Prueba a recargar; si persiste, escríbenos.',
            'error'
          );
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
      setAuthLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void handleSession(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, [setUid, setProfile, setAuthLoading, setProjects, setDayTasks, setCurrentWeek, showToast]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = window.location.origin;
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { name: displayName } },
      });
      if (error) throw error;
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
    try {
      const { clearAccessTokenCache } = await import('@core/lib/api');
      clearAccessTokenCache();
    } catch {
      /* ignore */
    }
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
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