import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Mail,
  RefreshCw,
  Pill,
  ListChecks,
  FolderKanban,
  Clock,
  CalendarClock,
  AlertCircle,
  Settings,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { useStore } from '@core/store';
import { useProjects } from '@core/hooks/useProjects';
import { fetchTasksInRange, getDayId } from '@core/services/taskService';
import type { TKey } from '@/lib/i18n';
import {
  collectNotifiableOccurrences,
  NOTIFY_MINUTES_OPTIONS,
  NOTIFY_PAST_AFTER_OPTIONS,
  prefsFromSettings,
  type NotifyMode,
  type NotifiableOccurrence,
} from '@core/lib/notifications';
import { isRxKind } from '@core/lib/rx';
import { isDemoMode } from '@core/lib/demoMode';
import { api } from '@core/lib/api';
import { cn } from '@/lib/utils';
import {
  formatTimezoneLabel,
  getDeviceTimezone,
  listTimezoneOptions,
} from '@/lib/timezones';
import {
  getLocalPermissionState,
  requestLocalPermission,
  rescheduleLocalNotifications,
  type LocalPermissionState,
} from '@/lib/localNotifications';
import { TimeInput } from '@/components/ui/time-input';
import type { Task, TaskKind } from '@core/types';

type CategoryFilter = 'all' | 'tasks' | 'reminders' | 'rx' | 'projects';

function dayIdFromDate(d: Date): string {
  return getDayId(d);
}

function modeBadgeKey(mode: NotifyMode): TKey {
  if (mode === 'day_before') return 'notify_mode_day_before';
  if (mode === 'past') return 'notify_mode_past';
  return 'notify_mode_before';
}

function kindLabel(kind: TaskKind, t: (k: TKey) => string): string {
  if (kind === 'rx_human') return t('task_kind_rx_human');
  if (kind === 'rx_pet') return t('task_kind_rx_pet');
  if (kind === 'reminder') return t('task_kind_reminder');
  return t('task_kind_task');
}

function matchesCategory(
  occ: NotifiableOccurrence,
  filter: CategoryFilter,
  projectId: string | null,
  task: (Task & { dayId: string }) | undefined
): boolean {
  if (filter === 'all') return true;
  if (filter === 'rx') return isRxKind(occ.kind);
  if (filter === 'reminders') return occ.kind === 'reminder';
  if (filter === 'tasks') return occ.kind === 'task' || occ.kind === 'reminder';
  if (filter === 'projects') {
    if (!projectId) return Boolean(task?.projectId);
    return task?.projectId === projectId;
  }
  return true;
}

export function NotificationsPage() {
  const { t, locale, shortDateFormat, language } = useT();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const setDayTasks = useStore(s => s.setDayTasks);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [localPerm, setLocalPerm] = useState<LocalPermissionState>('prompt');
  const [resyncing, setResyncing] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const lang = language === 'en' ? 'en' : 'es';
  const prefs = useMemo(() => prefsFromSettings(settings), [settings]);

  // Índice taskId → task+dayId para filtros de proyecto
  const taskIndex = useMemo(() => {
    const map = new Map<string, Task & { dayId: string; weekId: string }>();
    for (const [weekId, days] of Object.entries(tasksByDay)) {
      for (const [dayId, list] of Object.entries(days)) {
        for (const task of list) {
          map.set(task.id, { ...task, dayId, weekId });
        }
      }
    }
    return map;
  }, [tasksByDay]);

  const loadRange = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const from = dayIdFromDate(addDays(now, -1));
      const to = dayIdFromDate(addDays(now, 14));

      if (isDemoMode()) {
        // Demo ya tiene seed en el store
        setLoading(false);
        return;
      }

      const rows = await fetchTasksInRange(uid, from, to);
      // Agrupar por start day y fusionar en store
      const byKey = new Map<string, Array<Task & { weekId: string; dayId: string }>>();
      for (const row of rows) {
        const key = `${row.weekId}|${row.dayId}`;
        if (!byKey.has(key)) byKey.set(key, []);
        const { weekId, dayId, ...task } = row;
        byKey.get(key)!.push({ ...task, weekId, dayId });
      }
      for (const group of byKey.values()) {
        const w = group[0].weekId;
        const d = group[0].dayId;
        const existing = useStore.getState().tasksByDay[w]?.[d] ?? [];
        const byId = new Map(existing.map(t => [t.id, t]));
        for (const g of group) {
          const { weekId: _w, dayId: _d, ...task } = g;
          byId.set(task.id, task);
        }
        setDayTasks(
          w,
          d,
          Array.from(byId.values()).sort((a, b) => a.order - b.order)
        );
      }
    } catch (err) {
      console.error('[notifications] load range', err);
      showToast(t('notify_hub_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, setDayTasks, showToast, t]);

  useEffect(() => {
    void loadRange();
    void getLocalPermissionState().then(setLocalPerm);
  }, [loadRange]);

  const flatTasks = useMemo(() => {
    const now = new Date();
    const from = dayIdFromDate(addDays(now, -1));
    const to = dayIdFromDate(addDays(now, 14));
    const out: Array<Task & { dayId: string }> = [];
    for (const days of Object.values(tasksByDay)) {
      for (const [dayId, list] of Object.entries(days)) {
        if (dayId < from || dayId > to) continue;
        for (const task of list) out.push({ ...task, dayId });
      }
    }
    return out;
  }, [tasksByDay]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const occs = collectNotifiableOccurrences(flatTasks, prefs, {
      language: lang,
      from: now,
    });
    return occs.filter(occ => {
      const task = taskIndex.get(occ.taskId);
      return matchesCategory(occ, category, projectFilter, task);
    });
  }, [flatTasks, prefs, lang, category, projectFilter, taskIndex]);

  const stats = useMemo(() => {
    const all = collectNotifiableOccurrences(flatTasks, prefs, {
      language: lang,
      from: new Date(),
    });
    return {
      total: all.length,
      before: all.filter(o => o.mode === 'before').length,
      dayBefore: all.filter(o => o.mode === 'day_before').length,
      past: all.filter(o => o.mode === 'past').length,
      rx: all.filter(o => isRxKind(o.kind)).length,
      tasks: all.filter(o => o.kind === 'task' || o.kind === 'reminder').length,
    };
  }, [flatTasks, prefs, lang]);

  async function handleReschedule() {
    setResyncing(true);
    try {
      if (settings.notifyLocal !== false && localPerm !== 'granted') {
        const p = await requestLocalPermission();
        setLocalPerm(p);
        if (p !== 'granted') {
          showToast(t('settings_notify_permission_denied'), 'error');
          return;
        }
        await updateSettings({ notifyLocal: true });
      }
      const result = await rescheduleLocalNotifications({
        tasksByDay,
        settings,
        language: lang,
      });
      showToast(
        t('settings_notify_local_scheduled').replace('{n}', String(result.scheduled)),
        'success'
      );
    } finally {
      setResyncing(false);
    }
  }

  async function handleTestEmail() {
    if (isDemoMode()) {
      showToast(t('settings_notify_test_email_skipped'), 'info');
      return;
    }
    setTestingEmail(true);
    try {
      if (!settings.notifyEmail) await updateSettings({ notifyEmail: true });
      const res = await api.post<{ ok: boolean; skipped?: boolean }>(
        '/api/notifications/test-email',
        {}
      );
      showToast(
        res.skipped
          ? t('settings_notify_test_email_skipped')
          : t('settings_notify_test_email_sent'),
        res.skipped ? 'info' : 'success'
      );
    } catch {
      showToast(t('settings_notify_test_email_error'), 'error');
    } finally {
      setTestingEmail(false);
    }
  }

  async function patchSetting<K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) {
    try {
      await updateSettings({ [key]: value } as Partial<typeof settings>);
      showToast(t('notify_hub_prefs_saved'), 'success');
    } catch {
      showToast(t('task_save_error'), 'error');
    }
  }

  function openTask(occ: NotifiableOccurrence) {
    const loc = taskIndex.get(occ.taskId);
    if (!loc) {
      navigate('/board');
      return;
    }
    setDetailTask({ weekId: loc.weekId, dayId: loc.dayId, taskId: loc.id });
  }

  const filters: Array<{ id: CategoryFilter; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: t('notify_hub_filter_all'), icon: <Bell className="h-3.5 w-3.5" /> },
    {
      id: 'tasks',
      label: t('notify_hub_filter_tasks'),
      icon: <ListChecks className="h-3.5 w-3.5" />,
    },
    {
      id: 'reminders',
      label: t('task_kind_reminder'),
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    { id: 'rx', label: t('notify_hub_filter_rx'), icon: <Pill className="h-3.5 w-3.5" /> },
    {
      id: 'projects',
      label: t('notify_hub_filter_projects'),
      icon: <FolderKanban className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <Layout title={t('notify_hub_title')} showFab={false}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <p className="text-sm text-text-muted">{t('notify_hub_intro')}</p>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label={t('notify_hub_upcoming')} value={stats.total} />
          <StatCard label={t('notify_mode_before')} value={stats.before} />
          <StatCard label={t('notify_mode_day_before')} value={stats.dayBefore} />
          <StatCard label={t('notify_mode_past')} value={stats.past} />
        </div>

        {/* Acciones rápidas */}
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={resyncing}
            onClick={() => void handleReschedule()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', resyncing && 'animate-spin')} />
            {t('notify_hub_reschedule')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={testingEmail}
            onClick={() => void handleTestEmail()}
          >
            <Mail className="h-3.5 w-3.5" />
            {t('settings_notify_test_email')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-3.5 w-3.5" />
            {t('nav_settings')}
          </Button>
          <span className="ml-auto text-[11px] text-text-muted">
            {formatTimezoneLabel(settings.timezone || getDeviceTimezone())}
          </span>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Lista de avisos programados */}
          <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {filters.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setCategory(f.id);
                    if (f.id !== 'projects') setProjectFilter(null);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    category === f.id
                      ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                      : 'border-border text-text-muted hover:text-text-primary'
                  )}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>

            {category === 'projects' && (
              <select
                value={projectFilter ?? ''}
                onChange={e => setProjectFilter(e.target.value || null)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary sm:w-auto"
              >
                <option value="">{t('notify_hub_any_project')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            )}

            {loading ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
                {t('notify_hub_loading')}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center">
                <BellRing className="h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">{t('notify_hub_empty')}</p>
                <Button size="sm" onClick={() => navigate('/board')}>
                  {t('dashboard_jump_to_board')}
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map(occ => {
                  const task = taskIndex.get(occ.taskId);
                  const project = projects.find(p => p.id === task?.projectId);
                  return (
                    <li key={`${occ.taskId}|${occ.mode}|${occ.dayId}|${occ.startTime}`}>
                      <button
                        type="button"
                        onClick={() => openTask(occ)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-accent-teal/40"
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            occ.mode === 'past'
                              ? 'bg-accent-red/15 text-accent-red'
                              : occ.mode === 'day_before'
                                ? 'bg-accent-pink/15 text-accent-pink'
                                : 'bg-accent-teal/15 text-accent-teal'
                          )}
                        >
                          {isRxKind(occ.kind) ? (
                            <Pill className="h-4 w-4" />
                          ) : occ.mode === 'past' ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <CalendarClock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {t(modeBadgeKey(occ.mode))}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {kindLabel(occ.kind, t)}
                            </Badge>
                            {project && (
                              <span className="text-[10px] text-text-muted">
                                {project.icon} {project.name}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-sm font-medium text-text-primary">
                            {occ.headline}
                          </p>
                          <p className="truncate text-xs text-text-muted">{occ.body}</p>
                          <p className="mt-1 text-[11px] tabular-nums text-text-muted">
                            {t('notify_hub_fires_at')}{' '}
                            <span className="font-semibold text-text-primary">
                              {format(occ.fireAt, `EEE ${shortDateFormat} · HH:mm`, {
                                locale,
                              })}
                            </span>
                            {occ.startTime
                              ? ` · ${t('notify_hub_event_at')} ${occ.startTime}`
                              : ''}
                            {' · '}
                            {occ.dayId}
                          </p>
                        </div>
                        {task?.completed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-green" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Programación de preferencias */}
          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-primary">
                {t('notify_hub_program_title')}
              </h2>

              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-text-muted">
                  {t('settings_notify_timezone')}
                </label>
                <select
                  value={settings.timezone || getDeviceTimezone()}
                  onChange={e => void patchSetting('timezone', e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                >
                  {listTimezoneOptions().map(tz => (
                    <option key={tz} value={tz}>
                      {formatTimezoneLabel(tz)}
                    </option>
                  ))}
                </select>
              </div>

              <Toggle
                title={t('settings_notify_local')}
                value={settings.notifyLocal !== false}
                onChange={v => void patchSetting('notifyLocal', v)}
              />
              <Toggle
                title={t('settings_notify_email')}
                value={Boolean(settings.notifyEmail)}
                onChange={v => void patchSetting('notifyEmail', v)}
              />

              <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {t('settings_notify_modes_title')}
              </p>

              <Toggle
                title={t('settings_notify_before_enabled')}
                value={settings.notifyBeforeEnabled !== false}
                onChange={v => void patchSetting('notifyBeforeEnabled', v)}
              />
              {settings.notifyBeforeEnabled !== false && (
                <select
                  value={settings.notifyMinutesBefore ?? 10}
                  onChange={e =>
                    void patchSetting('notifyMinutesBefore', Number(e.target.value))
                  }
                  className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {NOTIFY_MINUTES_OPTIONS.map(m => (
                    <option key={m} value={m}>
                      {m === 0 ? '0 min' : `${m} min`}
                    </option>
                  ))}
                </select>
              )}

              <Toggle
                title={t('settings_notify_day_before')}
                value={settings.notifyDayBefore !== false}
                onChange={v => void patchSetting('notifyDayBefore', v)}
              />
              {settings.notifyDayBefore !== false && (
                <div className="mb-2">
                  <TimeInput
                    value={settings.notifyDayBeforeTime ?? '20:00'}
                    onChange={v => void patchSetting('notifyDayBeforeTime', v || '20:00')}
                    nowLabel={t('time_now')}
                  />
                </div>
              )}

              <Toggle
                title={t('settings_notify_past')}
                value={settings.notifyPastIncomplete !== false}
                onChange={v => void patchSetting('notifyPastIncomplete', v)}
              />
              {settings.notifyPastIncomplete !== false && (
                <select
                  value={settings.notifyPastAfterMinutes ?? 30}
                  onChange={e =>
                    void patchSetting('notifyPastAfterMinutes', Number(e.target.value))
                  }
                  className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {NOTIFY_PAST_AFTER_OPTIONS.map(m => (
                    <option key={m} value={m}>
                      {m >= 60 ? `${m / 60} h` : `${m} min`}
                    </option>
                  ))}
                </select>
              )}

              <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {t('notify_hub_scope')}
              </p>
              <Toggle
                title={t('settings_notify_tasks')}
                value={settings.notifyTasks !== false}
                onChange={v => void patchSetting('notifyTasks', v)}
              />
              <Toggle
                title={t('settings_notify_rx')}
                value={settings.notifyRx !== false}
                onChange={v => void patchSetting('notifyRx', v)}
              />

              {localPerm !== 'granted' && settings.notifyLocal !== false && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => void handleReschedule()}
                >
                  {t('settings_notify_enable_device')}
                </Button>
              )}
            </section>

            <p className="text-[11px] text-text-muted">{t('notify_hub_hint')}</p>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function Toggle({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-2 flex cursor-pointer items-center justify-between gap-2 text-xs text-text-primary">
      <span className="min-w-0 flex-1 leading-snug">{title}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          value ? 'bg-accent-teal' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            value ? 'left-4' : 'left-0.5'
          )}
        />
      </button>
    </label>
  );
}
