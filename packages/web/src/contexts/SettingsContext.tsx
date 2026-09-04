import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '@core/store';
import { updateUserSettings } from '@core/services/userService';
import type { UserSettings } from '@core/types';
import { applySkin, DEFAULT_SKIN_ID } from '@/lib/skins';
import {
  leftoverImplicitEurReplacement,
  resolveDefaultCurrency,
} from '@core/lib/currencies';
import { useToast } from './ToastContext';

const LOCAL_KEY = 'daily-tracker:settings:v1';
/** One-time: leftover bootstrap EUR → currency implied by timezone. */
const CURRENCY_TZ_MIGRATION_KEY = 'daily-tracker:preferred-currency-tz-v1';

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  saving: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function detectBrowserLanguage(): UserSettings['language'] {
  if (typeof navigator === 'undefined') return 'es';
  const lang = (navigator.language || 'es').toLowerCase();
  return lang.startsWith('es') ? 'es' : 'en';
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const DEFAULTS: UserSettings = {
  autoRollIncomplete: false,
  defaultProjectId: null,
  weekStartsOnMonday: true,
  language: detectBrowserLanguage(),
  defaultBoardView: 'continuous',
  skinId: DEFAULT_SKIN_ID,
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
  timezone: detectTimezone(),
  birthDate: null,
  expectedLifespanYears: 80,
  lifeGoals: [],
  dailyJournal: [],
  preferredCurrency: resolveDefaultCurrency({
    timezone: detectTimezone(),
    locale: typeof navigator !== 'undefined' ? navigator.language : 'es',
  }),
  favoriteCurrencies: [],
  financeBanks: [],
  hideCompletedTasks: false,
  completedTaskStyle: 'strikethrough',
  boardFilters: {
    kinds: 'all',
    projectIds: 'all',
    urgency: 'all',
    importance: 'all',
  },
};

function loadLocal(): Partial<UserSettings> | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<UserSettings>;
  } catch {
    return null;
  }
}

function saveLocal(settings: UserSettings): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

function hasCurrencyTzMigration(): boolean {
  try {
    return localStorage.getItem(CURRENCY_TZ_MIGRATION_KEY) === '1';
  } catch {
    return true;
  }
}

function markCurrencyTzMigration(): void {
  try {
    localStorage.setItem(CURRENCY_TZ_MIGRATION_KEY, '1');
  } catch {
    // ignore quota errors
  }
}

function timezoneForCurrency(storedTz: string | undefined): string {
  if (storedTz && storedTz !== 'UTC' && storedTz !== 'Etc/UTC' && storedTz !== 'Etc/GMT') {
    return storedTz;
  }
  return detectTimezone();
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const profile = useStore(s => s.profile);
  const uid = useStore(s => s.uid);
  const { showToast } = useToast();

  const [localOverrides, setLocalOverrides] = useState<Partial<UserSettings>>(() => loadLocal() ?? {});
  const [saving, setSaving] = useState(false);

  const settings = useMemo<UserSettings>(() => {
    const merged: UserSettings = {
      ...DEFAULTS,
      ...(profile?.settings ?? {}),
      ...localOverrides,
    };
    if (!hasCurrencyTzMigration() && profile?.settings) {
      const leftover = leftoverImplicitEurReplacement(
        merged.preferredCurrency,
        timezoneForCurrency(merged.timezone)
      );
      if (leftover) merged.preferredCurrency = leftover;
    }
    return merged;
  }, [profile?.settings, localOverrides]);

  useEffect(() => {
    saveLocal(settings);
  }, [settings]);

  useEffect(() => {
    applySkin(settings.skinId ?? DEFAULT_SKIN_ID);
  }, [settings.skinId]);

  useEffect(() => {
    const style =
      settings.completedTaskStyle === 'check_only' ? 'check_only' : 'strikethrough';
    document.documentElement.dataset.completedStyle = style;
  }, [settings.completedTaskStyle]);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      setLocalOverrides(prev => ({ ...prev, ...patch }));
      if (!uid) return;
      try {
        setSaving(true);
        await updateUserSettings(uid, patch);
      } catch (err) {
        console.error('[settings] failed to persist', err);
        showToast('No pude guardar los cambios. Se mantienen localmente.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [uid, showToast]
  );

  useEffect(() => {
    if (!profile?.settings) return;
    if (hasCurrencyTzMigration()) return;
    const override = localOverrides.preferredCurrency;
    if (override && override !== 'EUR') {
      markCurrencyTzMigration();
      return;
    }
    const stored = profile.settings.preferredCurrency;
    const leftover = leftoverImplicitEurReplacement(
      stored,
      timezoneForCurrency(profile.settings.timezone ?? settings.timezone)
    );
    markCurrencyTzMigration();
    if (!leftover || leftover === stored) return;
    void updateSettings({ preferredCurrency: leftover });
  }, [
    profile,
    localOverrides.preferredCurrency,
    settings.timezone,
    updateSettings,
  ]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, saving }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
