import { useEffect, useState } from 'react';
import {
  Bell,
  Download,
  Mail,
  RefreshCw,
  Sparkles,
  User,
  SlidersHorizontal,
  Palette,
  Wallet,
  Monitor,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { useOnboardingTour } from '@/contexts/OnboardingTourContext';
import { markOnboardingPending } from '@/lib/onboardingTour';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@core/hooks/useProjects';
import { usePlan } from '@core/hooks/usePlan';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@core/lib/api';
import { isDemoMode } from '@core/lib/demoMode';
import { appVersion } from '@/lib/appVersion';
import {
  NOTIFY_MINUTES_OPTIONS,
  NOTIFY_PAST_AFTER_OPTIONS,
} from '@core/lib/notifications';
import { useStore } from '@core/store';
import {
  SUPPORTED_CURRENCIES,
  resolveDefaultCurrency,
} from '@core/lib/currencies';

import { clearDemoState } from '@/lib/demoPersistence';
import { useT } from '@/hooks/useT';
import type {
  BoardViewMode,
  CompletedTaskStyle,
  Language,
  ScheduleLayout,
} from '@core/types';
import { cn } from '@/lib/utils';
import { userAvatarUrl, userDisplayName } from '@/lib/userDisplay';
import {
  isGlassSkin,
  skinsByMode,
  type SkinDefinition,
} from '@/lib/skins';
import { SimpleSelect } from '@/components/ui/select';
import {
  DEFAULT_LIFESPAN_YEARS,
  MAX_LIFESPAN_YEARS,
  MIN_LIFESPAN_YEARS,
  clampLifespanYears,
} from '@/lib/mementoMori';
import {
  getLocalPermissionState,
  requestLocalPermission,
  rescheduleLocalNotifications,
  type LocalPermissionState,
} from '@/lib/localNotifications';
import { getDeviceTimezone } from '@/lib/timezones';
import { TimeInput } from '@/components/ui/time-input';
import { TimezoneField } from '@/components/Settings/TimezoneField';
import {
  checkForPwaUpdate,
  hardResetPwaAndReload,
  isStandaloneDisplay,
} from '@/lib/pwaUpdate';

type SettingsTab =
  | 'account'
  | 'preferences'
  | 'appearance'
  | 'notifications'
  | 'finances'
  | 'system';

interface BackendVersionInfo {
  service: string;
  version: string;
  channel: string;
  buildId: string;
  nodeEnv: string;
  database?: string;
  emailConfigured?: boolean;
  emailWorkerEnabled?: boolean;
  emailFrom?: string | null;
}

type ApiState = 'checking' | 'reachable' | 'unreachable';

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { user, signOut } = useAuth();
  const { projects } = useProjects();
  const { plan, isPro, limits } = usePlan();
  const { showToast } = useToast();
  const { t } = useT();
  const { start: startOnboardingTour } = useOnboardingTour();
  const demo = isDemoMode();

  const [backendInfo, setBackendInfo] = useState<BackendVersionInfo | null>(null);
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [localPerm, setLocalPerm] = useState<LocalPermissionState>('prompt');
  const [testingEmail, setTestingEmail] = useState(false);
  const [checkingPwa, setCheckingPwa] = useState(false);
  const [resettingPwa, setResettingPwa] = useState(false);
  const [confirmDemoReset, setConfirmDemoReset] = useState(false);
  const [confirmPwaReset, setConfirmPwaReset] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('account');
  const tasksByDay = useStore(s => s.tasksByDay);
  const isInstalledApp = isStandaloneDisplay();

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: typeof User;
  }> = [
    { id: 'account', label: t('settings_tab_account'), icon: User },
    {
      id: 'preferences',
      label: t('settings_tab_preferences'),
      icon: SlidersHorizontal,
    },
    { id: 'appearance', label: t('settings_tab_appearance'), icon: Palette },
    {
      id: 'notifications',
      label: t('settings_tab_notifications'),
      icon: Bell,
    },
    { id: 'finances', label: t('settings_tab_finances'), icon: Wallet },
    { id: 'system', label: t('settings_tab_system'), icon: Monitor },
  ];

  useEffect(() => {
    void getLocalPermissionState().then(setLocalPerm);
  }, []);

  async function refreshStatus() {
    if (demo) {
      setBackendInfo({
        service: 'daily-tracker-api',
        version: '0.0.0-demo',
        channel: 'demo',
        buildId: new Date().toISOString(),
        nodeEnv: 'demo',
        database: 'supabase',
        emailConfigured: false,
        emailWorkerEnabled: false,
        emailFrom: null,
      });
      setApiState('reachable');
      return;
    }
    setApiState('checking');
    try {
      const info = await api.publicGet<BackendVersionInfo>('/api/version');
      setBackendInfo(info);
      setApiState('reachable');
    } catch {
      setApiState('unreachable');
    }
  }

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle<K extends keyof typeof settings>(key: K, value: boolean) {
    try {
      await updateSettings({ [key]: value } as Partial<typeof settings>);
      showToast('Preferencias guardadas.', 'success');
    } catch {
      showToast('No pudimos guardar las preferencias.', 'error');
    }
  }

  async function handleDefaultProject(projectId: string) {
    try {
      await updateSettings({ defaultProjectId: projectId || null });
      showToast('Proyecto por defecto actualizado.', 'success');
    } catch {
      showToast('No pudimos guardar las preferencias.', 'error');
    }
  }

  async function handleDefaultBoardView(view: BoardViewMode) {
    try {
      await updateSettings({ defaultBoardView: view });
      showToast('Vista por defecto actualizada.', 'success');
    } catch {
      showToast('No pudimos guardar las preferencias.', 'error');
    }
  }

  async function handleSkin(skinId: string) {
    try {
      await updateSettings({ skinId });
      showToast('Apariencia actualizada.', 'success');
    } catch {
      showToast('No pudimos guardar las preferencias.', 'error');
    }
  }

  function handleResetDemo() {
    clearDemoState();
    window.location.reload();
  }

  async function handleEnableDeviceNotifications() {
    const state = await requestLocalPermission();
    setLocalPerm(state);
    if (state === 'granted') {
      await updateSettings({ notifyLocal: true, timezone: getDeviceTimezone() });
      const result = await rescheduleLocalNotifications({
        tasksByDay,
        settings: { ...settings, notifyLocal: true },
        language: settings.language === 'en' ? 'en' : 'es',
      });
      showToast(
        t('settings_notify_local_scheduled').replace('{n}', String(result.scheduled)),
        'success'
      );
    } else if (state === 'denied') {
      showToast(t('settings_notify_permission_denied'), 'error');
    }
  }

  async function handleToggleLocal(value: boolean) {
    if (value) {
      await handleEnableDeviceNotifications();
      return;
    }
    await handleToggle('notifyLocal', false);
    await rescheduleLocalNotifications({
      tasksByDay,
      settings: { ...settings, notifyLocal: false },
    });
  }

  async function handleTestEmail() {
    if (demo) {
      showToast(t('settings_notify_test_email_skipped'), 'info');
      return;
    }
    setTestingEmail(true);
    try {
      if (!settings.notifyEmail) {
        await updateSettings({ notifyEmail: true });
      }
      const res = await api.post<{ ok: boolean; skipped?: boolean; message?: string }>(
        '/api/notifications/test-email',
        {}
      );
      if (res.skipped) {
        showToast(t('settings_notify_test_email_skipped'), 'info');
      } else {
        showToast(t('settings_notify_test_email_sent'), 'success');
      }
    } catch {
      showToast(t('settings_notify_test_email_error'), 'error');
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <Layout title={t('nav_settings')} showFab={false}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Tabs */}
        <div className="shrink-0 border-b border-border bg-surface/80 px-2 pt-2 md:px-4">
          <div
            role="tablist"
            aria-label={t('nav_settings')}
            className="mx-auto flex max-w-3xl gap-0.5 overflow-x-auto pb-0"
          >
            {tabs.map(item => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'border-border bg-background text-accent-teal'
                      : 'border-transparent text-text-muted hover:bg-background/60 hover:text-text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Cuenta */}
          {tab === 'account' && (
          <>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('settings_account')}</h2>
            <div className="flex items-center gap-3">
              {userAvatarUrl(user) ? (
                <img src={userAvatarUrl(user)!} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-teal/20 text-sm font-semibold text-accent-teal">
                  {userDisplayName(user).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {userDisplayName(user)}
                </p>
                <p className="truncate text-xs text-text-muted">{user?.email}</p>
              </div>
              <Badge variant={isPro ? 'teal' : 'secondary'}>{plan === 'pro' ? 'Pro' : 'Free'}</Badge>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              size="sm"
              className="mt-3 w-full sm:w-auto"
            >
              {t('action_sign_out')}
            </Button>
          </section>

          {/* Plan */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('settings_plan')}</h2>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <dt className="text-text-muted">Proyectos máximos</dt>
              <dd className="text-right text-text-primary">
                {Number.isFinite(limits.maxProjects) ? limits.maxProjects : 'ilimitado'}
              </dd>
              <dt className="text-text-muted">Tareas por mes</dt>
              <dd className="text-right text-text-primary">
                {Number.isFinite(limits.maxTasksPerMonth)
                  ? limits.maxTasksPerMonth
                  : 'ilimitado'}
              </dd>
              <dt className="text-text-muted">Semanas pasadas</dt>
              <dd className="text-right">{limits.canViewPastWeeks ? '✓' : '—'}</dd>
              <dt className="text-text-muted">Analytics</dt>
              <dd className="text-right">{limits.canViewAnalytics ? '✓' : '—'}</dd>
              <dt className="text-text-muted">Export CSV</dt>
              <dd className="text-right">{limits.canExportCsv ? '✓' : '—'}</dd>
            </dl>
          </section>
          </>
          )}

          {/* Notificaciones */}
          {tab === 'notifications' && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Bell className="h-4 w-4 text-accent-teal" />
                {t('settings_notifications')}
              </h2>
              <a
                href="/notifications"
                className="text-[11px] font-medium text-accent-teal hover:underline"
              >
                {t('nav_notifications')} →
              </a>
            </div>

            <div className="mb-4 rounded-md border border-border bg-background p-3">
              <TimezoneField
                value={settings.timezone || getDeviceTimezone()}
                onChange={tz => void updateSettings({ timezone: tz })}
              />
            </div>

            <SettingRow
              title={t('settings_notify_local')}
              description={t('settings_notify_local_desc')}
              value={settings.notifyLocal !== false}
              onChange={v => void handleToggleLocal(v)}
            />
            {settings.notifyLocal !== false && localPerm !== 'granted' && (
              <Button
                variant="outline"
                size="sm"
                className="mb-3 w-full sm:w-auto"
                onClick={() => void handleEnableDeviceNotifications()}
              >
                {t('settings_notify_enable_device')}
              </Button>
            )}
            {localPerm === 'denied' && (
              <p className="mb-3 text-[11px] text-accent-red">
                {t('settings_notify_permission_denied')}
              </p>
            )}

            <SettingRow
              title={t('settings_notify_email')}
              description={t('settings_notify_email_desc')}
              value={Boolean(settings.notifyEmail)}
              onChange={v => handleToggle('notifyEmail', v)}
            />
            {settings.notifyEmail && (
              <Button
                variant="outline"
                size="sm"
                className="mb-3 gap-1.5"
                disabled={testingEmail}
                onClick={() => void handleTestEmail()}
              >
                <Mail className="h-3.5 w-3.5" />
                {t('settings_notify_test_email')}
              </Button>
            )}

            <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('settings_notify_modes_title')}
            </p>

            {/* Modo 1: X minutos antes */}
            <SettingRow
              title={t('settings_notify_before_enabled')}
              description={t('settings_notify_before_enabled_desc')}
              value={settings.notifyBeforeEnabled !== false}
              onChange={v => handleToggle('notifyBeforeEnabled', v)}
            />
            {settings.notifyBeforeEnabled !== false && (
              <div className="mb-3 ml-1">
                <label className="mb-1 block text-[11px] font-medium text-text-muted">
                  {t('settings_notify_minutes')}
                </label>
                <p className="mb-1.5 text-[10px] text-text-muted">
                  {t('settings_notify_minutes_desc')}
                </p>
                <SimpleSelect
                  aria-label={t('settings_notify_minutes')}
                  value={String(settings.notifyMinutesBefore ?? 10)}
                  onChange={v =>
                    void updateSettings({
                      notifyMinutesBefore: Number(v),
                    })
                  }
                  className="w-full text-sm sm:w-auto"
                  options={NOTIFY_MINUTES_OPTIONS.map(m => ({
                    value: String(m),
                    label: m === 0 ? '0 min' : `${m} min`,
                  }))}
                />
              </div>
            )}

            {/* Modo 2: día anterior */}
            <SettingRow
              title={t('settings_notify_day_before')}
              description={t('settings_notify_day_before_desc')}
              value={settings.notifyDayBefore !== false}
              onChange={v => handleToggle('notifyDayBefore', v)}
            />
            {settings.notifyDayBefore !== false && (
              <div className="mb-3 ml-1">
                <label className="mb-1 block text-[11px] font-medium text-text-muted">
                  {t('settings_notify_day_before_time')}
                </label>
                <TimeInput
                  value={settings.notifyDayBeforeTime ?? '20:00'}
                  onChange={v =>
                    void updateSettings({
                      notifyDayBeforeTime: v || '20:00',
                    })
                  }
                  nowLabel={t('time_now')}
                />
              </div>
            )}

            {/* Modo 3: pasado incompleto */}
            <SettingRow
              title={t('settings_notify_past')}
              description={t('settings_notify_past_desc')}
              value={settings.notifyPastIncomplete !== false}
              onChange={v => handleToggle('notifyPastIncomplete', v)}
            />
            {settings.notifyPastIncomplete !== false && (
              <div className="mb-3 ml-1">
                <label className="mb-1 block text-[11px] font-medium text-text-muted">
                  {t('settings_notify_past_after')}
                </label>
                <SimpleSelect
                  aria-label={t('settings_notify_past_after')}
                  value={String(settings.notifyPastAfterMinutes ?? 30)}
                  onChange={v =>
                    void updateSettings({
                      notifyPastAfterMinutes: Number(v),
                    })
                  }
                  className="w-full text-sm sm:w-auto"
                  options={NOTIFY_PAST_AFTER_OPTIONS.map(m => ({
                    value: String(m),
                    label: m >= 60 ? `${m / 60} h` : `${m} min`,
                  }))}
                />
              </div>
            )}

            <SettingRow
              title={t('settings_notify_tasks')}
              description={t('settings_notify_tasks_desc')}
              value={settings.notifyTasks !== false}
              onChange={v => handleToggle('notifyTasks', v)}
            />
            <SettingRow
              title={t('settings_notify_rx')}
              description={t('settings_notify_rx_desc')}
              value={settings.notifyRx !== false}
              onChange={v => handleToggle('notifyRx', v)}
            />
          </section>
          )}

          {/* Preferencias */}
          {tab === 'preferences' && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('settings_preferences')}</h2>

            <div className="mb-4 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">{t('settings_replay_tour')}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{t('settings_replay_tour_desc')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => {
                  markOnboardingPending();
                  void updateSettings({ onboardingTourCompleted: false });
                  startOnboardingTour();
                }}
              >
                {t('settings_replay_tour')}
              </Button>
            </div>

            {/* Idioma */}
            <div className="mb-4 border-b border-border pb-4">
              <p className="mb-2 text-sm font-medium text-text-primary">{t('settings_language')}</p>
              <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                {(['es', 'en'] as Language[]).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => void updateSettings({ language: lang })}
                    className={cn(
                      'rounded px-3 py-1 text-xs font-medium transition-colors',
                      settings.language === lang
                        ? 'bg-accent-teal/20 text-accent-teal'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {lang === 'es' ? t('settings_language_es') : t('settings_language_en')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 border-b border-border pb-4">
              <TimezoneField
                value={settings.timezone || getDeviceTimezone()}
                onChange={tz => void updateSettings({ timezone: tz })}
              />
            </div>

            {/* Memento mori: fecha de nacimiento + esperanza de vida */}
            <div className="mb-4 border-b border-border pb-4">
              <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="birth-date">
                {t('settings_birth_date')}
              </label>
              <p className="mb-2 text-[11px] text-text-muted">{t('settings_birth_date_desc')}</p>
              <input
                id="birth-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                min="1900-01-01"
                value={settings.birthDate ?? ''}
                onChange={e => {
                  const v = e.target.value || null;
                  void updateSettings({ birthDate: v });
                }}
                className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <label
                className="mb-1.5 mt-3 block text-xs font-medium text-text-muted"
                htmlFor="lifespan-years"
              >
                {t('settings_lifespan')}
              </label>
              <p className="mb-2 text-[11px] text-text-muted">{t('settings_lifespan_desc')}</p>
              <input
                id="lifespan-years"
                type="number"
                min={MIN_LIFESPAN_YEARS}
                max={MAX_LIFESPAN_YEARS}
                step={1}
                value={settings.expectedLifespanYears ?? DEFAULT_LIFESPAN_YEARS}
                onChange={e => {
                  const n = clampLifespanYears(Number(e.target.value));
                  void updateSettings({ expectedLifespanYears: n });
                }}
                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <SettingRow
              title={t('settings_week_starts_monday')}
              description={t('settings_week_starts_monday_desc')}
              value={settings.weekStartsOnMonday}
              onChange={v => handleToggle('weekStartsOnMonday', v)}
            />

            <SettingRow
              title={t('settings_auto_roll')}
              description={t('settings_auto_roll_desc')}
              value={settings.autoRollIncomplete}
              onChange={v => handleToggle('autoRollIncomplete', v)}
            />

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                {t('settings_default_project')}
              </label>
              <SimpleSelect
                aria-label={t('settings_default_project')}
                value={settings.defaultProjectId ?? '__none__'}
                onChange={v =>
                  handleDefaultProject(v === '__none__' ? '' : v)
                }
                className="w-full text-sm"
                options={[
                  { value: '__none__', label: t('settings_none') },
                  ...projects.map(p => ({
                    value: p.id,
                    label: `${p.icon} ${p.name}`,
                  })),
                ]}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                {t('settings_default_board_view')}
              </label>
              <p className="mb-1.5 text-[11px] text-text-muted">
                {t('settings_default_board_view_desc')}
              </p>
              <SimpleSelect
                aria-label={t('settings_default_board_view')}
                value={settings.defaultBoardView ?? 'continuous'}
                onChange={v => handleDefaultBoardView(v as BoardViewMode)}
                className="w-full text-sm"
                options={[
                  { value: 'day', label: t('board_day_view') },
                  { value: 'week', label: t('board_week_view') },
                  { value: 'month', label: t('board_month_view') },
                  { value: 'continuous', label: t('board_continuous_view') },
                ]}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                {t('settings_default_schedule_layout')}
              </label>
              <p className="mb-1.5 text-[11px] text-text-muted">
                {t('settings_default_schedule_layout_desc')}
              </p>
              <SimpleSelect
                aria-label={t('settings_default_schedule_layout')}
                value={settings.defaultScheduleLayout ?? 'list'}
                onChange={v =>
                  void updateSettings({
                    defaultScheduleLayout: v as ScheduleLayout,
                  })
                }
                className="w-full text-sm"
                options={[
                  { value: 'list', label: t('layout_list') },
                  { value: 'schedule', label: t('layout_schedule') },
                ]}
              />
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-text-muted">
                {t('settings_day_start_hour')} / {t('settings_day_end_hour')}
              </p>
              <p className="mb-2 text-[11px] text-text-muted">
                {t('settings_schedule_hours_desc')}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <span>{t('settings_day_start_hour')}</span>
                  <SimpleSelect
                    aria-label={t('settings_day_start_hour')}
                    value={String(settings.dayStartHour ?? 7)}
                    onChange={v => {
                      const dayStartHour = Number(v);
                      const dayEndHour = Math.max(
                        dayStartHour + 1,
                        settings.dayEndHour ?? 22
                      );
                      void updateSettings({ dayStartHour, dayEndHour });
                    }}
                    className="w-[5.5rem] text-sm"
                    options={Array.from({ length: 24 }, (_, h) => ({
                      value: String(h),
                      label: `${String(h).padStart(2, '0')}:00`,
                    }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <span>{t('settings_day_end_hour')}</span>
                  <SimpleSelect
                    aria-label={t('settings_day_end_hour')}
                    value={String(settings.dayEndHour ?? 22)}
                    onChange={v => {
                      const dayEndHour = Number(v);
                      const dayStartHour = Math.min(
                        settings.dayStartHour ?? 7,
                        dayEndHour - 1
                      );
                      void updateSettings({ dayStartHour, dayEndHour });
                    }}
                    className="w-[5.5rem] text-sm"
                    options={Array.from({ length: 24 }, (_, i) => i + 1).map(h => ({
                      value: String(h),
                      label: `${String(h).padStart(2, '0')}:00`,
                    }))}
                  />
                </label>
              </div>
            </div>
          </section>
          )}

          {/* Finances */}
          {tab === 'finances' && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Wallet className="h-4 w-4 text-accent-teal" />
              {t('settings_finances_title')}
            </h2>
            <p className="mb-4 text-[11px] text-text-muted">
              {t('settings_finances_intro')}
            </p>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t('settings_preferred_currency')}
            </label>
            <p className="mb-2 text-[11px] text-text-muted">
              {t('settings_preferred_currency_desc')}
            </p>
            <SimpleSelect
              aria-label={t('settings_preferred_currency')}
              value={resolveDefaultCurrency({
                stored: settings.preferredCurrency,
                timezone: settings.timezone,
                locale: settings.language === 'en' ? 'en-US' : 'es-CL',
              })}
              onChange={v => {
                void (async () => {
                  try {
                    await updateSettings({
                      preferredCurrency: v,
                    });
                    showToast('Preferencias guardadas.', 'success');
                  } catch {
                    showToast('No pudimos guardar las preferencias.', 'error');
                  }
                })();
              }}
              className="w-full text-sm"
              options={SUPPORTED_CURRENCIES.map(c => ({
                value: c.code,
                label: c.label,
              }))}
            />
            <p className="mt-4 text-[11px] text-text-muted">
              <a
                href="/finances"
                className="font-medium text-accent-teal hover:underline"
              >
                {t('nav_finances')} →
              </a>
            </p>
          </section>
          )}

          {/* Skins */}
          {tab === 'appearance' && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 text-sm font-semibold text-text-primary">
              {t('settings_completed_style')}
            </h2>
            <p className="mb-3 text-[11px] text-text-muted">
              {t('settings_completed_style_desc')}
            </p>
            <div className="mb-6 grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: 'strikethrough' as const,
                    title: t('settings_completed_style_strike'),
                    desc: t('settings_completed_style_strike_desc'),
                    previewClass: 'text-text-muted line-through',
                  },
                  {
                    id: 'check_only' as const,
                    title: t('settings_completed_style_check'),
                    desc: t('settings_completed_style_check_desc'),
                    previewClass: 'text-text-muted',
                  },
                ] satisfies Array<{
                  id: CompletedTaskStyle;
                  title: string;
                  desc: string;
                  previewClass: string;
                }>
              ).map(opt => {
                const selected =
                  (settings.completedTaskStyle ?? 'strikethrough') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      void updateSettings({ completedTaskStyle: opt.id })
                    }
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-accent-teal bg-accent-teal/10'
                        : 'border-border bg-background hover:border-accent-teal/40'
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-accent-green bg-accent-green/20 text-accent-green">
                        <span className="text-[10px] font-bold">✓</span>
                      </span>
                      <span className={cn('text-sm', opt.previewClass)}>
                        {t('task_kind_task')}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-text-primary">{opt.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <h2 className="mb-1 text-sm font-semibold text-text-primary">{t('settings_skin')}</h2>
            <p className="mb-4 text-[11px] text-text-muted">{t('settings_skin_desc')}</p>

            <SkinGrid
              title={t('settings_skin_glass_light')}
              subtitle={t('settings_skin_glass_desc')}
              skins={skinsByMode('glass-light')}
              selectedId={settings.skinId}
              language={settings.language}
              onSelect={id => void handleSkin(id)}
            />
            <SkinGrid
              title={t('settings_skin_glass_dark')}
              subtitle={t('settings_skin_glass_desc')}
              skins={skinsByMode('glass-dark')}
              selectedId={settings.skinId}
              language={settings.language}
              onSelect={id => void handleSkin(id)}
              className="mt-5"
            />
            <SkinGrid
              title={t('settings_skin_dark')}
              skins={skinsByMode('dark')}
              selectedId={settings.skinId}
              language={settings.language}
              onSelect={id => void handleSkin(id)}
              className="mt-5"
            />
            <SkinGrid
              title={t('settings_skin_light')}
              skins={skinsByMode('light')}
              selectedId={settings.skinId}
              language={settings.language}
              onSelect={id => void handleSkin(id)}
              className="mt-5"
            />
          </section>
          )}

          {/* App instalada / PWA updates */}
          {tab === 'system' && (
          <>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Download className="h-4 w-4 text-accent-teal" />
              {t('pwa_settings_title')}
            </h2>
            <p className="mb-3 text-[11px] text-text-muted">{t('pwa_settings_desc')}</p>
            {isInstalledApp && (
              <p className="mb-3 rounded-md border border-accent-teal/30 bg-accent-teal/10 px-2.5 py-1.5 text-[11px] text-accent-teal">
                {t('pwa_installed_badge')
                  .replace('{version}', appVersion.version)
                  .replace('{build}', appVersion.buildId.slice(0, 10))}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={checkingPwa}
                onClick={() => {
                  void (async () => {
                    setCheckingPwa(true);
                    try {
                      const found = await checkForPwaUpdate();
                      showToast(
                        found ? t('pwa_check_updates_found') : t('pwa_check_updates_ok'),
                        found ? 'info' : 'success'
                      );
                    } catch {
                      showToast(t('pwa_check_updates_error'), 'error');
                    } finally {
                      setCheckingPwa(false);
                    }
                  })();
                }}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', checkingPwa && 'animate-spin')} />
                {t('pwa_check_updates')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={resettingPwa}
                onClick={() => setConfirmPwaReset(true)}
              >
                <Download className="h-3.5 w-3.5" />
                {resettingPwa ? t('pwa_hard_reset_running') : t('pwa_hard_reset')}
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-text-muted">{t('pwa_hard_reset_desc')}</p>
          </section>

          {/* Estado */}
          <section className="rounded-lg border border-border bg-surface p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{t('settings_status')}</h2>
              <button
                onClick={() => void refreshStatus()}
                className="flex items-center gap-1 rounded p-1 text-text-muted hover:bg-background hover:text-text-primary"
                aria-label="Refrescar"
                title="Refrescar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-text-muted">Modo</dt>
              <dd className="text-right">
                {demo ? (
                  <Badge variant="pink" className="gap-1">
                    <Sparkles className="h-3 w-3" /> {t('status_demo')}
                  </Badge>
                ) : (
                  <Badge variant="teal">{t('status_production')}</Badge>
                )}
              </dd>

              <dt className="text-text-muted">API</dt>
              <dd className="text-right">
                {apiState === 'reachable' && <Badge variant="green">{t('status_ok')}</Badge>}
                {apiState === 'unreachable' && <Badge variant="red">{t('status_offline')}</Badge>}
                {apiState === 'checking' && <Badge variant="secondary">{t('status_checking')}</Badge>}
              </dd>

              <dt className="text-text-muted">Frontend</dt>
              <dd className="text-right text-text-primary">
                {appVersion.version} · {appVersion.channel}
              </dd>
              <dt className="text-text-muted">Backend</dt>
              <dd className="text-right text-text-primary">
                {backendInfo
                  ? `${backendInfo.version} · ${backendInfo.channel}`
                  : 'desconectado'}
              </dd>
              {backendInfo?.database && (
                <>
                  <dt className="text-text-muted">Base de datos</dt>
                  <dd className="text-right text-text-primary">{backendInfo.database}</dd>
                </>
              )}

              <dt className="text-text-muted">{t('settings_status_email')}</dt>
              <dd className="text-right">
                {demo ? (
                  <Badge variant="secondary">{t('settings_status_email_na')}</Badge>
                ) : backendInfo?.emailConfigured ? (
                  <Badge variant="green">{t('settings_status_email_ok')}</Badge>
                ) : apiState === 'reachable' ? (
                  <Badge variant="red">{t('settings_status_email_off')}</Badge>
                ) : (
                  <Badge variant="secondary">—</Badge>
                )}
              </dd>
              {backendInfo?.emailConfigured && backendInfo.emailFrom && (
                <>
                  <dt className="text-text-muted">{t('settings_status_email_from')}</dt>
                  <dd
                    className="truncate text-right text-[11px] text-text-primary"
                    title={backendInfo.emailFrom}
                  >
                    {backendInfo.emailFrom}
                  </dd>
                </>
              )}
              <dt className="text-text-muted">{t('settings_status_email_worker')}</dt>
              <dd className="text-right">
                {demo ? (
                  <Badge variant="secondary">—</Badge>
                ) : backendInfo?.emailWorkerEnabled ? (
                  <Badge variant="green">{t('status_ok')}</Badge>
                ) : apiState === 'reachable' ? (
                  <Badge variant="secondary">{t('settings_status_email_worker_off')}</Badge>
                ) : (
                  <Badge variant="secondary">—</Badge>
                )}
              </dd>
            </dl>
            <p className="mt-3 text-[11px] text-text-muted">
              {t('settings_status_auth_hint')}{' '}
              <a
                href="https://github.com/fafrancod/tracker-pro/blob/main/docs/AUTH_AND_EMAIL.md"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-teal hover:underline"
              >
                docs/AUTH_AND_EMAIL.md
              </a>
              {' · '}
              <a
                href="https://github.com/fafrancod/tracker-pro/blob/main/roadmap_mail.md"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-teal hover:underline"
              >
                roadmap_mail.md
              </a>
            </p>
            {demo && (
              <p className="mt-3 rounded border border-accent-pink/30 bg-accent-pink/5 p-2 text-[11px] text-text-muted">
                Estás en demo. Los cambios se guardan en este navegador (localStorage) hasta que cierres
                sesión. No se llama a Supabase ni a la API.
              </p>
            )}
          </section>

          {demo && (
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold text-text-primary">Zona demo</h2>
              <p className="mb-3 text-xs text-text-muted">
                Resetea tu progreso local y vuelve a los datos sembrados de fábrica.
              </p>
              <Button
                onClick={() => setConfirmDemoReset(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resetear datos demo
              </Button>
            </section>
          )}
          </>
          )}
        </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDemoReset}
        onOpenChange={setConfirmDemoReset}
        title={t('settings_demo_reset_title')}
        description={t('settings_demo_reset_confirm')}
        confirmLabel={t('action_confirm')}
        variant="warning"
        onConfirm={() => {
          setConfirmDemoReset(false);
          handleResetDemo();
        }}
      />

      <ConfirmDialog
        open={confirmPwaReset}
        onOpenChange={open => {
          if (!open && !resettingPwa) setConfirmPwaReset(false);
        }}
        title={t('pwa_hard_reset_title')}
        description={t('pwa_hard_reset_confirm')}
        confirmLabel={t('action_confirm')}
        variant="warning"
        loading={resettingPwa}
        loadingLabel={t('pwa_hard_reset_running')}
        onConfirm={() => {
          setResettingPwa(true);
          void hardResetPwaAndReload();
        }}
      />
    </Layout>
  );
}

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          value ? 'bg-accent-teal' : 'bg-border'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SkinGrid({
  title,
  subtitle,
  skins,
  selectedId,
  language,
  onSelect,
  className,
}: {
  title: string;
  subtitle?: string;
  skins: SkinDefinition[];
  selectedId: string;
  language: Language;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {subtitle && (
        <p className="mb-2 text-[10px] leading-snug text-text-muted">{subtitle}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {skins.map(skin => {
          const label = language === 'en' ? skin.nameEn : skin.name;
          const selected = selectedId === skin.id;
          const isGlass = isGlassSkin(skin)
          const previewBg = skin.tokens.solidBackground ?? skin.tokens.background;
          const backdrop = skin.tokens.backdrop
            ? skin.tokens.backdrop.replace(/\s+/g, ' ').trim()
            : undefined;
          return (
            <button
              key={skin.id}
              type="button"
              onClick={() => onSelect(skin.id)}
              title={label}
              className={cn(
                'flex flex-col overflow-hidden rounded-lg border text-left transition-shadow',
                selected
                  ? 'border-accent-teal ring-2 ring-accent-teal/40'
                  : 'border-border hover:border-accent-teal/40'
              )}
            >
              <div
                className="relative flex h-12 items-end gap-0.5 px-1.5 pb-1.5 pt-1"
                style={{
                  backgroundColor: previewBg,
                  backgroundImage: backdrop,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {isGlass && (
                  <span className="absolute right-1 top-1 rounded bg-black/30 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-white/95">
                    LG
                  </span>
                )}
                <span
                  className="h-5 flex-1 rounded-md"
                  style={{
                    backgroundColor: skin.tokens.surface,
                    border: `1px solid ${skin.tokens.border}`,
                    boxShadow: isGlass
                      ? 'inset 0 1px 0 rgba(255,255,255,0.45)'
                      : undefined,
                    backdropFilter: isGlass ? 'blur(8px)' : undefined,
                    WebkitBackdropFilter: isGlass ? 'blur(8px)' : undefined,
                  }}
                />
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: skin.tokens.accentTeal }}
                />
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: skin.tokens.accentGreen }}
                />
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: skin.tokens.accentPink }}
                />
              </div>
              <span
                className="truncate px-1.5 py-1 text-[10px] font-medium"
                style={{
                  backgroundColor: skin.tokens.surface,
                  color: skin.tokens.textPrimary,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
