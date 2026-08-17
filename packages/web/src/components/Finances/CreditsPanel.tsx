import { useMemo, useState } from 'react';
import { Plus, Trash2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { ApiClientError } from '@core/lib/api';
import {
  createFinanceCredit,
  deleteFinanceCredit,
  updateFinanceCredit,
} from '@core/services/financeCreditService';
import {
  simulateExtraPayment,
  summarizeCreditProgress,
} from '@core/lib/finance';
import type {
  FinanceCredit,
  FinanceCreditKind,
  FinanceMovement,
} from '@core/lib/finance';
import { SUPPORTED_CURRENCIES } from '@core/lib/currencies';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${currency}`;
  }
}

const KINDS: FinanceCreditKind[] = ['consumer', 'mortgage', 'auto', 'other'];

export function CreditsPanel({
  credits,
  movements,
  todayDayId,
  defaultCurrency,
  onChanged,
}: {
  credits: FinanceCredit[];
  movements: FinanceMovement[];
  todayDayId: string;
  defaultCurrency: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCredit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceCredit | null>(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(0);
  const [simMode, setSimMode] = useState<'term' | 'installment'>('term');
  const [form, setForm] = useState({
    name: '',
    principal: 0,
    monthlyInstallment: 0,
    dueDay: 5,
    startDayId: todayDayId,
    termMonths: 12,
    currency: defaultCurrency,
    kind: 'consumer' as FinanceCreditKind,
    notes: '',
  });

  function kindLabel(kind: FinanceCreditKind): string {
    if (kind === 'mortgage') return t('fin_credit_kind_mortgage');
    if (kind === 'auto') return t('fin_credit_kind_auto');
    if (kind === 'consumer') return t('fin_credit_kind_consumer');
    return t('fin_credit_kind_other');
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      principal: 0,
      monthlyInstallment: 0,
      dueDay: 5,
      startDayId: todayDayId,
      termMonths: 12,
      currency: defaultCurrency,
      kind: 'consumer',
      notes: '',
    });
    setOpen(true);
  }

  function openEdit(credit: FinanceCredit) {
    setEditing(credit);
    setForm({
      name: credit.name,
      principal: credit.principal,
      monthlyInstallment: credit.monthlyInstallment,
      dueDay: credit.dueDay,
      startDayId: credit.startDayId,
      termMonths: credit.termMonths,
      currency: credit.currency,
      kind: credit.kind,
      notes: credit.notes,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t('fin_credit_name_required'), 'error');
      return;
    }
    if (!(form.monthlyInstallment > 0)) {
      showToast(t('fin_amount_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        principal: form.principal,
        monthlyInstallment: form.monthlyInstallment,
        dueDay: form.dueDay,
        startDayId: form.startDayId,
        termMonths: form.termMonths,
        currency: form.currency,
        kind: form.kind,
        notes: form.notes.trim(),
      };
      if (editing) await updateFinanceCredit(editing.id, body);
      else await createFinanceCredit(body);
      showToast(t('fin_credit_saved'), 'success');
      setOpen(false);
      await onChanged();
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST|finance_/i.test(err.message)
          ? t('fin_sql_needed')
          : t('fin_save_error');
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  const simTarget = editing ?? credits[0] ?? null;
  const simProgress = simTarget
    ? summarizeCreditProgress(simTarget, movements)
    : null;
  const sim = useMemo(() => {
    if (!simTarget || !simProgress || extra <= 0) return null;
    return simulateExtraPayment({
      monthlyInstallment: simTarget.monthlyInstallment,
      remainingCount: simProgress.remainingCount,
      extraAmount: extra,
      mode: simMode,
    });
  }, [simTarget, simProgress, extra, simMode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('fin_credit_add')}
        </Button>
      </div>
      {credits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Landmark className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_credit_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">{t('fin_credit_empty_hint')}</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {credits.map(credit => {
            const p = summarizeCreditProgress(credit, movements);
            return (
              <li key={credit.id}>
                <button
                  type="button"
                  onClick={() => openEdit(credit)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {credit.name}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-text-muted">
                      {kindLabel(credit.kind)}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {t('fin_credit_progress')
                      .replace('{paid}', String(p.paidCount))
                      .replace('{total}', String(credit.termMonths))}
                  </p>
                  <p className="text-[11px] tabular-nums text-text-primary">
                    {money(credit.monthlyInstallment, credit.currency)}
                    {t('fin_credit_per_month')}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {t('fin_credit_due_day')} {credit.dueDay}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {simTarget && simProgress && simProgress.remainingCount > 0 && (
        <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
          <p className="text-xs font-semibold text-text-primary">
            {t('fin_credit_sim_title')}
          </p>
          <div className="flex gap-1">
            {(['term', 'installment'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setSimMode(mode)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  simMode === mode
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                    : 'border-border text-text-muted'
                }`}
              >
                {mode === 'term'
                  ? t('fin_credit_sim_term')
                  : t('fin_credit_sim_cuota')}
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-xs text-text-muted">
            <span>{t('fin_credit_sim_extra')}</span>
            <DecimalInput
              value={extra}
              onChange={setExtra}
              min={0}
              max={1_000_000_000}
              className="h-9 text-sm"
            />
          </label>
          {sim && extra > 0 && (
            <p className="text-[11px] text-text-primary">
              {simMode === 'term'
                ? t('fin_credit_sim_term_result').replace(
                    '{months}',
                    String(sim.savedMonths)
                  )
                : t('fin_credit_sim_cuota_result').replace(
                    '{amount}',
                    money(sim.newInstallment, simTarget.currency)
                  )}
            </p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('fin_credit_edit') : t('fin_credit_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_credit_name')}</span>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_credit_principal')}</span>
                <DecimalInput
                  value={form.principal}
                  onChange={v => setForm(f => ({ ...f, principal: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_credit_cuota')}</span>
                <DecimalInput
                  value={form.monthlyInstallment}
                  onChange={v =>
                    setForm(f => ({ ...f, monthlyInstallment: v }))
                  }
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_credit_term')}</span>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={form.termMonths}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      termMonths: Number(e.target.value) || 1,
                    }))
                  }
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_credit_due_day')}</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dueDay}
                  onChange={e =>
                    setForm(f => ({ ...f, dueDay: Number(e.target.value) || 1 }))
                  }
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_currency')}</span>
                <select
                  value={form.currency}
                  onChange={e =>
                    setForm(f => ({ ...f, currency: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_credit_kind')}</span>
              <select
                value={form.kind}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    kind: e.target.value as FinanceCreditKind,
                  }))
                }
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {KINDS.map(kind => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_date')}</span>
              <Input
                type="date"
                value={form.startDayId}
                onChange={e =>
                  setForm(f => ({ ...f, startDayId: e.target.value }))
                }
                className="h-9 text-sm"
              />
            </label>
            <div className="flex justify-between pt-1">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-accent-red"
                  onClick={() => {
                    setDeleteTarget(editing);
                    setOpen(false);
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t('action_delete')}
                </Button>
              ) : (
                <span />
              )}
              <Button disabled={busy} type="button" onClick={() => void handleSave()}>
                {t('action_save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={openNow => {
          if (!openNow) setDeleteTarget(null);
        }}
        title={t('fin_credit_edit')}
        description={t('fin_delete_confirm')}
        confirmLabel={t('action_delete')}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFinanceCredit(deleteTarget.id);
          setDeleteTarget(null);
          await onChanged();
        }}
      />
    </div>
  );
}
