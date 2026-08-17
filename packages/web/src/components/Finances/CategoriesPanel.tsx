import { useState } from 'react';
import { Plus, Trash2, Tags } from 'lucide-react';
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
  createFinanceCategory,
  deleteFinanceCategory,
  updateFinanceCategory,
} from '@core/services/financeCategoryService';
import {
  DEFAULT_CATEGORY_COLORS,
  FINANCE_CATEGORIES,
  summarizeCategoryBudget,
  type FinanceCategory,
  type FinanceMovement,
  type FinanceUserCategory,
} from '@core/lib/finance';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
      maximumFractionDigits: currency === 'CLP' ? 0 : 2,
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
  '#64748b',
  '#94a3b8',
];

export function CategoriesPanel({
  categories,
  movements,
  monthId,
  defaultCurrency,
  onChanged,
}: {
  categories: FinanceUserCategory[];
  movements: FinanceMovement[];
  monthId: string;
  defaultCurrency: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceUserCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceUserCategory | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    groupKey: 'other' as FinanceCategory,
    color: '#94a3b8',
    monthlyBudget: 0,
    necessary: true,
    currency: defaultCurrency,
  });

  function groupLabel(key: FinanceCategory): string {
    return t(`fin_cat_${key}` as 'fin_cat_other');
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      groupKey: 'other',
      color: '#94a3b8',
      monthlyBudget: 0,
      necessary: true,
      currency: defaultCurrency,
    });
    setOpen(true);
  }

  function openEdit(cat: FinanceUserCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      groupKey: cat.groupKey,
      color: cat.color,
      monthlyBudget: cat.monthlyBudget,
      necessary: cat.necessary,
      currency: cat.currency,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t('fin_cat_name_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        groupKey: form.groupKey,
        color: form.color,
        monthlyBudget: form.monthlyBudget,
        necessary: form.necessary,
        currency: form.currency,
      };
      if (editing) await updateFinanceCategory(editing.id, body);
      else await createFinanceCategory(body);
      showToast(t('fin_cat_saved'), 'success');
      setOpen(false);
      await onChanged();
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST204|SQL de finanzas|finance_categories/i.test(
          err.message
        )
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
          {t('fin_cat_add')}
        </Button>
      </div>
      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Tags className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_cat_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">{t('fin_cat_empty_hint')}</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {categories.map(cat => {
            const p = summarizeCategoryBudget(cat, movements, monthId);
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  className="flex w-full flex-col gap-1.5 rounded-xl border border-border bg-surface p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {cat.name || groupLabel(cat.groupKey)}
                      </span>
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {groupLabel(cat.groupKey)}
                    </span>
                  </div>
                  {p.limit > 0 ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className={
                            p.pct >= 100
                              ? 'h-full bg-accent-red'
                              : p.pct >= 80
                                ? 'h-full bg-amber-500'
                                : 'h-full bg-accent-teal'
                          }
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] tabular-nums text-text-muted">
                        {money(p.spent, cat.currency)} / {money(p.limit, cat.currency)}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-text-muted">
                      {t('fin_cat_no_budget')}
                      {p.spent > 0
                        ? ` · ${money(p.spent, cat.currency)}`
                        : ''}
                    </p>
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
              {editing ? t('fin_cat_edit') : t('fin_cat_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_cat_name')}</span>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_cat_group')}</span>
                <select
                  value={form.groupKey}
                  onChange={e => {
                    const groupKey = e.target.value as FinanceCategory;
                    setForm(f => ({
                      ...f,
                      groupKey,
                      color: DEFAULT_CATEGORY_COLORS[groupKey] || f.color,
                      necessary: groupKey !== 'leisure',
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {FINANCE_CATEGORIES.map(key => (
                    <option key={key} value={key}>
                      {groupLabel(key)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_cat_budget')}</span>
                <DecimalInput
                  prefix="$"
                  value={form.monthlyBudget}
                  onChange={v => setForm(f => ({ ...f, monthlyBudget: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
            </div>
            <div>
              <p className="mb-1 text-xs text-text-muted">{t('fin_cat_color')}</p>
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
                        form.color === color ? '2px solid currentColor' : undefined,
                    }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={form.necessary}
                onChange={e =>
                  setForm(f => ({ ...f, necessary: e.target.checked }))
                }
              />
              {t('fin_cat_necessary')}
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
              <Button type="button" disabled={busy} onClick={() => void handleSave()}>
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
        title={t('fin_cat_edit')}
        description={t('fin_delete_confirm')}
        confirmLabel={t('action_delete')}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFinanceCategory(deleteTarget.id);
          setDeleteTarget(null);
          await onChanged();
        }}
      />
    </div>
  );
}
