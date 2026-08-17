import { useState } from 'react';
import { Plus, Trash2, Target } from 'lucide-react';
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
  createFinanceGoal,
  deleteFinanceGoal,
  updateFinanceGoal,
} from '@core/services/financeGoalService';
import { summarizeGoalProgress } from '@core/lib/finance';
import type { FinanceAccount, FinanceGoal, FinanceMovement } from '@core/lib/finance';
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

export function GoalsPanel({
  goals,
  accounts,
  movements,
  todayDayId,
  defaultCurrency,
  onChanged,
}: {
  goals: FinanceGoal[];
  accounts: FinanceAccount[];
  movements: FinanceMovement[];
  todayDayId: string;
  defaultCurrency: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    targetAmount: 0,
    notes: '',
    currency: defaultCurrency,
    targetDayId: '',
    linkedAccountId: '',
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      targetAmount: 0,
      notes: '',
      currency: defaultCurrency,
      targetDayId: '',
      linkedAccountId: '',
    });
    setOpen(true);
  }

  function openEdit(goal: FinanceGoal) {
    setEditing(goal);
    setForm({
      name: goal.name,
      targetAmount: goal.targetAmount,
      notes: goal.notes,
      currency: goal.currency,
      targetDayId: goal.targetDayId ?? '',
      linkedAccountId: goal.linkedAccountId ?? '',
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t('fin_goal_name_required'), 'error');
      return;
    }
    if (!(form.targetAmount > 0)) {
      showToast(t('fin_amount_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        targetAmount: form.targetAmount,
        notes: form.notes.trim(),
        currency: form.currency,
        targetDayId: form.targetDayId || null,
        linkedAccountId: form.linkedAccountId || null,
      };
      if (editing) await updateFinanceGoal(editing.id, body);
      else await createFinanceGoal(body);
      showToast(t('fin_goal_saved'), 'success');
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('fin_goal_add')}
        </Button>
      </div>
      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Target className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">{t('fin_goal_empty')}</p>
          <p className="max-w-sm text-xs text-text-muted">{t('fin_goal_empty_hint')}</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {goals.map(goal => {
            const p = summarizeGoalProgress(goal, movements, todayDayId);
            const pct =
              goal.targetAmount > 0
                ? Math.min(100, (p.current / goal.targetAmount) * 100)
                : 0;
            const pace =
              p.monthsLeft != null && p.monthlyNeed != null
                ? t('fin_goal_pace')
                    .replace('{remaining}', money(p.remaining, goal.currency))
                    .replace('{months}', String(p.monthsLeft))
                    .replace('{monthly}', money(p.monthlyNeed, goal.currency))
                : t('fin_goal_remaining').replace(
                    '{remaining}',
                    money(p.remaining, goal.currency)
                  );
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => openEdit(goal)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {goal.name || t('fin_tab_goals')}
                    </span>
                    <span className="text-[10px] tabular-nums text-text-muted">
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">{pace}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-accent-teal"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    {money(p.current, goal.currency)} /{' '}
                    {money(goal.targetAmount, goal.currency)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('fin_goal_edit') : t('fin_goal_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_goal_name')}</span>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_goal_target')}</span>
                <DecimalInput
                  value={form.targetAmount}
                  onChange={v => setForm(f => ({ ...f, targetAmount: v }))}
                  min={0}
                  max={1_000_000_000}
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
              <span>{t('fin_goal_deadline')}</span>
              <Input
                type="date"
                value={form.targetDayId}
                onChange={e =>
                  setForm(f => ({ ...f, targetDayId: e.target.value }))
                }
                className="h-9 text-sm"
              />
            </label>
            {accounts.length > 0 && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_goal_account')}</span>
                <select
                  value={form.linkedAccountId}
                  onChange={e =>
                    setForm(f => ({ ...f, linkedAccountId: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">{t('fin_goal_account_none')}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.type}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_notes')}</span>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm"
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
        title={t('fin_goal_edit')}
        description={t('fin_delete_confirm')}
        confirmLabel={t('action_delete')}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFinanceGoal(deleteTarget.id);
          setDeleteTarget(null);
          await onChanged();
        }}
      />
    </div>
  );
}
