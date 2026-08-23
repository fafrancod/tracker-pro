import { useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { ApiClientError } from '@core/lib/api';
import {
  createFinanceAccount,
  deleteFinanceAccount,
  updateFinanceAccount,
} from '@core/services/financeAccountService';
import { paymentMethodRequiresBank, summarizeCardUsage } from '@core/lib/finance';
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceMovement,
} from '@core/lib/finance';
import { SUPPORTED_CURRENCIES } from '@core/lib/currencies';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const TYPES: FinanceAccountType[] = [
  'cash',
  'debit',
  'credit',
  'brokerage',
  'other',
];

export function AccountsPanel({
  accounts,
  movements,
  defaultCurrency,
  onChanged,
}: {
  accounts: FinanceAccount[];
  movements: FinanceMovement[];
  defaultCurrency?: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    institution: '',
    type: 'debit' as FinanceAccountType,
    currency: 'EUR',
    creditLimit: 0,
  });

  function typeLabel(type: FinanceAccountType): string {
    if (type === 'cash') return t('fin_account_type_cash');
    if (type === 'debit') return t('fin_account_type_debit');
    if (type === 'credit') return t('fin_account_type_credit');
    if (type === 'brokerage') return t('fin_account_type_brokerage');
    return t('fin_account_type_other');
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      institution: '',
      type: 'debit',
      currency: accounts[0]?.currency ?? defaultCurrency ?? 'CLP',
      creditLimit: 0,
    });
    setOpen(true);
  }

  function openEdit(acc: FinanceAccount) {
    setEditing(acc);
    setForm({
      name: acc.name,
      institution: acc.institution,
      type: acc.type,
      currency: acc.currency,
      creditLimit: acc.creditLimit,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t('fin_account_name_required'), 'error');
      return;
    }
    if (paymentMethodRequiresBank(form.type) && !form.institution.trim()) {
      showToast(t('fin_account_bank_required'), 'error');
      return;
    }
    const institution = paymentMethodRequiresBank(form.type)
      ? form.institution.trim()
      : '';
    setBusy(true);
    try {
      if (editing) {
        await updateFinanceAccount(editing.id, {
          name: form.name.trim(),
          institution,
          type: form.type,
          currency: form.currency,
          creditLimit: form.type === 'credit' ? form.creditLimit : 0,
        });
      } else {
        await createFinanceAccount({
          name: form.name.trim(),
          institution,
          type: form.type,
          currency: form.currency,
          creditLimit: form.type === 'credit' ? form.creditLimit : 0,
        });
      }
      showToast(t('fin_account_saved'), 'success');
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
          {t('fin_account_add')}
        </Button>
      </div>
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Wallet className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_account_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">
            {t('fin_account_empty_hint')}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {accounts.map(acc => {
            const usage =
              acc.type === 'credit' ? summarizeCardUsage(acc, movements) : null;
            return (
              <li key={acc.id}>
                <button
                  type="button"
                  onClick={() => openEdit(acc)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {acc.name || t('task_money_pill')}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-text-muted">
                      {typeLabel(acc.type)}
                    </span>
                  </div>
                  {acc.institution ? (
                    <p className="truncate text-[11px] text-text-muted">
                      {acc.institution}
                    </p>
                  ) : null}
                  {usage && acc.creditLimit > 0 ? (
                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">{t('fin_account_used')}</span>
                        <span className="tabular-nums text-text-primary">
                          {money(usage.used, acc.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">
                          {t('fin_account_available')}
                        </span>
                        <span
                          className={cn(
                            'tabular-nums',
                            (usage.available ?? 0) < 0
                              ? 'text-accent-red'
                              : 'text-accent-green'
                          )}
                        >
                          {money(usage.available ?? 0, acc.currency)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-accent-teal"
                          style={{
                            width: `${Math.min(
                              100,
                              acc.creditLimit > 0
                                ? (usage.used / acc.creditLimit) * 100
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-text-muted">
                        {t('fin_account_limit')}: {money(acc.creditLimit, acc.currency)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted">{acc.currency}</p>
                  )}
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
              {editing ? t('fin_account_edit') : t('fin_account_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_account_name')}</span>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_account_type')}</span>
                <select
                  value={form.type}
                  onChange={e => {
                    const type = e.target.value as FinanceAccountType;
                    setForm(f => ({
                      ...f,
                      type,
                      institution: paymentMethodRequiresBank(type)
                        ? f.institution
                        : '',
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {TYPES.map(type => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
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
            {paymentMethodRequiresBank(form.type) ? (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_account_bank')}</span>
                <Input
                  value={form.institution}
                  onChange={e =>
                    setForm(f => ({ ...f, institution: e.target.value }))
                  }
                  className="h-9 text-sm"
                  placeholder={t('fin_account_bank_hint')}
                />
              </label>
            ) : null}
            {form.type === 'credit' && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_account_limit')}</span>
                <DecimalInput
                  value={form.creditLimit}
                  onChange={v => setForm(f => ({ ...f, creditLimit: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
            )}
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
        title={t('fin_account_edit')}
        description={t('fin_delete_confirm')}
        confirmLabel={t('action_delete')}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFinanceAccount(deleteTarget.id);
          setDeleteTarget(null);
          await onChanged();
        }}
      />
    </div>
  );
}
