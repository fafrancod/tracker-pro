import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  X,
  Repeat,
  CalendarRange,
  CheckSquare,
  Bell,
  Flame,
  Snowflake,
  Star,
  CircleDashed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import type {
  Project,
  CreateTaskPayload,
  Priority,
  RecurrenceFrequency,
  TaskKind,
  Urgency,
  Importance,
} from '@core/types';
import { isMultiDayRecurrenceAllowed } from '@core/lib/recurrence';

const PRIORITY_OPTIONS: {
  value: Priority;
  labelKey: 'task_priority_low' | 'task_priority_medium' | 'task_priority_high';
  color: string;
}[] = [
  { value: 'low', labelKey: 'task_priority_low', color: 'text-text-muted' },
  { value: 'medium', labelKey: 'task_priority_medium', color: 'text-accent-teal' },
  { value: 'high', labelKey: 'task_priority_high', color: 'text-accent-red' },
];

const ALL_RECURRENCE: {
  value: RecurrenceFrequency;
  labelKey:
    | 'task_repeat_none'
    | 'task_repeat_daily'
    | 'task_repeat_weekly'
    | 'task_repeat_monthly'
    | 'task_repeat_yearly';
}[] = [
  { value: 'none', labelKey: 'task_repeat_none' },
  { value: 'daily', labelKey: 'task_repeat_daily' },
  { value: 'weekly', labelKey: 'task_repeat_weekly' },
  { value: 'monthly', labelKey: 'task_repeat_monthly' },
  { value: 'yearly', labelKey: 'task_repeat_yearly' },
];

const SPAN_RECURRENCE = ALL_RECURRENCE.filter(o =>
  isMultiDayRecurrenceAllowed(o.value)
);

export const TASK_COLOR_PRESETS = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#a371f7',
  '#db61a2',
  '#39c5cf',
  '#e3b341',
] as const;

interface AddTaskFormProps {
  projects: Project[];
  onAdd: (payload: CreateTaskPayload) => Promise<void>;
  /** Si está en true, el formulario arranca expandido y oculta el botón colapsado. */
  startOpen?: boolean;
  /** Día de inicio (YYYY-MM-DD). Default end = start. */
  startDayId?: string;
  /** compact = columna semana; modal = sheet/dialog grande. */
  variant?: 'compact' | 'modal';
  onCancel?: () => void;
}

export function AddTaskForm({
  projects,
  onAdd,
  startOpen = false,
  startDayId,
  variant = 'compact',
  onCancel,
}: AddTaskFormProps) {
  const { t } = useT();
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [endDayId, setEndDayId] = useState(startDayId ?? '');
  const [kind, setKind] = useState<TaskKind>('task');
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [importance, setImportance] = useState<Importance | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startDayId) setEndDayId(prev => (prev && prev >= startDayId ? prev : startDayId));
  }, [startDayId]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const isMultiDay = Boolean(startDayId && endDayId && endDayId > startDayId);
  const recurrenceOptions = useMemo(
    () => (isMultiDay ? SPAN_RECURRENCE : ALL_RECURRENCE),
    [isMultiDay]
  );

  useEffect(() => {
    if (isMultiDay && !isMultiDayRecurrenceAllowed(recurrenceFrequency)) {
      setRecurrenceFrequency('none');
    }
  }, [isMultiDay, recurrenceFrequency]);

  function resetForm() {
    setTitle('');
    setProjectId(null);
    setPriority('medium');
    setRecurrenceFrequency('none');
    setRecurrenceInterval(1);
    setKind('task');
    setUrgency(null);
    setImportance(null);
    setColor(null);
    setStartTime('');
    setEndTime('');
    if (startDayId) setEndDayId(startDayId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;

    const safeEnd =
      startDayId && endDayId && endDayId >= startDayId ? endDayId : startDayId;
    let frequency = recurrenceFrequency;
    if (safeEnd && startDayId && safeEnd > startDayId && !isMultiDayRecurrenceAllowed(frequency)) {
      frequency = 'none';
    }

    setSubmitting(true);
    try {
      await onAdd({
        title: trimmed,
        projectId,
        priority,
        endDayId: safeEnd,
        recurrenceFrequency: frequency,
        recurrenceInterval: frequency === 'none' ? 1 : recurrenceInterval,
        kind,
        urgency,
        importance,
        color,
        startTime: startTime || null,
        endTime: endTime || null,
      });
      resetForm();
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (onCancel) onCancel();
      else {
        setOpen(false);
        setTitle('');
      }
    }
  }

  if (!open && !startOpen) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
      >
        <Plus className="h-4 w-4" />
        {t('board_add_task')}
      </button>
    );
  }

  const isModal = variant === 'modal';

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex flex-col',
        isModal
          ? 'gap-5'
          : 'gap-2 rounded-md border border-border bg-surface p-2'
      )}
    >
      {/* Accent strip when color selected */}
      {isModal && (
        <div
          className="h-1.5 w-full rounded-full bg-border transition-colors"
          style={color ? { backgroundColor: color } : undefined}
          aria-hidden
        />
      )}

      {/* Kind: Tarea | Recordatorio */}
      <div className={cn('grid grid-cols-2 gap-2', !isModal && 'gap-1')}>
        {(
          [
            { value: 'task' as const, icon: CheckSquare, label: t('task_kind_task') },
            { value: 'reminder' as const, icon: Bell, label: t('task_kind_reminder') },
          ] as const
        ).map(opt => {
          const Icon = opt.icon;
          const active = kind === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setKind(opt.value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'border-accent-teal/50 bg-accent-teal/15 text-accent-teal shadow-sm ring-1 ring-accent-teal/30'
                  : 'border-border bg-background/60 text-text-muted hover:border-border hover:bg-surface hover:text-text-primary',
                !isModal && 'py-1.5 text-xs rounded-md'
              )}
            >
              <Icon className={cn('h-4 w-4', !isModal && 'h-3.5 w-3.5')} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Title */}
      <div className={cn(isModal && 'space-y-1.5')}>
        {isModal && (
          <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('task_title_label')}
          </label>
        )}
        <Input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            kind === 'reminder' ? t('task_reminder_placeholder') : t('task_title_placeholder')
          }
          className={cn(
            isModal
              ? 'h-12 rounded-xl border-border bg-background px-4 text-base focus-visible:ring-accent-teal/40'
              : 'h-8 border-none bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0'
          )}
        />
      </div>

      {/* Project + priority */}
      <div className={cn('flex flex-wrap items-center gap-2', isModal && 'gap-3')}>
        <select
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value || null)}
          className={cn(
            'min-w-0 flex-1 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-ring',
            isModal ? 'px-3 py-2.5 text-sm' : 'px-1.5 py-1 text-xs rounded border'
          )}
        >
          <option value="">{t('task_no_project')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={cn(
                'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                isModal && 'px-3 py-1.5',
                priority === opt.value
                  ? 'bg-border ' + opt.color
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Eisenhower: urgency + importance */}
      <div className={cn('grid gap-3', isModal ? 'sm:grid-cols-2' : 'gap-2')}>
        <div className="space-y-1.5">
          <p
            className={cn(
              'font-medium text-text-muted',
              isModal ? 'text-xs uppercase tracking-wide' : 'text-[10px]'
            )}
          >
            {t('board_filter_urgency')}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleChip
              active={urgency === 'urgent'}
              onClick={() => setUrgency(u => (u === 'urgent' ? null : 'urgent'))}
              icon={<Flame className="h-3.5 w-3.5" />}
              label={t('urgency_urgent')}
              activeClass="border-accent-red/40 bg-accent-red/15 text-accent-red"
              compact={!isModal}
            />
            <ToggleChip
              active={urgency === 'not_urgent'}
              onClick={() => setUrgency(u => (u === 'not_urgent' ? null : 'not_urgent'))}
              icon={<Snowflake className="h-3.5 w-3.5" />}
              label={t('urgency_not_urgent')}
              activeClass="border-accent-teal/40 bg-accent-teal/15 text-accent-teal"
              compact={!isModal}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p
            className={cn(
              'font-medium text-text-muted',
              isModal ? 'text-xs uppercase tracking-wide' : 'text-[10px]'
            )}
          >
            {t('board_filter_importance')}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleChip
              active={importance === 'important'}
              onClick={() => setImportance(i => (i === 'important' ? null : 'important'))}
              icon={<Star className="h-3.5 w-3.5" />}
              label={t('importance_important')}
              activeClass="border-amber-400/40 bg-amber-400/15 text-amber-300"
              compact={!isModal}
            />
            <ToggleChip
              active={importance === 'not_important'}
              onClick={() =>
                setImportance(i => (i === 'not_important' ? null : 'not_important'))
              }
              icon={<CircleDashed className="h-3.5 w-3.5" />}
              label={t('importance_not_important')}
              activeClass="border-border bg-surface text-text-primary"
              compact={!isModal}
            />
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="space-y-1.5">
        <p
          className={cn(
            'font-medium text-text-muted',
            isModal ? 'text-xs uppercase tracking-wide' : 'text-[10px]'
          )}
        >
          {t('task_color')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setColor(null)}
            title={t('task_color_auto')}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border text-[10px] text-text-muted transition-colors hover:border-text-muted',
              color === null && 'border-accent-teal ring-2 ring-accent-teal/30'
            )}
          >
            —
          </button>
          {TASK_COLOR_PRESETS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              className={cn(
                'h-8 w-8 rounded-full border-2 border-transparent transition-transform hover:scale-110',
                color === c && 'ring-2 ring-offset-2 ring-offset-surface ring-white/80 scale-110'
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {/* Dates */}
      {startDayId && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/50',
            isModal ? 'px-3 py-3' : 'px-2 py-1.5 rounded border'
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
            <span>{t('task_start_date')}</span>
            <input
              type="date"
              value={startDayId}
              readOnly
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary opacity-80"
              aria-label={t('task_start_date')}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
            <span>{t('task_end_date')}</span>
            <input
              type="date"
              value={endDayId || startDayId}
              min={startDayId}
              onChange={e => setEndDayId(e.target.value || startDayId)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t('task_end_date')}
            />
          </label>
        </div>
      )}

      {/* Schedule times */}
      <div className={cn('flex flex-wrap items-end gap-2', isModal && 'gap-3')}>
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
          <span>{t('task_start_time')}</span>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={t('task_start_time')}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
          <span>{t('task_end_time')}</span>
          <input
            type="time"
            value={endTime}
            min={startTime || undefined}
            onChange={e => setEndTime(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={t('task_end_time')}
          />
        </label>
        {(startTime || endTime) && (
          <button
            type="button"
            className="mb-0.5 text-[10px] text-text-muted hover:text-text-primary"
            onClick={() => {
              setStartTime('');
              setEndTime('');
            }}
          >
            {t('task_clear_time')}
          </button>
        )}
      </div>

      {/* Recurrence */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/50',
          isModal ? 'px-3 py-3' : 'px-2 py-1.5 rounded border'
        )}
      >
        <Repeat className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        <select
          value={recurrenceFrequency}
          onChange={e => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={t('task_repeat')}
        >
          {recurrenceOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>

        {recurrenceFrequency !== 'none' && (
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <span>{t('task_repeat_every')}</span>
            <input
              type="number"
              min={1}
              max={365}
              value={recurrenceInterval}
              onChange={e =>
                setRecurrenceInterval(Math.max(1, Math.min(365, Number(e.target.value) || 1)))
              }
              className="w-12 rounded-lg border border-border bg-background px-1 py-1 text-center text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span>
              {recurrenceFrequency === 'daily'
                ? t('task_repeat_unit_days')
                : recurrenceFrequency === 'weekly'
                  ? t('task_repeat_unit_weeks')
                  : recurrenceFrequency === 'monthly'
                    ? t('task_repeat_unit_months')
                    : t('task_repeat_unit_years')}
            </span>
          </label>
        )}
      </div>

      {isMultiDay && (
        <p className="px-0.5 text-[10px] text-text-muted">{t('task_span_recurrence_hint')}</p>
      )}

      {/* Actions */}
      <div
        className={cn(
          'flex items-center justify-end gap-2',
          isModal && 'border-t border-border pt-4'
        )}
      >
        {(onCancel || !startOpen) && (
          <Button
            type="button"
            size={isModal ? 'default' : 'icon'}
            variant="ghost"
            className={cn(!isModal && 'h-7 w-7')}
            onClick={() => {
              resetForm();
              if (onCancel) onCancel();
              else setOpen(false);
            }}
          >
            {isModal ? t('action_cancel') : <X className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          type="submit"
          size={isModal ? 'default' : 'sm'}
          className={cn(
            isModal && 'min-w-[140px] rounded-xl bg-accent-teal text-background hover:bg-accent-teal/90',
            !isModal && 'h-7 px-2 text-xs'
          )}
          disabled={!title.trim() || submitting}
        >
          {kind === 'reminder' ? t('action_add_reminder') : t('action_add_task')}
        </Button>
      </div>
    </form>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
  activeClass,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl border font-medium transition-all',
        compact ? 'px-1.5 py-1 text-[10px] rounded-md' : 'px-2 py-2 text-xs',
        active
          ? activeClass + ' shadow-sm'
          : 'border-border bg-background/50 text-text-muted hover:text-text-primary'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
