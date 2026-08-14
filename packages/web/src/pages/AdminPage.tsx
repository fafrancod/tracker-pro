import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Crown,
  HardDrive,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isAdminUser, type AdminPlan, type AdminUserRow } from '@core/lib/adminPortal';
import { fetchAdminUsers, setAdminUserPlan } from '@core/services/adminService';
import { SimpleSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMb(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} MB`;
}

export function AdminPage() {
  const { user } = useAuth();
  const allowed = isAdminUser({
    email: user?.email,
    appMetadata: user?.app_metadata as { admin?: unknown } | undefined,
  });

  if (!allowed) {
    return <Navigate to="/board" replace />;
  }

  return (
    <Layout title="Admin" showFab={false}>
      <AdminPanel />
    </Layout>
  );
}

function AdminPanel() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [matched, setMatched] = useState(0);
  const [summary, setSummary] = useState<{
    registered: number;
    online: number;
    planCounts: Record<AdminPlan, number>;
    platformCounts: Record<string, number>;
    totalStorageMb: number | null;
    totals: AdminUserRow['counts'];
  } | null>(null);
  const [storageFromSql, setStorageFromSql] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ user: AdminUserRow; plan: AdminPlan } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchAdminUsers({ search, plan: planFilter });
      setUsers(payload.users);
      setMatched(payload.matched);
      setSummary(payload.summary);
      setStorageFromSql(payload.storageFromSql);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No pudimos cargar el admin.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, showToast]);

  useEffect(() => {
    void refresh();
    // search se aplica con Enter / Actualizar, no en cada tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter]);

  const confirmPlan = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await setAdminUserPlan(pending.user.userId, pending.plan);
      showToast(
        pending.plan === 'pro'
          ? `Plan Pro otorgado a ${pending.user.email}.`
          : `Plan Free aplicado a ${pending.user.email}.`,
        'success'
      );
      setPending(null);
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No pudimos cambiar el plan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cards = useMemo(
    () => [
      { label: 'Registrados', value: summary?.registered ?? '—', icon: Users },
      { label: 'Online', value: summary?.online ?? '—', icon: Wifi, accent: 'text-accent-green' },
      { label: 'Pro', value: summary?.planCounts.pro ?? '—', icon: Crown, accent: 'text-accent-teal' },
      { label: 'Free', value: summary?.planCounts.free ?? '—', icon: ShieldOff },
      {
        label: 'Almacenamiento',
        value: formatMb(summary?.totalStorageMb ?? null),
        icon: HardDrive,
      },
    ],
    [summary]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-teal">
            <Shield className="h-3.5 w-3.5" />
            Atenas
          </p>
          <h1 className="text-xl font-semibold text-text-primary">Panel de administración</h1>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Usuarios, presencia en los últimos 3 minutos, tamaño aproximado de sus datos y plan.
            Visible solo para {`fafrancod@gmail.com`}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                <Icon className={cn('h-3.5 w-3.5', card.accent)} />
                {card.label}
              </p>
              <p className={cn('mt-2 text-2xl font-semibold text-text-primary', card.accent)}>
                {card.value}
              </p>
            </div>
          );
        })}
      </section>

      {summary && (
        <p className="text-xs text-text-muted">
          Totales: {summary.totals.tasks} tareas · {summary.totals.projects} proyectos ·{' '}
          {summary.totals.contacts} contactos · {summary.totals.finance} finanzas
          {!storageFromSql &&
            ' · Tamaño en MB pendiente: ejecuta el SQL de admin_user_stats en Supabase.'}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void refresh();
              }}
              placeholder="Buscar por email, nombre o UID…"
              className="pl-10"
            />
          </div>
          <SimpleSelect
            aria-label="Filtrar por plan"
            value={planFilter}
            onChange={setPlanFilter}
            className="w-full lg:w-40"
            options={[
              { value: 'all', label: 'Todos los planes' },
              { value: 'pro', label: 'Pro' },
              { value: 'free', label: 'Free' },
            ]}
          />
        </div>

        <p className="mb-2 text-xs text-text-muted">
          {matched} usuario{matched === 1 ? '' : 's'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2 font-semibold">Usuario</th>
                <th className="px-2 py-2 font-semibold">Plan</th>
                <th className="px-2 py-2 font-semibold">Estado</th>
                <th className="px-2 py-2 font-semibold">Visto</th>
                <th className="px-2 py-2 font-semibold">Tareas</th>
                <th className="px-2 py-2 font-semibold">Tamaño</th>
                <th className="px-2 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-sm text-text-muted">
                    No hay usuarios con ese filtro.
                  </td>
                </tr>
              )}
              {users.map(user => (
                <tr key={user.userId} className="border-b border-border/70 last:border-0">
                  <td className="px-2 py-3">
                    <p className="font-medium text-text-primary">{user.name || '—'}</p>
                    <p className="text-xs text-text-muted">{user.email}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                      {user.lastPlatform === 'native' ? (
                        <Smartphone className="h-3 w-3" />
                      ) : (
                        <Monitor className="h-3 w-3" />
                      )}
                      {user.lastPlatform === 'native' ? 'Android' : user.lastPlatform === 'web' ? 'Web' : '—'}
                      {user.lastAppVersion ? ` · v${user.lastAppVersion}` : ''}
                      {user.lastPath ? ` · ${user.lastPath}` : ''}
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={user.plan === 'pro' ? 'teal' : 'outline'}>
                      {user.plan === 'pro' ? 'Pro' : 'Free'}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    {user.online ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-green">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                        Online
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">Offline</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-xs text-text-muted">{formatDate(user.lastSeenAt)}</td>
                  <td className="px-2 py-3 text-xs text-text-muted">
                    {user.counts.tasks}
                    <span className="block text-[10px]">
                      {user.counts.projects} proy. · {user.counts.contacts} circ.
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs font-medium text-text-primary">
                    {formatMb(user.storageMb)}
                  </td>
                  <td className="px-2 py-3">
                    {user.plan === 'pro' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPending({ user, plan: 'free' })}
                      >
                        Pasar a Free
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setPending({ user, plan: 'pro' })}
                      >
                        Dar Pro
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={pending?.plan === 'pro' ? 'Otorgar plan Pro' : 'Quitar plan Pro'}
        description={
          pending
            ? pending.plan === 'pro'
              ? `¿Dar plan Pro a ${pending.user.email}?`
              : `¿Dejar a ${pending.user.email} en plan Free?`
            : ''
        }
        confirmLabel={pending?.plan === 'pro' ? 'Dar Pro' : 'Pasar a Free'}
        variant={pending?.plan === 'free' ? 'warning' : 'default'}
        loading={saving}
        onConfirm={() => void confirmPlan()}
      />
    </div>
  );
}
