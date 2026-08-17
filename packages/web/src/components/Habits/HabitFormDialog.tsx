import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import type { TKey } from '@/lib/i18n';
import { defaultHabitColor, type HabitKind } from '@core/lib/habits';
import { habitPlanMode, uniqueSortedDayIds } from '@core/lib/habitPlan';
import type { RecurrenceFrequency } from '@core/types';
import type { HabitSeriesSummary } from '@core/lib/habitPlan';

export type HabitPlanUi = 'daily' | 'weekdays' | 'every_n' | 'monthly' | 'specific';

export interface HabitFormValue {
  title: string;
  kind: HabitKind;
  notes: string;
  color: string;
  pomodoroTarget: number;
  startDayId: string;
  planUi: HabitPlanUi;
  interval: number;
  weekdays: number[];
  specificDayIds: string[];
}

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const COLOR_PRESETS = ['#3fb950', '#58a6ff', '#a371f7', '#f85149', '#d29922', '#39d0d8'];

function isoToFinKey(iso: number): TKey {
  return `fin_weekday_${iso === 7 ? 0 : iso}` as TKey;
}

function planUiFromSeries(series: HabitSeriesSummary): HabitPlanUi {
  if (habitPlanMode(series.recurrence) === 'specific') return 'specific';
  const wd = series.recurrence.weekdays;
  if (wd && wd.length > 0) return 'weekdays';
  if (series.recurrence.frequency === 'monthly') return 'monthly';
  if (series.recurrence.frequency === 'daily' && series.recurrence.interval > 1) {
    return 'every_n';
  }
  return 'daily';
}

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayId: string;
  initial?: HabitSeriesSummary | null;
  onSubmit: (value: HabitFormValue) => Promise<void>;
}

export function HabitFormDialog({
  open,
  onOpenChange,
  todayId,
  initial,
  onSubmit,
}: HabitFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<HabitKind>('habit_good');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(defaultHabitColor('habit_good'));
  const [pomodoroTarget, setPomodoroTarget] = useState(0);
  const [startDayId, setStartDayId] = useState(todayId);
  const [planUi, setPlanUi] = useState<HabitPlanUi>('daily');
  const [interval, setInterval] = useState(2);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [specificDayIds, setSpecificDayIds] = useState<string[]>([]);
  const [dateDraft, setDateDraft] = useState(todayId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextKind = initial?.kind ?? 'habit_good';
    setTitle(initial?.title ?? '');
    setKind(nextKind);
    setNotes(initial?.notes ?? '');
    setColor(initial?.color ?? defaultHabitColor(nextKind));
    setPomodoroTarget(initial?.pomodoroTarget ?? 0);
    setStartDayId(initial?.startDayId ?? todayId);
    const ui = initial ? planUiFromSeries(initial) : 'daily';
    setPlanUi(ui);
    setInterval(Math.max(2, initial?.recurrence.interval ?? 2));
    setWeekdays(
      initial?.recurrence.weekdays && initial.recurrence.weekdays.length > 0
        ? [...initial.recurrence.weekdays]
        : [1, 2, 3, 4, 5]
    );
    setSpecificDayIds(
      ui === 'specific' ? initial?.instances.map(i => i.dayId) ?? [] : []
    );
    setDateDraft(todayId);
    setSubmitting(false);
  }, [open, initial, todayId]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (planUi === 'weekdays' && weekdays.length === 0) return false;
    if (planUi === 'specific' && specificDayIds.length === 0) return false;
    return true;
  }, [title, planUi, weekdays, specificDayIds]);

  function toggleWeekday(iso: number) {
    setWeekdays(prev =>
      prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort((a, b) => a - b)
    );
  }

  function addSpecificDay() {
    const next = uniqueSortedDayIds([...specificDayIds, dateDraft]);
    setSpecificDayIds(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        kind,
        notes: notes.trim(),
        color,
        pomodoroTarget,
        startDayId,
        planUi,
        interval: Math.max(2, Math.min(365, interval)),
        weekdays,
        specificDayIds: uniqueSortedDayIds(specificDayIds),
      });
      onOpenChange(false);
    } catch {
      setSubmitting(false);
    }
  }

  const planOptions: Array<{ id: HabitPlanUi; label: TKey }> = [
    { id: 'daily', label: 'habits_plan_every_day' },
    { id: 'weekdays', label: 'habits_plan_weekdays' },
    { id: 'every_n', label: 'habits_plan_every_n' },
    { id: 'monthly', label: 'habits_plan_monthly' },
    { id: 'specific', label: 'habits_plan_specific' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('habits_edit') : t('habits_create')}</DialogTitle>
            <DialogDescription>{t('habits_form_desc')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-text-muted">
              {t('habits_name')}
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={
                  kind === 'habit_quit'
                    ? t('habits_name_ph_quit')
                    : t('habits_name_ph_good')
                }
                maxLength={280}
                autoFocus
              />
            </label>

            <div className="grid gap-1 text-xs text-text-muted">
              {t('habits_kind')}
              <div className="flex gap-2">
                {(['habit_good', 'habit_quit'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setKind(k);
                      if (!initial) setColor(defaultHabitColor(k));
                    }}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-medium',
                      kind === k
                        ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                        : 'border-border text-text-muted'
                    )}
                  >
                    {t(k === 'habit_good' ? 'habit_badge_good' : 'habit_badge_quit')}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-1 text-xs text-text-muted">
              {t('habits_notes')}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('habits_notes_ph')}
                rows={2}
                className="rounded-md border border-border bg-field px-3 py-2 text-sm text-text-primary"
              />
            </label>

            <div className="grid gap-1 text-xs text-text-muted">
              {t('habits_color')}
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-full ring-offset-2 ring-offset-surface',
                      color === c && 'ring-2 ring-accent-teal'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-border bg-field"
                />
              </div>
            </div>

            <label className="grid gap-1 text-xs text-text-muted">
              {t('habit_pomo_plan')}
              <Input
                type="number"
                min={0}
                max={24}
                value={pomodoroTarget}
                onChange={e => setPomodoroTarget(Number(e.target.value) || 0)}
              />
              <span className="text-[11px]">{t('habit_pomo_plan_hint')}</span>
            </label>

            <label className="grid gap-1 text-xs text-text-muted">
              {t('habits_start')}
              <Input
                type="date"
                value={startDayId}
                onChange={e => setStartDayId(e.target.value)}
                disabled={isEdit}
              />
            </label>

            <div className="grid gap-2">
              <p className="text-xs font-medium text-text-primary">{t('habits_plan')}</p>
              <div className="flex flex-wrap gap-1.5">
                {planOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPlanUi(opt.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px]',
                      planUi === opt.id
                        ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                        : 'border-border text-text-muted'
                    )}
                  >
                    {t(opt.label)}
                  </button>
                ))}
              </div>

              {planUi === 'weekdays' && (
                <div className="flex flex-wrap gap-1.5">
                  {ISO_WEEKDAYS.map(iso => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => toggleWeekday(iso)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[11px]',
                        weekdays.includes(iso)
                          ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                          : 'border-border text-text-muted'
                      )}
                    >
                      {t(isoToFinKey(iso))}
                    </button>
                  ))}
                </div>
              )}

              {planUi === 'every_n' && (
                <label className="grid max-w-[10rem] gap-1 text-xs text-text-muted">
                  {t('habits_plan_interval')}
                  <Input
                    type="number"
                    min={2}
                    max={365}
                    value={interval}
                    onChange={e => setInterval(Number(e.target.value) || 2)}
                  />
                </label>
              )}

              {planUi === 'specific' && (
                <div className="grid gap-2">
                  <div className="flex items-end gap-2">
                    <label className="grid flex-1 gap-1 text-xs text-text-muted">
                      {t('habits_plan_add_day')}
                      <Input
                        type="date"
                        value={dateDraft}
                        onChange={e => setDateDraft(e.target.value)}
                      />
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={addSpecificDay}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {t('habits_plan_add_day')}
                    </Button>
                  </div>
                  {specificDayIds.length === 0 ? (
                    <p className="text-[11px] text-text-muted">{t('habits_plan_days_empty')}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {specificDayIds.map(id => (
                        <li
                          key={id}
                          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-primary"
                        >
                          {id}
                          <button
                            type="button"
                            onClick={() =>
                              setSpecificDayIds(prev => prev.filter(d => d !== id))
                            }
                            aria-label={t('action_delete')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('action_cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t('action_save') : t('habits_create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function recurrenceFromForm(value: HabitFormValue): {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[];
  specificDayIds?: string[];
} {
  if (value.planUi === 'specific') {
    return {
      frequency: 'none',
      interval: 1,
      weekdays: [],
      specificDayIds: uniqueSortedDayIds(value.specificDayIds),
    };
  }
  if (value.planUi === 'weekdays') {
    return { frequency: 'weekly', interval: 1, weekdays: value.weekdays };
  }
  if (value.planUi === 'every_n') {
    return { frequency: 'daily', interval: value.interval };
  }
  if (value.planUi === 'monthly') {
    return { frequency: 'monthly', interval: 1 };
  }
  return { frequency: 'daily', interval: 1 };
}
