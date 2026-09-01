import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isAdminUser, PRIMARY_OWNER_EMAIL } from '@core/lib/adminPortal';
import {
  fetchAdminErrors,
  fetchAdminHealth,
  fetchAdminOverview,
} from '@core/services/adminService';
import { api } from '@core/lib/api';
import type {
  AdminErrorLogRow,
  AdminOverviewResponse,
} from '@core/lib/adminPortal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AdminUsersPanel } from '@/pages/AdminPage';

type AtenasTab = 'users' | 'analytics' | 'status' | 'errors';

const TABS: { id: AtenasTab; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'status', label: 'Estado', icon: Server },
  { id: 'errors', label: 'Fallos', icon: AlertTriangle },
];

interface VersionInfo {
  service: string;
  version: string;
  channel: string;
  buildId: string;
  nodeEnv: string;
  database?: string;
  emailConfigured?: boolean;
  emailWorkerEnabled?: boolean;
}

export function AtenasPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<AtenasTab>('users');
  const allowed = isAdminUser({
    email: user?.email,
    appMetadata: user?.app_metadata as { admin?: unknown } | undefined,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/atenas' }} />;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary">Acceso no autorizado</h1>
          <p className="mt-2 text-sm text-text-muted">
            Esta área no está disponible para tu cuenta.
          </p>
          <Link
            to="/board"
            className="mt-6 inline-flex text-sm font-medium text-accent-teal hover:underline"
          >
            Volver al tablero
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-teal">
              <Shield className="h-3.5 w-3.5" />
              Atenas
            </p>
            <h1 className="text-xl font-semibold text-text-primary">Portal de operaciones</h1>
            <p className="mt-1 text-xs text-text-muted">Solo {PRIMARY_OWNER_EMAIL}</p>
          </div>
          <Link
            to="/board"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al tablero
          </Link>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-accent-teal/10 text-accent-teal'
                    : 'text-text-muted hover:bg-surface hover:text-text-primary'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl">
        {tab === 'users' ? <AdminUsersPanel /> : null}
        {tab === 'analytics' ? <AnalyticsTab /> : null}
        {tab === 'status' ? <StatusTab /> : null}
        {tab === 'errors' ? <ErrorsTab /> : null}
      </main>
    </div>
  );
}

function AnalyticsTab() {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await fetchAdminOverview());
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No pudimos cargar analytics.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-4 p-4 pb-16">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Conteos de producto (tareas, proyectos, círculo, movimientos). No es el analytics de
          bienestar.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>
      {data ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Registrados" value={data.registered} />
          <StatCard label="Online" value={data.online} />
          <StatCard label="Pro" value={data.planCounts.pro} />
          <StatCard label="Free" value={data.planCounts.free} />
          <StatCard label="Tareas" value={totals?.tasks ?? 0} />
          <StatCard label="Proyectos" value={totals?.projects ?? 0} />
          <StatCard label="Contactos" value={totals?.contacts ?? 0} />
          <StatCard label="Movimientos" value={totals?.finance ?? 0} />
        </section>
      ) : (
        <p className="text-sm text-text-muted">{loading ? 'Cargando…' : 'Sin datos.'}</p>
      )}
      {data && !data.storageFromSql ? (
        <p className="text-xs text-text-muted">
          Stats SQL pendientes: pega la migración de admin_user_stats en Supabase.
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StatusTab() {
  const { showToast } = useToast();
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [health, setHealth] = useState<{ supabaseOk: boolean; latencyMs: number | null } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [v, h] = await Promise.all([
        api.publicGet<VersionInfo>('/api/version'),
        fetchAdminHealth(),
      ]);
      setVersion(v);
      setHealth(h);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No pudimos leer el estado.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 pb-16">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">Versión de la API y ping a Supabase (service role).</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Activity className="h-4 w-4 text-accent-teal" />
            API
          </p>
          {version ? (
            <dl className="mt-3 space-y-1 text-sm text-text-muted">
              <div>servicio: {version.service}</div>
              <div>versión: {version.version}</div>
              <div>canal: {version.channel}</div>
              <div>entorno: {version.nodeEnv}</div>
              <div>email: {version.emailConfigured ? 'configurado' : 'no'}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-text-muted">{loading ? 'Cargando…' : 'Sin datos.'}</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Server className="h-4 w-4 text-accent-teal" />
            Supabase
          </p>
          {health ? (
            <p className="mt-3 text-sm text-text-muted">
              {health.supabaseOk ? 'OK' : 'Error'}
              {health.latencyMs != null ? ` · ${health.latencyMs} ms` : ''}
            </p>
          ) : (
            <p className="mt-3 text-sm text-text-muted">{loading ? 'Cargando…' : 'Sin datos.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ErrorsTab() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<AdminErrorLogRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(next?: string | null, append = false) {
    setLoading(true);
    try {
      const payload = await fetchAdminErrors({ limit: 30, cursor: next });
      setRows(prev => (append ? [...prev, ...payload.errors] : payload.errors));
      setCursor(payload.nextCursor);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No pudimos cargar los fallos.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 pb-16">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Logs operativos. Sin IP, sin montos ni secretos. Paginado en SQL.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-semibold">Cuándo</th>
              <th className="px-3 py-2 font-semibold">Severidad</th>
              <th className="px-3 py-2 font-semibold">Operación</th>
              <th className="px-3 py-2 font-semibold">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-text-muted">
                  No hay fallos registrados.
                </td>
              </tr>
            ) : null}
            {rows.map(row => (
              <tr key={row.id} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-3 text-xs text-text-muted">
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-3 text-xs font-medium text-text-primary">
                  {row.severity ?? '—'}
                </td>
                <td className="px-3 py-3 text-xs text-text-muted">{row.operation ?? '—'}</td>
                <td className="px-3 py-3 text-xs text-text-primary">{row.message ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={loading}
          onClick={() => void load(cursor, true)}
        >
          Cargar más
        </Button>
      ) : null}
    </div>
  );
}
