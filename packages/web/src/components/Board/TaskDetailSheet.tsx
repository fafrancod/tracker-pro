import { useEffect, useState, useMemo, type KeyboardEvent } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Trash2,
  Copy,
  Tag as TagIcon,
  X,
  CheckCircle2,
  Save,
  Pill,
  PawPrint,
  User,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@core/store';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import {
  expandIntervalTimes,
  isRxKind,
  resolvePhaseScheduleMode,
  rxPhaseDateRanges,
  rxPlanEndDayId,
  totalRxPlanDays,
  validateRxPhases,
} from '@core/lib/rx';
import { extractHashtags, extractMentions, mergeTags } from '@core/lib/tags';
import { normalizeTimeInput } from '@core/lib/time';
import { isValidTaskTimeRange } from '@core/lib/schedule';
import { DecimalInput } from '@/components/ui/decimal-input';
import { TimeInput } from '@/components/ui/time-input';
// DecimalInput reused for finance amounts
import { InvolvedContactsPicker } from './InvolvedContactsPicker';
import { TaskStepsEditor } from './TaskStepsEditor';
import { DateRangeField } from './DateRangeField';
import { TaskKindPicker, defaultKindOptions } from './TaskKindPicker';
import { kindSupportsSteps, stepsEqual } from '@core/lib/steps';
import {
  defaultFinanceColor,
  isFinanceKind,
} from '@core/lib/financeKinds';
import {
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from '@core/lib/currencies';
import { useSettings } from '@/contexts/SettingsContext';
import type {
  DoseUnit,
  FinanceCertainty,
  Importance,
  Priority,
  RxPhase,
  RxScheduleMode,
  Task,
  TaskApplyTo,
  TaskKind,
  TaskStep,
  Urgency,
} from '@core/types';

const DEFAULT_RX_PHASE: RxPhase = {
  amount: 1,
  unit: 'pills',
  days: 7,
  scheduleMode: 'fixed',
  times: ['08:00'],
  everyHours: null,
  startTime: null,
};

function clonePhases(phases: RxPhase[] | undefined | null): RxPhase[] {
  if (!phases?.length) return [{ ...DEFAULT_RX_PHASE, times: ['08:00'] }];
  return phases.map(p => ({
    amount: p.amount,
    unit: p.unit,
    days: p.days,
    scheduleMode: resolvePhaseScheduleMode(p),
    times: [...(p.times ?? [])],
    everyHours: p.everyHours ?? null,
    startTime: p.startTime ?? null,
  }));
}

function phasesEqual(a: RxPhase[], b: RxPhase[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const PRIORITIES: {
  value: Priority;
  key: 'task_priority_low' | 'task_priority_medium' | 'task_priority_high';
  color: string;
}[] = [
  { value: 'low', key: 'task_priority_low', color: 'text-text-muted' },
  { value: 'medium', key: 'task_priority_medium', color: 'text-accent-teal' },
  { value: 'high', key: 'task_priority_high', color: 'text-accent-red' },
];

const COLOR_SWATCHES = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#a371f7',
  '#db61a2',
  '#39c5cf',
  '#e3b341',
];

interface DraftState {
  title: string;
  notes: string;
  tags: string[];
  kind: TaskKind;
  priority: Priority;
  urgency: Urgency | null;
  importance: Importance | null;
  color: string | null;
  projectId: string | null;
  /** Editable start day (bucket day_id). */
  startDayId: string;
  endDayId: string;
  startTime: string;
  endTime: string;
  /** Recetario */
  rxSubject: string;
  rxAmount: number;
  rxUnit: DoseUnit;
  rxPhases: RxPhase[];
  involvedContactIds: string[];
  location: string;
  departureTime: string;
  steps: TaskStep[];
  financeAmount: number;
  financeCurrency: string;
  financeCertainty: FinanceCertainty;
}

function taskToDraft(task: Task, fallbackDayId: string): DraftState {
  return {
    title: task.title,
    notes: task.notes,
    tags: [...task.tags],
    kind: task.kind,
    priority: task.priority,
    urgency: task.urgency,
    importance: task.importance,
    color: task.color,
    projectId: task.projectId,
    startDayId: fallbackDayId,
    endDayId: task.endDayId || fallbackDayId,
    startTime: task.startTime ?? '',
    endTime: task.endTime ?? '',
    rxSubject: task.rx?.subject ?? '',
    rxAmount: task.rx?.amount ?? 1,
    rxUnit: task.rx?.unit ?? 'pills',
    rxPhases: clonePhases(task.rx?.phases),
    involvedContactIds: [...(task.involvedContactIds ?? [])],
    location: task.location ?? '',
    departureTime: task.departureTime ?? '',
    steps: [...(task.steps ?? [])].map(s => ({ ...s })),
    financeAmount: task.finance?.amount ?? 0,
    financeCurrency: task.finance?.currency ?? 'EUR',
    financeCertainty: task.finance?.certainty ?? 'fixed',
  };
}

function taskToDraftWithPreferred(
  task: Task,
  fallbackDayId: string,
  preferredCurrency?: string
): DraftState {
  const base = taskToDraft(task, fallbackDayId);
  if (!task.finance && isFinanceKind(task.kind)) {
    base.financeCurrency = normalizeCurrencyCode(
      preferredCurrency,
      base.financeCurrency
    );
  }
  return base;
}

function isDirty(draft: DraftState, task: Task, dayId: string): boolean {
  const base = taskToDraft(task, dayId);
  return (
    draft.title.trim() !== base.title ||
    draft.notes !== base.notes ||
    draft.kind !== base.kind ||
    draft.priority !== base.priority ||
    draft.urgency !== base.urgency ||
    draft.importance !== base.importance ||
    draft.color !== base.color ||
    draft.projectId !== base.projectId ||
    draft.startDayId !== base.startDayId ||
    draft.endDayId !== base.endDayId ||
    draft.startTime !== base.startTime ||
    draft.endTime !== base.endTime ||
    draft.tags.join('\0') !== base.tags.join('\0') ||
    draft.rxSubject !== base.rxSubject ||
    draft.rxAmount !== base.rxAmount ||
    draft.rxUnit !== base.rxUnit ||
    !phasesEqual(draft.rxPhases, base.rxPhases) ||
    draft.involvedContactIds.join('\0') !== base.involvedContactIds.join('\0') ||
    draft.location !== base.location ||
    draft.departureTime !== base.departureTime ||
    !stepsEqual(draft.steps, base.steps) ||
    draft.financeAmount !== base.financeAmount ||
    draft.financeCurrency !== base.financeCurrency ||
    draft.financeCertainty !== base.financeCertainty
  );
}

function isPlanDirty(draft: DraftState, task: Task): boolean {
  return !phasesEqual(draft.rxPhases, clonePhases(task.rx?.phases));
}

export function TaskDetailSheet() {
  const { locale, shortDateFormat, weekdayFormat, t } = useT();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const detail = useStore(s => s.detailTask);
  const setDetailTask = useStore(s => s.setDetailTask);

  const open = detail !== null;

  return (
    <Dialog open={open} onOpenChange={o => !o && setDetailTask(null)}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] w-[min(96vw,52rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl',
          'left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]'
        )}
      >
        {detail && (
          <div className="flex max-h-[92vh] flex-col overflow-hidden px-5 py-4 sm:px-6 sm:py-5">
            <TaskDetailInner
              weekId={detail.weekId}
              dayId={detail.dayId}
              taskId={detail.taskId}
              locale={locale}
              shortDateFormat={shortDateFormat}
              weekdayFormat={weekdayFormat}
              projects={projects}
              onClose={() => setDetailTask(null)}
              t={t}
              showToast={showToast}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface InnerProps {
  weekId: string;
  dayId: string;
  taskId: string;
  locale: Awaited<ReturnType<typeof useT>>['locale'];
  shortDateFormat: string;
  weekdayFormat: string;
  projects: ReturnType<typeof useProjects>['projects'];
  onClose: () => void;
  t: (key: Parameters<ReturnType<typeof useT>['t']>[0]) => string;
  showToast: ReturnType<typeof useToast>['showToast'];
}

function TaskDetailInner({
  weekId,
  dayId,
  taskId,
  locale,
  shortDateFormat,
  weekdayFormat: _weekdayFormat,
  projects,
  onClose,
  t,
  showToast,
}: InnerProps) {
  const { tasks, editTask, removeTask, moveTaskToDay, addTask, rematerializeRx } = useTasks(
    weekId,
    dayId
  );
  const contacts = useStore(s => s.contacts);
  const { settings } = useSettings();

  const task = useMemo(() => tasks.find(x => x.id === taskId) ?? null, [tasks, taskId]);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saving = false;

  useEffect(() => {
    if (task) {
      setDraft(
        taskToDraftWithPreferred(task, dayId, settings.preferredCurrency)
      );
      setTagInput('');
    }
  }, [task?.id, dayId, settings.preferredCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task || !draft) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        {saving ? t('rx_apply_plan') + '…' : 'Esta tarea ya no existe.'}
      </div>
    );
  }

  const project = projects.find(p => p.id === (draft.projectId ?? task.projectId));
  const dirty = isDirty(draft, task, dayId);
  const planDirty = isRxKind(task.kind) && isPlanDirty(draft, task);
  const isSeries = Boolean(task.seriesId);
  /** El recetario no se convierte (plan de fases). */
  const isRx = isRxKind(task.kind);
  /**
   * Tipo del borrador: al alternar en UI se muestran/ocultan bloques,
   * pero los valores del draft no se borran hasta Guardar.
   */
  const draftKind = draft.kind;
  const draftIsPossible = draftKind === 'possible_event';
  const draftIsEvent = draftKind === 'event';
  const draftIsEventLike = draftIsPossible || draftIsEvent;
  const draftIsProjectKind = draftKind === 'task' || draftKind === 'reminder';
  const draftIsHabit =
    draftKind === 'habit_good' || draftKind === 'habit_quit';  const draftIsFinance = isFinanceKind(draftKind);
  const draftSupportsSteps = kindSupportsSteps(draftKind);
  const draftSupportsLocation =
    draftKind === 'task' ||
    draftKind === 'reminder' ||
    draftKind === 'event' ||
    draftKind === 'possible_event';

  /** Kinds intercambiables en el menú de edición (no incluye rx). */
  const CONVERTIBLE_KINDS = defaultKindOptions(k =>
    t(k as Parameters<typeof t>[0])
  ).filter(
    o => o.value !== 'rx_human' && o.value !== 'rx_pet'
  );

  const rxPlanStart = task.rx?.planStartDayId || dayId;
  const rxPlanDays = isRx ? totalRxPlanDays(draft.rxPhases) : 0;
  const rxPlanEnd = isRx ? rxPlanEndDayId(rxPlanStart, draft.rxPhases) : '';
  const rxPhaseRanges = isRx ? rxPhaseDateRanges(rxPlanStart, draft.rxPhases) : [];

  function patchDraft(partial: Partial<DraftState>) {
    setDraft(prev => (prev ? { ...prev, ...partial } : prev));
  }

  function updatePhase(index: number, patch: Partial<RxPhase>) {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rxPhases: prev.rxPhases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      };
    });
  }

  function addPhase() {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rxPhases: [
          ...prev.rxPhases,
          {
            amount: 1,
            unit: 'pills' as DoseUnit,
            days: 7,
            scheduleMode: 'fixed',
            times: ['08:00'],
            everyHours: null,
            startTime: null,
          },
        ],
      };
    });
  }

  function removePhase(index: number) {
    setDraft(prev => {
      if (!prev || prev.rxPhases.length <= 1) return prev;
      return { ...prev, rxPhases: prev.rxPhases.filter((_, i) => i !== index) };
    });
  }

  function addTimeToPhase(index: number) {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rxPhases: prev.rxPhases.map((p, i) =>
          i === index
            ? { ...p, times: [...p.times, p.times[p.times.length - 1] ?? '08:00'] }
            : p
        ),
      };
    });
  }

  function setPhaseTime(phaseIndex: number, timeIndex: number, value: string) {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rxPhases: prev.rxPhases.map((p, i) => {
          if (i !== phaseIndex) return p;
          const times = [...p.times];
          times[timeIndex] = value;
          return { ...p, times };
        }),
      };
    });
  }

  function removePhaseTime(phaseIndex: number, timeIndex: number) {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rxPhases: prev.rxPhases.map((p, i) => {
          if (i !== phaseIndex || p.times.length <= 1) return p;
          return { ...p, times: p.times.filter((_, ti) => ti !== timeIndex) };
        }),
      };
    });
  }

  function handleSave(applyTo: TaskApplyTo) {
    if (!task || !draft) return;
    const title = draft.title.trim();
    if (!title) {
      showToast(t('task_title_required'), 'error');
      return;
    }

    if (isRx && planDirty) {
      const phaseErr = validateRxPhases(draft.rxPhases);
      if (phaseErr) {
        showToast(phaseErr, 'error');
        return;
      }
    }

    // Validar horarios antes de cerrar (no-async). Finanzas: sin hora.
    if (!isRx) {
      const saveKind = draft.kind;
      const saveIsHabit =
        saveKind === 'habit_good' || saveKind === 'habit_quit';
      const saveIsFinance = isFinanceKind(saveKind);
      const startN =
        saveIsHabit || saveIsFinance
          ? null
          : normalizeTimeInput(draft.startTime);
      const endN =
        saveIsHabit || saveIsFinance
          ? null
          : normalizeTimeInput(draft.endTime);
      const rangeStart = draft.startDayId || dayId;
      const rangeEnd = draft.endDayId || rangeStart;
      if (
        !saveIsHabit &&
        !saveIsFinance &&
        !isValidTaskTimeRange(startN, endN, rangeStart, rangeEnd)
      ) {
        showToast(t('task_time_range_error'), 'error');
        return;
      }
    }

    // Snapshot del draft: el sheet se cierra al instante (Fase 4.1).
    const snap = draft;
    const taskSnap = task;
    const successMsg =
      isRx && planDirty
        ? t('rx_plan_saved').replace('{n}', '…')
        : applyTo === 'series' && isSeries
          ? t('task_saved_series')
          : t('task_saved_ok');

    onClose();
    showToast(successMsg, 'success');

    void (async () => {
      try {
        if (isRxKind(taskSnap.kind)) {
          const subject = snap.rxSubject.trim() || null;
          const tags = mergeTags(
            snap.tags,
            extractHashtags(title),
            extractMentions(title),
            extractMentions(snap.notes),
            extractMentions(subject ?? ''),
            taskSnap.kind === 'rx_pet' && subject ? subject : null
          );
          const planWasDirty = !phasesEqual(
            snap.rxPhases,
            clonePhases(taskSnap.rx?.phases)
          );
          await editTask(taskSnap.id, {
            title,
            notes: snap.notes,
            tags,
            priority: 'high',
            urgency: 'urgent',
            importance: 'important',
            color: snap.color,
            projectId: null,
            startTime: planWasDirty
              ? undefined
              : normalizeTimeInput(snap.startTime),
            endTime: planWasDirty
              ? undefined
              : normalizeTimeInput(snap.endTime),
            rxAmount: snap.rxAmount,
            rxUnit: snap.rxUnit,
            rxSubject: subject,
            applyTo: taskSnap.seriesId ? applyTo : 'instance',
          });

          if (planWasDirty) {
            const result = await rematerializeRx(taskSnap.id, {
              title,
              rxPhases: snap.rxPhases,
              rxSubject: subject,
              fromDayId: dayId,
              color: snap.color,
            });
            showToast(
              t('rx_plan_saved').replace(
                '{n}',
                String(result?.created ?? 0)
              ),
              'success'
            );
          }
        } else {
          const saveKind = snap.kind;
          const saveEventLike =
            saveKind === 'event' || saveKind === 'possible_event';
          const saveIsEvent = saveKind === 'event';
          const saveIsHabit =
            saveKind === 'habit_good' || saveKind === 'habit_quit';
          const saveIsFinance = isFinanceKind(saveKind);
          const tags = mergeTags(
            snap.tags,
            extractHashtags(title),
            extractMentions(title),
            extractMentions(snap.notes)
          );
          const startN =
            saveIsHabit || saveIsFinance
              ? null
              : normalizeTimeInput(snap.startTime);
          const endN =
            saveIsHabit || saveIsFinance
              ? null
              : normalizeTimeInput(snap.endTime);
          const depN = normalizeTimeInput(snap.departureTime);
          const nextStart = snap.startDayId || dayId;
          const nextEnd =
            saveIsHabit
              ? nextStart
              : snap.endDayId >= nextStart
                ? snap.endDayId
                : nextStart;

          // Cambiar día de inicio = mover (preserva duración), luego fijar fin.
          if (nextStart !== dayId) {
            await moveTaskToDay(taskSnap, parseISO(`${nextStart}T00:00:00`));
          }

          await editTask(taskSnap.id, {
            title,
            notes: snap.notes,
            tags,
            kind: saveKind,
            priority: snap.priority,
            urgency:
              saveEventLike || saveIsHabit || saveIsFinance
                ? null
                : snap.urgency,
            importance:
              saveEventLike || saveIsHabit || saveIsFinance
                ? null
                : snap.importance,
            color:
              snap.color ??
              (saveIsEvent
                ? '#58a6ff'
                : saveKind === 'possible_event'
                  ? '#a371f7'
                  : saveKind === 'habit_good'
                    ? '#3fb950'
                    : saveKind === 'habit_quit'
                      ? '#f85149'
                      : saveIsFinance
                        ? defaultFinanceColor(saveKind)
                        : null),
            projectId:
              saveEventLike || saveIsHabit || saveIsFinance
                ? null
                : snap.projectId,
            endDayId: nextEnd,
            involvedContactIds: saveEventLike
              ? snap.involvedContactIds
              : [],
            location:
              saveKind === 'task' ||
              saveKind === 'reminder' ||
              saveIsEvent ||
              saveKind === 'possible_event'
                ? snap.location.trim() || null
                : null,
            departureTime: saveIsEvent ? depN : null,
            startTime: startN,
            endTime: endN,
            steps: kindSupportsSteps(saveKind)
              ? snap.steps
                  .map(s => ({
                    id: s.id,
                    title: s.title.trim(),
                    completed: Boolean(s.completed),
                  }))
                  .filter(s => s.title.length > 0)
              : [],
            // Solo tocar finance_meta si el kind es finanzas (evita PATCH
            // a columna inexistente o null accidental en tareas normales).
            ...(saveIsFinance
              ? {
                  finance: {
                    amount: snap.financeAmount,
                    currency: snap.financeCurrency,
                    certainty: snap.financeCertainty,
                  },
                }
              : isFinanceKind(taskSnap.kind)
                ? { finance: null }
                : {}),
            applyTo: taskSnap.seriesId ? applyTo : 'instance',
          });
        }
      } catch (err) {
        const wasPlan =
          isRxKind(taskSnap.kind) &&
          !phasesEqual(snap.rxPhases, clonePhases(taskSnap.rx?.phases));
        const detail =
          err instanceof Error && err.message
            ? ` ${err.message}`
            : '';
        console.error('task save failed', err);
        showToast(
          wasPlan
            ? t('rx_plan_error')
            : `${t('task_save_error')}${detail}`,
          'error'
        );
      }
    })();
  }

  function handleTagKeydown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = tagInput.trim().replace(/,$/, '');
      if (!value) return;
      if (draft!.tags.includes(value)) {
        setTagInput('');
        return;
      }
      patchDraft({ tags: [...draft!.tags, value] });
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && draft!.tags.length > 0) {
      patchDraft({ tags: draft!.tags.slice(0, -1) });
    }
  }

  function removeTag(tag: string) {
    patchDraft({ tags: draft!.tags.filter(x => x !== tag) });
  }

  async function handleDuplicate() {
    await addTask({
      title: task!.title,
      projectId: task!.projectId,
      priority: task!.priority,
      notes: task!.notes,
      tags: task!.tags,
      recurrenceFrequency: task!.recurrence.frequency,
      recurrenceInterval: task!.recurrence.interval,
      kind: task!.kind,
      color: task!.color,
      urgency: task!.urgency,
      importance: task!.importance,
    });
    showToast(t('task_duplicated'), 'success');
  }

  async function confirmDelete() {
    if (!task) return;
    setDeleting(true);
    try {
      await removeTask(task.id);
      showToast(t('task_deleted'), 'info');
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 pr-8 text-left">
        <DialogTitle>{t('task_detail_title')}</DialogTitle>
        <DialogDescription asChild>
          <div>
            {project ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.icon} {project.name}
              </span>
            ) : (
              t('task_no_project')
            )}
            {' · '}
            {format(parseISO(`${dayId}T00:00:00`), `EEEE, ${shortDateFormat}`, { locale })}
            {task.endDayId && task.endDayId > dayId && (
              <>
                {' – '}
                {format(parseISO(`${task.endDayId}T00:00:00`), shortDateFormat, { locale })}
              </>
            )}
            {isSeries && (
              <span className="ml-1 text-accent-teal"> · {t('task_part_of_series')}</span>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
        {/* Title + completed (completed is immediate / instance-only) */}
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={() => editTask(task.id, { completed: !task.completed })}
            className={cn(
              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
              task.completed
                ? 'border-accent-green bg-accent-green/20 text-accent-green'
                : 'border-border hover:border-accent-green'
            )}
            aria-label={task.completed ? t('task_uncomplete') : t('task_complete')}
          >
            {task.completed && <CheckCircle2 className="h-3 w-3" />}
          </button>
          <Input
            value={draft.title}
            onChange={e => patchDraft({ title: e.target.value })}
            placeholder={t('task_title_placeholder')}
            className={cn(
              'h-9 border-none bg-transparent px-0 text-base font-medium focus-visible:ring-0',
              task.completed && 'text-text-muted line-through'
            )}
          />
        </div>

        {task.completed && task.completedAt && (
          <p className="mb-3 text-[11px] text-text-muted">
            ✓ {t('task_completed_at')}{' '}
            {format(parseISO(task.completedAt), `EEE ${shortDateFormat} · HH:mm`, { locale })}
          </p>
        )}

        {/* Tipo — chip con icono; al clic se despliegan botones */}
        {!isRx && (
          <Field label={t('task_kind_convert')}>
            <p className="mb-1.5 text-[10px] text-text-muted">
              {t('task_kind_convert_hint')}
            </p>
            <TaskKindPicker
              value={draft.kind}
              onChange={k => patchDraft({ kind: k })}
              options={CONVERTIBLE_KINDS}
            />
          </Field>
        )}

        {/* Finanzas: importe / moneda / fijo vs potencial */}
        {!isRx && draftIsFinance && (
          <Field label={t('nav_finances')}>
            <p className="mb-1.5 text-[10px] text-text-muted">
              {t('task_finance_hint')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                <span>{t('fin_field_amount')}</span>
                <DecimalInput
                  value={draft.financeAmount}
                  onChange={v => patchDraft({ financeAmount: v })}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                <span>{t('fin_field_currency')}</span>
                <select
                  value={draft.financeCurrency}
                  onChange={e =>
                    patchDraft({ financeCurrency: e.target.value })
                  }
                  className="h-9 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('task_finance_certainty')}</span>
              <select
                value={draft.financeCertainty}
                onChange={e =>
                  patchDraft({
                    financeCertainty: e.target.value as FinanceCertainty,
                  })
                }
                className="h-9 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
              >
                <option value="fixed">{t('task_finance_fixed')}</option>
                <option value="potential">{t('task_finance_potential')}</option>
              </select>
            </label>
          </Field>
        )}

        {/* Pasos asociados */}
        {!isRx && draftSupportsSteps && (
          <TaskStepsEditor
            steps={draft.steps}
            onChange={next => patchDraft({ steps: next })}
            defaultOpen={draft.steps.length > 0}
          />
        )}

        {/* Lugar (tarea / recordatorio / evento / posible) */}
        {!isRx && draftSupportsLocation && (
          <Field
            label={
              draftIsEvent
                ? t('task_event_location')
                : draftIsPossible
                  ? t('task_possible_event_location')
                  : t('task_location')
            }
          >
            <Input
              value={draft.location}
              onChange={e => patchDraft({ location: e.target.value })}
              placeholder={
                draftIsEvent
                  ? t('task_event_location_ph')
                  : draftIsPossible
                    ? t('task_possible_event_location_ph')
                    : t('task_location_ph')
              }
              maxLength={200}
              className="h-9 text-sm"
            />
          </Field>
        )}

        {/* Salida + contactos solo en evento / posible */}
        {!isRx && draftIsEventLike && (
          <>
            {draftIsEvent && (
              <Field label={t('task_event_departure')}>
                <TimeInput
                  value={draft.departureTime}
                  onChange={v => patchDraft({ departureTime: v })}
                  nowLabel={t('time_now')}
                  clearLabel={t('task_clear_time')}
                />
                <p className="mt-1 text-[10px] text-text-muted">
                  {t('task_event_departure_hint')}
                </p>
              </Field>
            )}
            <Field label={t('task_involved_contacts')}>
              <p className="mb-1.5 text-[10px] text-text-muted">
                {t('task_involved_contacts_hint')}
              </p>
              <InvolvedContactsPicker
                contacts={contacts}
                selectedIds={draft.involvedContactIds}
                onToggle={id => {
                  const active = draft.involvedContactIds.includes(id);
                  patchDraft({
                    involvedContactIds: active
                      ? draft.involvedContactIds.filter(x => x !== id)
                      : [...draft.involvedContactIds, id],
                  });
                }}
                accent={draftIsEvent ? 'event' : 'possible'}
              />
            </Field>
          </>
        )}

        {/* Recetario: tipo fijo + sujeto + dosis de esta toma + plan de fases */}
        {isRx ? (
          <>
            <Field label={t('rx_edit_plan')}>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-text-primary">
                {task.kind === 'rx_pet' ? (
                  <PawPrint className="h-3.5 w-3.5 text-accent-pink" />
                ) : (
                  <Pill className="h-3.5 w-3.5 text-accent-teal" />
                )}
                {task.kind === 'rx_pet' ? t('task_kind_rx_pet') : t('task_kind_rx_human')}
              </div>
            </Field>

            <Field
              label={
                <span className="inline-flex items-center gap-1">
                  {task.kind === 'rx_pet' ? (
                    <PawPrint className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {task.kind === 'rx_pet' ? t('rx_pet_name') : t('rx_patient_name')}
                </span>
              }
            >
              <Input
                value={draft.rxSubject}
                onChange={e => patchDraft({ rxSubject: e.target.value })}
                placeholder={
                  task.kind === 'rx_pet' ? t('rx_pet_placeholder') : t('rx_patient_placeholder')
                }
                className="h-9 text-sm"
              />
            </Field>

            <Field label={t('rx_this_dose')}>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_amount')}</span>
                  <DecimalInput
                    value={draft.rxAmount}
                    min={0.01}
                    onChange={rxAmount => patchDraft({ rxAmount })}
                    className="w-24 rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_unit')}</span>
                  <select
                    value={draft.rxUnit}
                    onChange={e => patchDraft({ rxUnit: e.target.value as DoseUnit })}
                    className="rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                  >
                    <option value="pills">{t('rx_unit_pills')}</option>
                    <option value="ml">{t('rx_unit_ml')}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('task_start_time')}</span>
                  <TimeInput
                    value={draft.startTime}
                    onChange={v => patchDraft({ startTime: v })}
                    disabled={planDirty}
                    nowLabel={t('time_now')}
                    clearLabel={t('task_clear_time')}
                  />
                </label>
              </div>
              {planDirty && (
                <p className="mt-1.5 text-[10px] text-text-muted">{t('rx_apply_plan_hint')}</p>
              )}
            </Field>

            {draft.rxPhases.length > 0 &&
              (rxPhaseRanges.length <= 1 ? (
                <p className="mb-3 text-[11px] text-text-muted">
                  {t('rx_plan_duration_value')
                    .replace('{days}', String(rxPlanDays))
                    .replace('{end}', rxPlanEnd)}
                </p>
              ) : (
                <div className="mb-3 space-y-1 text-[11px] text-text-muted">
                  <p className="font-medium text-text-secondary">{t('rx_plan_duration')}</p>
                  <ul className="space-y-0.5">
                    {rxPhaseRanges.map(r => (
                      <li key={r.phaseIndex}>
                        {t('rx_phase_date_range')
                          .replace('{n}', String(r.phaseIndex + 1))
                          .replace('{start}', r.startDayId)
                          .replace('{end}', r.endDayId)
                          .replace('{days}', String(r.days))}
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-border/40 pt-1 font-medium text-text-primary">
                    {t('rx_plan_duration_value')
                      .replace('{days}', String(rxPlanDays))
                      .replace('{end}', rxPlanEnd)}
                  </p>
                </div>
              ))}

            <Field label={t('rx_phases_hint')}>
              <div className="space-y-2">
                {draft.rxPhases.map((phase, pi) => (
                  <div
                    key={pi}
                    className="space-y-2 rounded-lg border border-border bg-background p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {t('rx_phase')} {pi + 1}
                      </span>
                      {draft.rxPhases.length > 1 && (
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
                        <DecimalInput
                          value={phase.amount}
                          min={0.01}
                          onChange={amount => updatePhase(pi, { amount })}
                          className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                        <span>{t('rx_unit')}</span>
                        <select
                          value={phase.unit}
                          onChange={e =>
                            updatePhase(pi, { unit: e.target.value as DoseUnit })
                          }
                          className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
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
                              days: Math.max(
                                1,
                                Math.min(365, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-16 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                        />
                      </label>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-medium uppercase text-text-muted">
                        {t('rx_schedule_mode')}
                      </span>
                      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                        {(['fixed', 'interval'] as RxScheduleMode[]).map(mode => {
                          const active = resolvePhaseScheduleMode(phase) === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (mode === 'interval') {
                                  const everyHours =
                                    phase.everyHours && phase.everyHours >= 1
                                      ? phase.everyHours
                                      : 8;
                                  const startTime = phase.startTime || phase.times[0] || '08:00';
                                  updatePhase(pi, {
                                    scheduleMode: 'interval',
                                    everyHours,
                                    startTime,
                                    times: expandIntervalTimes(startTime, everyHours),
                                  });
                                } else {
                                  updatePhase(pi, {
                                    scheduleMode: 'fixed',
                                    everyHours: null,
                                    startTime: null,
                                    times: phase.times.length ? phase.times : ['08:00'],
                                  });
                                }
                              }}
                              className={cn(
                                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                                active
                                  ? 'bg-accent-teal/15 text-accent-teal'
                                  : 'text-text-muted hover:text-text-primary'
                              )}
                            >
                              {mode === 'fixed'
                                ? t('rx_schedule_fixed')
                                : t('rx_schedule_interval')}
                            </button>
                          );
                        })}
                      </div>

                      {resolvePhaseScheduleMode(phase) === 'interval' ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                              <span>{t('rx_every_hours')}</span>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={phase.everyHours ?? 8}
                                onChange={e => {
                                  const everyHours = Math.max(
                                    1,
                                    Math.min(24, Math.floor(Number(e.target.value) || 8))
                                  );
                                  const startTime = phase.startTime || '08:00';
                                  updatePhase(pi, {
                                    scheduleMode: 'interval',
                                    everyHours,
                                    startTime,
                                    times: expandIntervalTimes(startTime, everyHours),
                                  });
                                }}
                                className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                              <span>{t('rx_interval_start')}</span>
                              <TimeInput
                                value={phase.startTime || '08:00'}
                                onChange={v => {
                                  const startTime = v || '08:00';
                                  const everyHours =
                                    phase.everyHours && phase.everyHours >= 1
                                      ? phase.everyHours
                                      : 8;
                                  updatePhase(pi, {
                                    scheduleMode: 'interval',
                                    startTime,
                                    everyHours,
                                    times: expandIntervalTimes(startTime, everyHours),
                                  });
                                }}
                                showNow={false}
                              />
                            </label>
                          </div>
                          <p className="text-[10px] text-text-muted">
                            {t('rx_interval_preview')}:{' '}
                            <span className="font-medium text-text-primary">
                              {(phase.times ?? []).join(' · ') || '—'}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium uppercase text-text-muted">
                            {t('rx_times')}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {phase.times.map((tm, ti) => (
                              <div key={ti} className="flex items-center gap-0.5">
                                <TimeInput
                                  value={tm}
                                  onChange={v => setPhaseTime(pi, ti, v || '08:00')}
                                  showNow={false}
                                  clearLabel={t('action_delete')}
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
                      )}
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
                {planDirty && (
                  <p className="flex items-start gap-1.5 rounded-md border border-accent-teal/30 bg-accent-teal/10 px-2 py-1.5 text-[11px] text-text-primary">
                    <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-accent-teal" />
                    {t('rx_apply_plan_hint')}
                  </p>
                )}
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label={t('task_date_range')}>
              <DateRangeField
                startDayId={draft.startDayId || dayId}
                endDayId={
                  draftIsHabit
                    ? draft.startDayId || dayId
                    : draft.endDayId || draft.startDayId || dayId
                }
                onChange={({ startDayId: s, endDayId: e }) => {
                  if (draftIsHabit) {
                    patchDraft({ startDayId: s, endDayId: s });
                  } else {
                    patchDraft({ startDayId: s, endDayId: e });
                  }
                }}
                endReadOnly={draftIsHabit}
                showDragStrip={!draftIsHabit}
              />
            </Field>

            {!draftIsHabit && !draftIsFinance && (
            <Field label={t('task_schedule')}>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('task_start_time')}</span>
                  <TimeInput
                    value={draft.startTime}
                    onChange={v => patchDraft({ startTime: v })}
                    nowLabel={t('time_now')}
                    clearLabel={t('task_clear_time')}
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('task_end_time')}</span>
                  <TimeInput
                    value={draft.endTime}
                    onChange={v => patchDraft({ endTime: v })}
                    minTime={
                      draft.endDayId &&
                      draft.endDayId > (draft.startDayId || dayId)
                        ? undefined
                        : draft.startTime || undefined
                    }
                    nowLabel={t('time_now')}
                    clearLabel={t('task_clear_time')}
                  />
                </label>
                {(draft.startTime || draft.endTime) && (
                  <button
                    type="button"
                    className="mb-1 text-[10px] text-text-muted hover:text-text-primary"
                    onClick={() => patchDraft({ startTime: '', endTime: '' })}
                  >
                    {t('task_clear_time')}
                  </button>
                )}
              </div>
            </Field>
            )}

          </>
        )}

        {!isRx && draftIsProjectKind && (
          <>
            <Field label={t('task_priority_label')}>
              <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => patchDraft({ priority: p.value })}
                    className={cn(
                      'rounded px-3 py-1 text-xs font-medium transition-colors',
                      draft.priority === p.value
                        ? `bg-surface ${p.color}`
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {t(p.key)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('board_filter_urgency')}>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { v: null, label: t('board_filter_all') },
                    { v: 'urgent', label: t('urgency_urgent') },
                    { v: 'not_urgent', label: t('urgency_not_urgent') },
                  ] as Array<{ v: Urgency | null; label: string }>
                ).map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => patchDraft({ urgency: opt.v })}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      draft.urgency === opt.v
                        ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                        : 'border-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('board_filter_importance')}>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { v: null, label: t('board_filter_all') },
                    { v: 'important', label: t('importance_important') },
                    { v: 'not_important', label: t('importance_not_important') },
                  ] as Array<{ v: Importance | null; label: string }>
                ).map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => patchDraft({ importance: opt.v })}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      draft.importance === opt.v
                        ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                        : 'border-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        <Field label={t('task_color')}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => patchDraft({ color: null })}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-border text-[10px] text-text-muted',
                !draft.color && 'border-accent-teal ring-1 ring-accent-teal/40'
              )}
            >
              —
            </button>
            {COLOR_SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => patchDraft({ color: c })}
                className={cn(
                  'h-7 w-7 rounded-full border-2 border-transparent',
                  draft.color === c && 'ring-2 ring-white/70 ring-offset-1 ring-offset-surface'
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        {!isRx && draftIsProjectKind && (
          <Field label={t('task_project_label')}>
            <select
              value={draft.projectId ?? ''}
              onChange={e => patchDraft({ projectId: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t('task_no_project')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <TagIcon className="h-3 w-3" />
              Tags
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
            {draft.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={`${t('action_delete')} ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeydown}
              placeholder={draft.tags.length === 0 ? t('task_tags_placeholder') : ''}
              className="min-w-[80px] flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </Field>

        <Field label={t('task_notes')}>
          <textarea
            value={draft.notes}
            onChange={e => patchDraft({ notes: e.target.value })}
            rows={5}
            placeholder={t('task_notes_placeholder')}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>

        {task.movedFrom && (
          <p className="mt-3 rounded-md border border-border bg-background p-2 text-[10px] text-text-muted">
            ↩ {t('task_moved_from')} <code className="text-text-primary">{task.movedFrom}</code>
          </p>
        )}
      </div>

      {/* Save scope — before secondary actions */}
      {dirty && (
        <div className="mt-2 shrink-0 space-y-2 border-t border-border pt-3">
          {isRx && planDirty ? (
            <>
              <p className="text-[11px] text-text-muted">{t('rx_apply_plan_hint')}</p>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => void handleSave('series')}
                className="w-full gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('rx_apply_plan')}
              </Button>
            </>
          ) : isSeries ? (
            <>
              <p className="text-[11px] text-text-muted">{t('task_save_scope_hint')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void handleSave('instance')}
                  className="flex-1 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('task_save_this')}
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSave('series')}
                  className="flex-1 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('task_save_series')}
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="sm"
              disabled={saving}
              onClick={() => void handleSave('instance')}
              className="w-full gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {draftIsEventLike
                ? t('action_save_event')
                : draftIsHabit
                  ? t('action_add_habit')
                  : t('action_save')}
            </Button>
          )}
          <button
            type="button"
            className="w-full text-center text-[11px] text-text-muted hover:text-text-primary"
            onClick={() => setDraft(taskToDraft(task, dayId))}
          >
            {t('task_discard_changes')}
          </button>
        </div>
      )}

      <div className="mt-2 flex gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={handleDuplicate} className="flex-1 gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          {t('task_duplicate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDeleteOpen(true)}
          className="flex-1 gap-1.5 border-accent-red/40 text-accent-red hover:bg-accent-red/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('action_delete')}
        </Button>
        <Button size="sm" onClick={onClose} className="gap-1.5" variant={dirty ? 'outline' : 'default'}>
          {dirty ? t('action_close') : 'OK'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        {t('task_last_updated')}:{' '}
        {format(parseISO(task.updatedAt), `EEE ${shortDateFormat} HH:mm`, { locale })}
      </p>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={open => {
          if (!open && !deleting) setConfirmDeleteOpen(false);
        }}
        title={t('task_delete_title')}
        description={t('task_delete_confirm').replace('{title}', task.title)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
    </>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
