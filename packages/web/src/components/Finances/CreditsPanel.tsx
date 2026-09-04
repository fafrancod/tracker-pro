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
import { CurrencySelect } from '@/components/Finances/CurrencySelect';

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

  function openCreate(kind: FinanceCreditKind = 'consumer') {
    setEditing(null);
    setForm({
      name: '',
      principal: 0,
      monthlyInstallment: 0,
      dueDay: 5,
      startDayId: todayDayId,
      termMonths: kind === 'mortgage' ? 240 : 12,
      currency: defaultCurrency,
      kind,
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

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const consumer = credits.filter(c => c.kind === 'consumer');
  const mortgage = credits.filter(c => c.kind === 'mortgage');
  const other = credits.filter(
    c => c.kind !== 'consumer' && c.kind !== 'mortgage'
  );

  function renderCredit(credit: FinanceCredit) {
    const p = summarizeCreditProgress(credit, movements);
    const history = movements
      .filter(
        m => m.creditId === credit.id && m.status !== 'skipped' && m.flow === 'expense'
      )
      .slice()
      .sort((a, b) => b.dayId.localeCompare(a.dayId));
    const expanded = expandedId === credit.id;
    return (
      <li key={credit.id} className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => {
            setExpandedId(expanded ? null : credit.id);
          }}
          className="flex w-full flex-col gap-1 p-3 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {credit.name}
            </span>
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-text-muted">
                {kindLabel(credit.kind)}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  openEdit(credit);
                }}
                className="rounded-md px-1.5 py-0.5 text-[10px] text-accent-teal"
              >
                {t('fin_credit_edit')}
              </span>
            </span>
          </div>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {t('fin_credit_remaining').replace(
              '{amount}',
              money(p.remainingPrincipal, credit.currency)
            )}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-accent-teal"
              style={{ width: `${p.paidPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-text-muted">
            {t('fin_credit_amortized')} {p.paidPercentage.toFixed(0)}%
            {' · '}
            {t('fin_credit_paid')} {money(p.actualPaid, credit.currency)}
            {' · '}
            {t('fin_credit_pending')} {money(p.remainingPrincipal, credit.currency)}
          </p>
          <p className="text-[11px] text-text-muted">
            {t('fin_credit_remaining_months').replace(
              '{count}',
              String(p.remainingCount)
            )}
            {' · '}
            {t('fin_credit_progress')
              .replace('{paid}', String(p.paidCount))
              .replace('{total}', String(credit.termMonths))}
          </p>
          <p className="text-[11px] tabular-nums text-text-primary">
            {money(credit.monthlyInstallment, credit.currency)}
            {t('fin_credit_per_month')}
          </p>
        </button>
        {expanded && history.length > 0 ? (
          <ul className="space-y-1 border-t border-border px-3 py-2">
            <li className="text-[10px] font-semibold uppercase text-text-muted">
              {t('fin_credit_history')}
            </li>
            {history.slice(0, 12).map(mov => (
              <li
                key={mov.id}
                className="flex justify-between text-[11px] text-text-primary"
              >
                <span>
                  {mov.dayId} · {mov.title}
                </span>
                <span className="tabular-nums">
                  {money(mov.amount, mov.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  function section(
    title: string,
    list: FinanceCredit[],
    kind: FinanceCreditKind
  ) {
    return (
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <Button size="sm" variant="outline" onClick={() => openCreate(kind)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('fin_credit_add')}
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
            {t('fin_credit_empty_section')}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">{list.map(renderCredit)}</ul>
        )}
      </section>
    );
  }

  const totals = credits.reduce(
    (acc, credit) => {
      const p = summarizeCreditProgress(credit, movements);
      acc.committed += p.expectedTotal;
      acc.paid += p.actualPaid;
      acc.remaining += p.remainingPrincipal;
      acc.monthly += credit.monthlyInstallment;
      return acc;
    },
    { committed: 0, paid: 0, remaining: 0, monthly: 0 }
  );
  const incomeMonths = new Map<string, number>();
  for (const mov of movements) {
    if (mov.flow !== 'income' || mov.status === 'skipped') continue;
    const key = mov.dayId.slice(0, 7);
    incomeMonths.set(key, (incomeMonths.get(key) ?? 0) + (Number(mov.amount) || 0));
  }
  const avgIncome =
    incomeMonths.size > 0
      ? [...incomeMonths.values()].reduce((a, b) => a + b, 0) / incomeMonths.size
      : 0;
  const dti = avgIncome > 0 ? (totals.monthly / avgIncome) * 100 : 0;
  const dtiCurrency = credits[0]?.currency ?? defaultCurrency;

  return (
    <div className="flex flex-col gap-5">
      {credits.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase text-text-muted">
              {t('fin_credit_committed')}
            </p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {money(totals.committed, dtiCurrency)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase text-text-muted">
              {t('fin_credit_monthly_load')}
            </p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {money(totals.monthly, dtiCurrency)}
              {t('fin_credit_per_month')}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase text-text-muted">
              {t('fin_credit_pending')}
            </p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {money(totals.remaining, dtiCurrency)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] uppercase text-text-muted">
              {t('fin_credit_dti')}
            </p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">
              {avgIncome > 0 ? `${dti.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>
      ) : null}
      {credits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Landmark className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_credit_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">{t('fin_credit_empty_hint')}</p>
        </div>
      ) : null}
      {section(t('fin_credit_section_consumer'), consumer, 'consumer')}
      {section(t('fin_credit_section_mortgage'), mortgage, 'mortgage')}
      {other.length > 0
        ? section(t('fin_credit_section_other'), other, 'other')
        : null}

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
                <CurrencySelect
                  value={form.currency}
                  onChange={code => setForm(f => ({ ...f, currency: code }))}
                />
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
