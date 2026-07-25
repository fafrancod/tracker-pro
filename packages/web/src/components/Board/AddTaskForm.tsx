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
  Pill,
  PawPrint,
  User,
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
  RxPhase,
  DoseUnit,
} from '@core/types';
import { isMultiDayRecurrenceAllowed } from '@core/lib/recurrence';
import { isRxKind, validateRxPhases } from '@core/lib/rx';

const DEFAULT_RX_PHASE: RxPhase = {
  amount: 1,
  unit: 'pills',
  days: 7,
  times: ['08:00'],
};

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
  const [rxSubject, setRxSubject] = useState('');
  const [rxPhases, setRxPhases] = useState<RxPhase[]>([{ ...DEFAULT_RX_PHASE, times: ['08:00'] }]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRx = isRxKind(kind);

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
    setRxSubject('');
    setRxPhases([{ ...DEFAULT_RX_PHASE, times: ['08:00'] }]);
    if (startDayId) setEndDayId(startDayId);
  }

  function updatePhase(index: number, patch: Partial<RxPhase>) {
    setRxPhases(prev =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function addPhase() {
    setRxPhases(prev => [
      ...prev,
      { amount: 1, unit: 'pills' as DoseUnit, days: 7, times: ['08:00'] },
    ]);
  }

  function removePhase(index: number) {
    setRxPhases(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function addTimeToPhase(index: number) {
    setRxPhases(prev =>
      prev.map((p, i) =>
        i === index
          ? { ...p, times: [...p.times, p.times[p.times.length - 1] ?? '08:00'] }
          : p
      )
    );
  }

  function setPhaseTime(phaseIndex: number, timeIndex: number, value: string) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        const times = [...p.times];
        times[timeIndex] = value;
        return { ...p, times };
      })
    );
  }

  function removePhaseTime(phaseIndex: number, timeIndex: number) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        if (p.times.length <= 1) return p;
        return { ...p, times: p.times.filter((_, ti) => ti !== timeIndex) };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;

    if (isRxKind(kind)) {
      const err = validateRxPhases(rxPhases);
      if (err) {
        alert(err);
        return;
      }
      setSubmitting(true);
      try {
        await onAdd({
          title: trimmed,
          projectId,
          priority: priority || 'high',
          kind,
          urgency,
          importance,
          color,
          notes: notesFromRx(rxSubject, rxPhases),
          rxPhases,
          rxSubject: rxSubject.trim() || null,
        });
        resetForm();
        inputRef.current?.focus();
      } finally {
        setSubmitting(false);
      }
      return;
    }

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

  function notesFromRx(subject: string, phases: RxPhase[]): string {
    const lines = phases.map((p, i) => {
      const unit = p.unit === 'ml' ? 'ml' : 'past.';
      return `Fase ${i + 1}: ${p.amount} ${unit} · ${p.times.join(', ')} · ${p.days}d`;
    });
    if (subject.trim()) lines.unshift(`Para: ${subject.trim()}`);
    return lines.join('\n');
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

      {/* Kind: Tarea | Recordatorio | Rx humano | Rx mascota */}
      <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', !isModal && 'gap-1')}>
        {(
          [
            { value: 'task' as const, icon: CheckSquare, label: t('task_kind_task') },
            { value: 'reminder' as const, icon: Bell, label: t('task_kind_reminder') },
            { value: 'rx_human' as const, icon: Pill, label: t('task_kind_rx_human') },
            { value: 'rx_pet' as const, icon: PawPrint, label: t('task_kind_rx_pet') },
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
                'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-all sm:text-sm sm:px-3 sm:py-2.5',
                active
                  ? 'border-accent-teal/50 bg-accent-teal/15 text-accent-teal shadow-sm ring-1 ring-accent-teal/30'
                  : 'border-border bg-background/60 text-text-muted hover:border-border hover:bg-surface hover:text-text-primary',
                !isModal && 'py-1.5 text-[10px] rounded-md'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', isModal && 'h-4 w-4')} />
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Title */}
      <div className={cn(isModal && 'space-y-1.5')}>
        {isModal && (
          <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {isRx ? t('rx_medicine_name') : t('task_title_label')}
          </label>
        )}
        <Input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isRx
              ? t('rx_medicine_placeholder')
              : kind === 'reminder'
                ? t('task_reminder_placeholder')
                : t('task_title_placeholder')
          }
          className={cn(
            isModal
              ? 'h-12 rounded-xl border-border bg-background px-4 text-base focus-visible:ring-accent-teal/40'
              : 'h-8 border-none bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0'
          )}
        />
      </div>

      {/* Recetario: sujeto + fases */}
      {isRx && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
          <label className="flex flex-col gap-1 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
              {kind === 'rx_pet' ? <PawPrint className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {kind === 'rx_pet' ? t('rx_pet_name') : t('rx_patient_name')}
            </span>
            <Input
              value={rxSubject}
              onChange={e => setRxSubject(e.target.value)}
              placeholder={
                kind === 'rx_pet' ? t('rx_pet_placeholder') : t('rx_patient_placeholder')
              }
              className="h-9 text-sm"
            />
          </label>

          <p className="text-[11px] text-text-muted">{t('rx_phases_hint')}</p>

          {rxPhases.map((phase, pi) => (
            <div
              key={pi}
              className="space-y-2 rounded-lg border border-border bg-surface p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-primary">
                  {t('rx_phase')} {pi + 1}
                </span>
                {rxPhases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhase(pi)}
                    className="text-[11px] text-accent-red hover:underline"
                  >
                    {t('action_delete')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_amount')}</span>
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={phase.amount}
                    onChange={e =>
                      updatePhase(pi, { amount: Math.max(0.1, Number(e.target.value) || 0) })
                    }
                    className="w-20 rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_unit')}</span>
                  <select
                    value={phase.unit}
                    onChange={e => updatePhase(pi, { unit: e.target.value as DoseUnit })}
                    className="rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                  >
                    <option value="pills">{t('rx_unit_pills')}</option>
                    <option value="ml">{t('rx_unit_ml')}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_days')}</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={phase.days}
                    onChange={e =>
                      updatePhase(pi, {
                        days: Math.max(1, Math.min(365, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-16 rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                  />
                </label>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-medium uppercase text-text-muted">
                  {t('rx_times')}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {phase.times.map((tm, ti) => (
                    <div key={ti} className="flex items-center gap-0.5">
                      <input
                        type="time"
                        value={tm}
                        onChange={e => setPhaseTime(pi, ti, e.target.value)}
                        className="rounded border border-border bg-background px-1.5 py-1 text-xs text-text-primary"
                      />
                      {phase.times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhaseTime(pi, ti)}
                          className="text-text-muted hover:text-accent-red"
                          aria-label={t('action_delete')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTimeToPhase(pi)}
                    className="rounded border border-dashed border-border px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
                  >
                    + {t('rx_add_time')}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addPhase}
            className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-text-muted hover:border-accent-teal/40 hover:text-accent-teal"
          >
            + {t('rx_add_phase')}
          </button>
        </div>
      )}

      {/* Project + priority — oculto en recetario compacto opcional; en modal se mantiene proyecto opcional */}
      <div className={cn('flex flex-wrap items-center gap-2', isModal && 'gap-3', isRx && !isModal && 'hidden')}>
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

      {/* Eisenhower: urgency + importance — skip for rx in compact */}
      <div className={cn('grid gap-3', isModal ? 'sm:grid-cols-2' : 'gap-2', isRx && !isModal && 'hidden')}>
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

      {/* Schedule times — no aplica a recetario (horarios van en fases) */}
      <div className={cn('flex flex-wrap items-end gap-2', isModal && 'gap-3', isRx && 'hidden')}>
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

      {/* Recurrence — recetario materializa su propio plan */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/50',
          isModal ? 'px-3 py-3' : 'px-2 py-1.5 rounded border',
          isRx && 'hidden'
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
