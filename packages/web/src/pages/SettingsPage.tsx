import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@core/hooks/useProjects';
import { usePlan } from '@core/hooks/usePlan';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@core/lib/api';
import { isDemoMode } from '@core/lib/demoMode';
import { appVersion } from '@/lib/appVersion';

import { clearDemoState } from '@/lib/demoPersistence';
import { useT } from '@/hooks/useT';
import type { Language } from '@core/types';
import { cn } from '@/lib/utils';
import { userAvatarUrl, userDisplayName } from '@/lib/userDisplay';

interface BackendVersionInfo {
  service: string;
  version: string;
  channel: string;
  buildId: string;
  nodeEnv: string;
  database?: string;
}

type ApiState = 'checking' | 'reachable' | 'unreachable';

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { user, signOut } = useAuth();
  const { projects } = useProjects();
  const { plan, isPro, limits } = usePlan();
  const { showToast } = useToast();
  const { t } = useT();
  const demo = isDemoMode();

  const [backendInfo, setBackendInfo] = useState<BackendVersionInfo | null>(null);
  const [apiState, setApiState] = useState<ApiState>('checking');
  async function refreshStatus() {
    if (demo) {
      setBackendInfo({
        service: 'daily-tracker-api',
        version: '0.0.0-demo',
        channel: 'demo',
        buildId: new Date().toISOString(),
        nodeEnv: 'demo',
        database: 'supabase',
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

  function handleResetDemo() {
    if (!confirm('¿Resetear todos los datos demo? Vuelven al estado inicial sembrado.')) return;
    clearDemoState();
    window.location.reload();
  }

  return (
    <Layout title={t('nav_settings')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Cuenta */}
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

          {/* Preferencias */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('settings_preferences')}</h2>

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
              <select
                value={settings.defaultProjectId ?? ''}
                onChange={e => handleDefaultProject(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t('settings_none')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </div>
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
            </dl>
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
              <Button onClick={handleResetDemo} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Resetear datos demo
              </Button>
            </section>
          )}
        </div>
      </div>
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
