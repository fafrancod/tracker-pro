import { useMemo, useState } from 'react';
import { Plus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  createFinanceMerchant,
  deleteFinanceMerchant,
  updateFinanceMerchant,
} from '@core/services/financeMerchantService';
import {
  merchantSpendFromDayId,
  rankMerchantsBySpend,
  summarizeMerchantSpend,
  type FinanceMerchant,
  type FinanceMovement,
  type FinanceUserCategory,
} from '@core/lib/finance';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
      maximumFractionDigits: currency === 'CLP' || currency === 'JPY' ? 0 : 2,
    }).format(n);
  } catch {
    return `$ ${n.toFixed(0)}`;
  }
}

const PALETTE = [
  '#0ea5e9',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#16a34a',
  '#64748b',
];

export function MerchantsPanel({
  merchants,
  movements,
  categories,
  todayDayId,
  reportingCurrency,
  onSaved,
  onChanged,
}: {
  merchants: FinanceMerchant[];
  movements: FinanceMovement[];
  categories: FinanceUserCategory[];
  todayDayId: string;
  reportingCurrency: string;
  onSaved?: (merchant: FinanceMerchant) => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const [monthsBack, setMonthsBack] = useState<1 | 2>(2);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceMerchant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceMerchant | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', notes: '', color: '#0ea5e9' });

  const fromDayId = merchantSpendFromDayId(todayDayId, monthsBack);
  const spend = useMemo(
    () =>
      summarizeMerchantSpend(movements, {
        fromDayId,
        toDayId: todayDayId,
        reportingCurrency,
      }),
    [movements, fromDayId, todayDayId, reportingCurrency]
  );
  const ranked = useMemo(
    () => rankMerchantsBySpend(merchants, spend),
    [merchants, spend]
  );

  function categoryLabel(categoryId: string | null, groupKey: string): string {
    const custom = categoryId
      ? categories.find(c => c.id === categoryId)
      : undefined;
    if (custom?.name) return custom.name;
    return t(`fin_cat_${groupKey}` as 'fin_cat_other');
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', notes: '', color: '#0ea5e9' });
    setOpen(true);
  }

  function openEdit(merchant: FinanceMerchant) {
    setEditing(merchant);
    setForm({
      name: merchant.name,
      notes: merchant.notes,
      color: merchant.color,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t('fin_merchant_name_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        notes: form.notes.trim(),
        color: form.color,
      };
      const saved = editing
        ? await updateFinanceMerchant(editing.id, body)
        : await createFinanceMerchant(body);
      onSaved?.(saved);
      showToast(t('fin_merchant_saved'), 'success');
      setOpen(false);
      void onChanged().catch(() => undefined);
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST204|SQL de finanzas|finance_merchants/i.test(
          err.message
        )
          ? t('fin_merchant_sql_needed')
          : t('fin_save_error');
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {([1, 2] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setMonthsBack(n)}
              className={
                monthsBack === n
                  ? 'rounded-full border border-accent-teal bg-accent-teal/10 px-3 py-1 text-xs text-accent-teal'
                  : 'rounded-full border border-border px-3 py-1 text-xs text-text-muted'
              }
            >
              {n === 1 ? t('fin_merchant_window_month') : t('fin_merchant_window_3m')}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('fin_merchant_add')}
        </Button>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Store className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_merchant_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">
            {t('fin_merchant_empty_hint')}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {ranked.map(merchant => (
            <li key={merchant.id}>
              <button
                type="button"
                onClick={() => openEdit(merchant)}
                className="flex w-full flex-col gap-1.5 rounded-xl border border-border bg-surface p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: merchant.color }}
                    />
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {merchant.name}
                    </span>
                  </span>
                  <strong className="shrink-0 text-sm tabular-nums text-text-primary">
                    {money(merchant.spend.total, reportingCurrency)}
                  </strong>
                </div>
                <p className="text-[11px] text-text-muted">
                  {t('fin_merchant_count').replace(
                    '{n}',
                    String(merchant.spend.count)
                  )}
                </p>
                {merchant.spend.byCategory.length > 0 ? (
                  <ul className="space-y-0.5">
                    {merchant.spend.byCategory.slice(0, 4).map(slice => (
                      <li
                        key={`${slice.categoryId ?? slice.groupKey}`}
                        className="flex justify-between gap-2 text-[11px] text-text-muted"
                      >
                        <span className="truncate">
                          {categoryLabel(slice.categoryId, slice.groupKey)}
                        </span>
                        <span className="tabular-nums">
                          {money(slice.amount, reportingCurrency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-text-muted">
                    {t('fin_merchant_no_spend')}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('fin_merchant_edit') : t('fin_merchant_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_merchant_name')}</span>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_merchant_notes')}</span>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className="h-6 w-6 rounded-full border border-border"
                  style={{
                    backgroundColor: color,
                    outline:
                      form.color === color ? '2px solid var(--color-accent-teal)' : undefined,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2">
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
              <Button type="button" onClick={() => void handleSave()} disabled={busy}>
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
        title={t('fin_merchant_delete_title')}
        description={t('fin_merchant_delete_hint')}
        confirmLabel={t('action_delete')}
        loading={busy}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setBusy(true);
          try {
            await deleteFinanceMerchant(deleteTarget.id);
            showToast(t('fin_merchant_deleted'), 'info');
            setDeleteTarget(null);
            await onChanged();
          } catch {
            showToast(t('fin_save_error'), 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
