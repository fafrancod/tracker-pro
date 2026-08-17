import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  X,
  Repeat,
  CalendarRange,
  Flame,
  Snowflake,
  Star,
  CircleDashed,
  PawPrint,
  User,
  MapPin,
  Wallet,
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
  RxScheduleMode,
  DoseUnit,
  FinanceCertainty,
  MonthlyAnchor,
} from '@core/types';
import { createBridgeMovement, getFinanceVaultSession } from '@core/lib/finance';
import { deleteFinanceMovement } from '@core/services/financeMovementService';
import { isMultiDayRecurrenceAllowed } from '@core/lib/recurrence';
import { isLastCalendarDayOfMonth } from '@core/lib/chileHolidays';
import {
  expandIntervalTimes,
  isEventKind,
  isPossibleEventKind,
  isRxKind,
  resolvePhaseScheduleMode,
  rxPhaseDateRanges,
  rxPlanEndDayId,
  totalRxPlanDays,
  validateRxPhases,
} from '@core/lib/rx';
import {
  defaultHabitColor,
  isHabitKind,
} from '@core/lib/habits';
import { HabitPomodoroSection } from './HabitPomodoroSection';
import {
  defaultFinanceColor,
  isFinanceKind,
} from '@core/lib/financeKinds';
import {
  defaultCurrencyFromLocale,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from '@core/lib/currencies';
import { kindSupportsSteps } from '@core/lib/steps';
import { useSettings } from '@/contexts/SettingsContext';
import {
  contactHandles,
  extractHashtags,
  extractMentions,
  mergeTags,
  normalizeTag,
} from '@core/lib/tags';
import type { TaskStep } from '@core/types';
import { DecimalInput } from '@/components/ui/decimal-input';
import { TimeInput } from '@/components/ui/time-input';
import { SimpleSelect } from '@/components/ui/select';
import { normalizeTimeInput } from '@core/lib/time';
import { isValidTaskTimeRange } from '@core/lib/schedule';
import { useStore } from '@core/store';
import { useToast } from '@/contexts/ToastContext';
import { ApiClientError } from '@core/lib/api';
import { InvolvedContactsPicker } from './InvolvedContactsPicker';
import { TaskStepsEditor } from './TaskStepsEditor';
import { TaskImagesField } from './TaskImagesField';
import { DateRangeField } from './DateRangeField';
import { TaskKindPicker } from './TaskKindPicker';
import { AddTaskFormLayout } from './AddTaskFormLayout';

const DEFAULT_RX_PHASE: RxPhase = {
  amount: 1,
  unit: 'pills',
  days: 7,
  scheduleMode: 'fixed',
  times: ['08:00'],
  everyHours: null,
  startTime: null,
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
  /** Kind inicial (p. ej. rx_human al abrir desde pestaña Recetario). */
  initialKind?: TaskKind;
  /** Hora de inicio pre-rellenada (doble clic en grilla horaria). */
  initialStartTime?: string;
  /** Hora de fin pre-rellenada (por defecto start+1h si hay initialStartTime). */
  initialEndTime?: string;
  onCancel?: () => void;
}

function defaultEndFromStart(start: string): string {
  const m = start.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + 60;
  const capped = Math.min(total, 23 * 60 + 59);
  const h = Math.floor(capped / 60);
  const min = capped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function AddTaskForm({
  projects,
  onAdd,
  startOpen = false,
  startDayId,
  variant = 'compact',
  initialKind = 'task',
  initialStartTime = '',
  initialEndTime,
  onCancel,
}: AddTaskFormProps) {
  const { t } = useT();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const resolvedInitialEnd =
    initialEndTime ?? (initialStartTime ? defaultEndFromStart(initialStartTime) : '');
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectCategoryId, setProjectCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [monthlyAnchor, setMonthlyAnchor] =
    useState<MonthlyAnchor>('day_of_month');
  const [useBusinessDays, setUseBusinessDays] = useState(false);
  const [lastDayPrompt, setLastDayPrompt] = useState(false);
  const [formStartDayId, setFormStartDayId] = useState(startDayId ?? '');
  const [endDayId, setEndDayId] = useState(startDayId ?? '');
  const [kind, setKind] = useState<TaskKind>(initialKind);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [importance, setImportance] = useState<Importance | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(resolvedInitialEnd);
  const [rxSubject, setRxSubject] = useState('');
  const [rxPhases, setRxPhases] = useState<RxPhase[]>([
    {
      ...DEFAULT_RX_PHASE,
      times: [initialStartTime && /^\d{2}:\d{2}$/.test(initialStartTime) ? initialStartTime : '08:00'],
    },
  ]);
  const [involvedContactIds, setInvolvedContactIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [financeAmount, setFinanceAmount] = useState(0);
  const [financeCurrency, setFinanceCurrency] = useState(() =>
    normalizeCurrencyCode(
      settings.preferredCurrency,
      defaultCurrencyFromLocale(
        typeof navigator !== 'undefined' ? navigator.language : 'es'
      )
    )
  );
  const [financeCertainty, setFinanceCertainty] =
    useState<FinanceCertainty>('fixed');
  const [entailsMoney, setEntailsMoney] = useState(false);
  const [financeFlow, setFinanceFlow] = useState<'income' | 'expense'>('expense');
  const [pomodoroTarget, setPomodoroTarget] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const isRx = isRxKind(kind);
  const isPossible = isPossibleEventKind(kind);
  const isEvent = isEventKind(kind);
  const isEventLike = isPossible || isEvent;
  const isHabit = isHabitKind(kind);
  const isFinance = isFinanceKind(kind);
  const canEntailMoney = !isFinance && !isHabit && !isRx;
  const supportsSteps = kindSupportsSteps(kind);
  /** Lugar: tarea, recordatorio, evento y evento posible. */
  const supportsLocation =
    kind === 'task' ||
    kind === 'reminder' ||
    kind === 'event' ||
    kind === 'possible_event';
  const tasksByDay = useStore(s => s.tasksByDay);
  const contacts = useStore(s => s.contacts);

  /** Handles @ del Círculo + tags/mascotas ya usados en el store. */
  const mentionSuggestions = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of contacts) {
      for (const h of contactHandles(c)) {
        set.set(h.toLocaleLowerCase(), h);
      }
    }
    for (const days of Object.values(tasksByDay)) {
      for (const list of Object.values(days)) {
        for (const task of list) {
          if (task.kind === 'rx_pet' && task.rx?.subject) {
            const n = normalizeTag(task.rx.subject);
            if (n) set.set(n.toLocaleLowerCase(), n);
          }
          for (const tag of task.tags ?? []) {
            const n = normalizeTag(tag);
            if (n) set.set(n.toLocaleLowerCase(), n);
          }
        }
      }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [contacts, tasksByDay]);

  const rxPlanDays = useMemo(() => totalRxPlanDays(rxPhases), [rxPhases]);
  const rxEndDayId = useMemo(() => {
    if (!formStartDayId || !isRx) return '';
    return rxPlanEndDayId(formStartDayId, rxPhases);
  }, [formStartDayId, isRx, rxPhases]);
  const rxPhaseRanges = useMemo(() => {
    if (!formStartDayId || !isRx) return [];
    return rxPhaseDateRanges(formStartDayId, rxPhases);
  }, [formStartDayId, isRx, rxPhases]);

  useEffect(() => {
    if (startDayId) {
      setFormStartDayId(startDayId);
      setEndDayId(prev => (prev && prev >= startDayId ? prev : startDayId));
    }
  }, [startDayId]);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  // Hábitos: por defecto repetición diaria (casilla cada día).
  useEffect(() => {
    if (isHabitKind(kind) && recurrenceFrequency === 'none') {
      setRecurrenceFrequency('daily');
    }
  }, [kind, recurrenceFrequency]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const isMultiDay = Boolean(
    formStartDayId && endDayId && endDayId > formStartDayId
  );
  const recurrenceOptions = useMemo(
    () => (isMultiDay ? SPAN_RECURRENCE : ALL_RECURRENCE),
    [isMultiDay]
  );

  useEffect(() => {
    if (isMultiDay && !isMultiDayRecurrenceAllowed(recurrenceFrequency)) {
      setRecurrenceFrequency('none');
    }
  }, [isMultiDay, recurrenceFrequency]);

  // Si eliges mensual y el día es el último del mes → ofrecer "último día"
  useEffect(() => {
    if (
      recurrenceFrequency === 'monthly' &&
      formStartDayId &&
      isLastCalendarDayOfMonth(formStartDayId) &&
      monthlyAnchor === 'day_of_month' &&
      !useBusinessDays
    ) {
      setLastDayPrompt(true);
    } else if (recurrenceFrequency !== 'monthly') {
      setLastDayPrompt(false);
    }
  }, [
    recurrenceFrequency,
    formStartDayId,
    monthlyAnchor,
    useBusinessDays,
  ]);

  useEffect(() => {
    if (!useBusinessDays) return;
    if (
      monthlyAnchor !== 'first_business' &&
      monthlyAnchor !== 'last_business'
    ) {
      setMonthlyAnchor('last_business');
    }
  }, [useBusinessDays, monthlyAnchor]);

  function resetForm() {
    setTitle('');
    setProjectId(null);
    setProjectCategoryId(null);
    setPriority('medium');
    setRecurrenceFrequency('none');
    setRecurrenceInterval(1);
    setKind(initialKind);
    setUrgency(null);
    setImportance(null);
    setColor(null);
    setStartTime(initialStartTime);
    setEndTime(resolvedInitialEnd);
    setRxSubject('');
    setRxPhases([
      {
        ...DEFAULT_RX_PHASE,
        times: [
          initialStartTime && /^\d{2}:\d{2}$/.test(initialStartTime)
            ? initialStartTime
            : '08:00',
        ],
      },
    ]);
    setInvolvedContactIds([]);
    setLocation('');
    setDepartureTime('');
    setSteps([]);
    setImages([]);
    setFinanceAmount(0);
    setPomodoroTarget(0);
    setFinanceCertainty('fixed');
    setEntailsMoney(false);
    setFinanceFlow('expense');
    setFinanceCurrency(
      normalizeCurrencyCode(
        settings.preferredCurrency,
        defaultCurrencyFromLocale(
          typeof navigator !== 'undefined' ? navigator.language : 'es'
        )
      )
    );
    setRecurrenceFrequency('none');
    setRecurrenceInterval(1);
    setMonthlyAnchor('day_of_month');
    setUseBusinessDays(false);
    setLastDayPrompt(false);
    if (startDayId) {
      setFormStartDayId(startDayId);
      setEndDayId(startDayId);
    }
  }

  function toggleInvolvedContact(id: string) {
    setInvolvedContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function updatePhase(index: number, patch: Partial<RxPhase>) {
    setRxPhases(prev =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function addPhase() {
    setRxPhases(prev => [
      ...prev,
      {
        amount: 1,
        unit: 'pills' as DoseUnit,
        days: 7,
        scheduleMode: 'fixed',
        times: ['08:00'],
        everyHours: null,
        startTime: null,
      },
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
    if (!trimmed) return;

    if (isRxKind(kind)) {
      const err = validateRxPhases(rxPhases);
      if (err) {
        showToast(err, 'error');
        return;
      }
      const subject = rxSubject.trim() || null;
      const tags = mergeTags(
        [],
        extractHashtags(trimmed),
        extractMentions(trimmed),
        extractMentions(subject ?? ''),
        kind === 'rx_pet' && subject ? subject : null
      );
      const payload = {
        title: trimmed,
        projectId: null,
        priority: 'high' as const,
        kind,
        urgency: 'urgent' as const,
        importance: 'important' as const,
        color,
        notes: notesFromRx(subject ?? '', rxPhases),
        rxPhases,
        rxSubject: subject,
        tags,
        startDayId: formStartDayId || startDayId,
        images: images.length > 0 ? images : undefined,
      };
      // Fase 4.1: toast + reset al instante; red en background.
      resetForm();
      showToast(t('task_saved_ok'), 'success');
      inputRef.current?.focus();
      void Promise.resolve(onAdd(payload)).catch(err => {
        showToast(formatCreateError(err), 'error');
      });
      return;
    }

    const startForCreate = formStartDayId || startDayId;
    const safeEnd = isHabit
      ? startForCreate
      : startForCreate && endDayId && endDayId >= startForCreate
        ? endDayId
        : startForCreate;
    let frequency = isHabit && recurrenceFrequency === 'none' ? 'daily' : recurrenceFrequency;
    if (
      !isHabit &&
      safeEnd &&
      startForCreate &&
      safeEnd > startForCreate &&
      !isMultiDayRecurrenceAllowed(frequency)
    ) {
      frequency = 'none';
    }

    const contactTagHandles = isEventLike
      ? contacts
          .filter(c => involvedContactIds.includes(c.id))
          .flatMap(c => contactHandles(c))
      : [];
    const tags = mergeTags(
      [],
      extractHashtags(trimmed),
      extractMentions(trimmed),
      contactTagHandles
    );
    const startN =
      isHabit || isFinance ? null : normalizeTimeInput(startTime);
    const endN = isHabit || isFinance ? null : normalizeTimeInput(endTime);
    const depN = normalizeTimeInput(departureTime);
    // Multi-día: se permite 20:00 → 03:00 (cruce de medianoche). Finanzas: sin hora.
    if (
      !isHabit &&
      !isFinance &&
      !isValidTaskTimeRange(startN, endN, startForCreate, safeEnd)
    ) {
      showToast(t('task_time_range_error'), 'error');
      return;
    }

    let financeMovementId: string | undefined;
    let linkedFinance: CreateTaskPayload['linkedFinance'];
    if (canEntailMoney && entailsMoney) {
      const vault = getFinanceVaultSession();
      if (!vault) {
        showToast(t('task_entails_money_need_vault'), 'error');
        return;
      }
      if (!startForCreate) {
        showToast(t('task_time_range_error'), 'error');
        return;
      }
      if (!(financeAmount > 0)) {
        showToast(t('fin_amount_required'), 'error');
        return;
      }
      try {
        const created = await createBridgeMovement({
          dayId: startForCreate,
          title: trimmed,
          amount: financeAmount,
          currency: financeCurrency,
          certainty: financeCertainty,
          flow: financeFlow,
          vault,
        });
        financeMovementId = created.id;
        linkedFinance = created.linked;
      } catch {
        showToast(t('fin_save_error'), 'error');
        return;
      }
    }

    const payload = {
      title: trimmed,
      projectId: isEventLike || isHabit || isFinance ? null : projectId,
      projectCategoryId:
        isEventLike || isHabit || isFinance ? null : projectCategoryId,
      priority,
      startDayId: startForCreate,
      endDayId: safeEnd,
      recurrenceFrequency: frequency,
      recurrenceInterval: frequency === 'none' ? 1 : recurrenceInterval,
      recurrenceMonthlyAnchor:
        frequency === 'monthly' ? monthlyAnchor : undefined,
      kind,
      urgency: isEventLike || isHabit || isFinance ? null : urgency,
      importance: isEventLike || isHabit || isFinance ? null : importance,
      color:
        color ??
        (isEvent
          ? '#58a6ff'
          : isPossible
            ? '#a371f7'
            : isHabit
              ? defaultHabitColor(kind)
              : isFinance
                ? defaultFinanceColor(kind)
                : null),
      startTime: startN,
      endTime: endN,
      tags,
      involvedContactIds: isEventLike ? involvedContactIds : [],
      location: supportsLocation ? location.trim() || null : null,
      departureTime: isEvent ? depN : null,
      steps: supportsSteps
        ? steps
            .map(s => ({
              ...s,
              title: s.title.trim(),
            }))
            .filter(s => s.title.length > 0)
        : undefined,
      images: images.length > 0 ? images : undefined,
      finance: isFinance
        ? {
            amount: financeAmount,
            currency: financeCurrency,
            certainty: financeCertainty,
          }
        : undefined,
      financeMovementId,
      linkedFinance,
      pomodoroTarget: isHabit ? pomodoroTarget : undefined,
    };
    // Fase 4.1: toast + reset al instante; red en background.
    resetForm();
    showToast(t('task_saved_ok'), 'success');
    inputRef.current?.focus();
    void Promise.resolve(onAdd(payload)).catch(err => {
      if (financeMovementId) {
        void deleteFinanceMovement(financeMovementId).catch(() => undefined);
      }
      showToast(formatCreateError(err), 'error');
    });
  }

  function formatCreateError(err: unknown): string {
    if (err instanceof ApiClientError) {
      if (err.code === 'plan_limit_reached') {
        return err.message || 'Has alcanzado el límite de tu plan.';
      }
      if (err.status === 400) {
        return err.message || 'Datos de la tarea no válidos.';
      }
      // Mensajes típicos de columna ausente en Supabase
      if (/column|schema cache|does not exist|PGRST/i.test(err.message)) {
        return 'Error de base de datos al guardar. Puede faltar una migración SQL en Supabase.';
      }
      return err.message || 'No se pudo guardar la tarea.';
    }
    if (err instanceof Error && err.message) return err.message;
    return 'No se pudo guardar la tarea.';
  }

  function notesFromRx(subject: string, phases: RxPhase[]): string {
    const lines = phases.map((p, i) => {
      const unit = p.unit === 'ml' ? 'ml' : 'past.';
      const mode = resolvePhaseScheduleMode(p);
      const schedule =
        mode === 'interval' && p.everyHours && p.startTime
          ? `cada ${p.everyHours}h desde ${p.startTime} (${(p.times ?? []).join(', ')})`
          : (p.times ?? []).join(', ');
      return `Fase ${i + 1}: ${p.amount} ${unit} · ${schedule} · ${p.days}d`;
    });
    if (subject.trim()) lines.unshift(`Para: ${subject.trim()}`);
    return lines.join('\n');
  }

  function setPhaseScheduleMode(index: number, mode: RxScheduleMode) {
    setRxPhases(prev =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (mode === 'interval') {
          const everyHours = p.everyHours && p.everyHours >= 1 ? p.everyHours : 8;
          const startTime = p.startTime || p.times[0] || '08:00';
          return {
            ...p,
            scheduleMode: 'interval',
            everyHours,
            startTime,
            times: expandIntervalTimes(startTime, everyHours),
          };
        }
        return {
          ...p,
          scheduleMode: 'fixed',
          everyHours: null,
          startTime: null,
          times: p.times.length ? p.times : ['08:00'],
        };
      })
    );
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
          ? 'gap-0'
          : 'gap-2 rounded-md border border-border bg-surface p-2'
      )}
    >
      {isModal && (
        <div
          className="mb-4 h-1 w-full rounded-full bg-border transition-colors"
          style={color ? { backgroundColor: color } : undefined}
          aria-hidden
        />
      )}

      <AddTaskFormLayout
        isModal={isModal}
        classifyTitle={t('task_board_classify')}
        whenTitle={t('task_board_when')}
        moreTitle={t('task_board_more')}
        kind={
          <div
            data-tour={isModal ? 'create-kind' : undefined}
            className={cn(isModal && 'space-y-1.5')}
          >
        {isModal && (
          <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('task_kind_convert')}
          </label>
        )}
        <TaskKindPicker
          value={kind}
          onChange={setKind}
          compact={!isModal}
          defaultOpen={isModal && !startOpen}
        />
          </div>
        }
        finance={
          isFinance || canEntailMoney ? (
        <div
          className={cn(
            'space-y-2 rounded-xl border border-border bg-field',
            isModal ? 'p-3' : 'p-2'
          )}
        >
          {canEntailMoney && (
            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={entailsMoney}
                onChange={e => setEntailsMoney(e.target.checked)}
              />
              <Wallet className="h-3.5 w-3.5 text-accent-teal" />
              {t('task_entails_money')}
            </label>
          )}
          {(isFinance || entailsMoney) && (
            <>
          <p className="text-[10px] text-text-muted">
            {isFinance ? t('task_finance_hint') : t('task_entails_money_hint')}
          </p>
          {entailsMoney && !isFinance && (
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('fin_field_flow')}</span>
              <SimpleSelect
                value={financeFlow}
                onChange={value =>
                  setFinanceFlow(value === 'income' ? 'income' : 'expense')
                }
                className="h-9 rounded-lg border border-border bg-field px-2 text-xs text-text-primary"
                options={[
                  { value: 'expense', label: t('fin_flow_expense') },
                  { value: 'income', label: t('fin_flow_income') },
                ]}
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('fin_field_amount')}</span>
              <DecimalInput
                value={financeAmount}
                onChange={setFinanceAmount}
                min={0}
                max={1_000_000_000}
                className="h-9 rounded-lg border border-border bg-field px-2 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('fin_field_currency')}</span>
              <SimpleSelect
                value={financeCurrency}
                onChange={setFinanceCurrency}
                className="h-9 rounded-lg border border-border bg-field px-2 text-xs text-text-primary"
                options={SUPPORTED_CURRENCIES.map(currency => ({
                  value: currency.code,
                  label: currency.label,
                }))}
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
            <span>{t('task_finance_certainty')}</span>
            <SimpleSelect
              value={financeCertainty}
              onChange={value => setFinanceCertainty(value as FinanceCertainty)}
              className="h-9 rounded-lg border border-border bg-field px-2 text-xs text-text-primary"
              options={[
                { value: 'fixed', label: t('task_finance_fixed') },
                { value: 'potential', label: t('task_finance_potential') },
              ]}
            />
          </label>
            </>
          )}
        </div>
          ) : null
        }
        title={
      <div
        data-tour={isModal ? 'create-title' : undefined}
        className={cn(isModal && 'space-y-1.5')}
      >
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
              : isEvent
                ? t('task_event_placeholder')
                : isPossible
                  ? t('task_possible_event_placeholder')
                  : kind === 'habit_good'
                    ? t('task_habit_placeholder')
                    : kind === 'habit_quit'
                      ? t('task_habit_quit_placeholder')
                      : kind === 'reminder'
                        ? t('task_reminder_placeholder')
                        : t('task_title_placeholder')
          }
          list="circle-mention-suggestions"
          className={cn(
            isModal
              ? 'h-14 rounded-2xl border-border bg-field px-4 text-lg font-semibold tracking-tight focus-visible:ring-accent-teal/40'
              : 'h-8 border-none bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0'
          )}
        />
        {mentionSuggestions.length > 0 && (
          <datalist id="circle-mention-suggestions">
            {mentionSuggestions.map(tag => (
              <option key={tag} value={`@${tag}`} />
            ))}
          </datalist>
        )}
        {isModal && (
          <p className="text-[10px] text-text-muted">{t('circle_mention_hint')}</p>
        )}
      </div>
        }
        rx={
      isRx ? (
        <div className="space-y-3 rounded-xl border border-border bg-field p-3">
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
              list="circle-subject-suggestions"
            />
            {mentionSuggestions.length > 0 && (
              <datalist id="circle-subject-suggestions">
                {mentionSuggestions
                  .filter(tag => {
                    if (kind !== 'rx_pet' && kind !== 'rx_human') return true;
                    const contact = contacts.find(c =>
                      contactHandles(c).some(
                        h => h.toLocaleLowerCase() === tag.toLocaleLowerCase()
                      )
                    );
                    if (!contact) return true;
                    return kind === 'rx_pet'
                      ? contact.kind === 'pet'
                      : contact.kind === 'person';
                  })
                  .map(tag => (
                    <option key={tag} value={tag} />
                  ))}
              </datalist>
            )}
            <p className="text-[10px] text-text-muted">
              {kind === 'rx_pet' ? t('rx_pet_tag_hint') : t('circle_mention_hint')}
            </p>
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
                  <DecimalInput
                    value={phase.amount}
                    min={0.01}
                    onChange={amount => updatePhase(pi, { amount })}
                    className="w-20 rounded border border-border bg-field px-2 py-1.5 text-xs text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                  <span>{t('rx_unit')}</span>
                  <SimpleSelect
                    value={phase.unit}
                    onChange={value => updatePhase(pi, { unit: value as DoseUnit })}
                    className="rounded border border-border bg-field px-2 py-1.5 text-xs text-text-primary"
                    options={[
                      { value: 'pills', label: t('rx_unit_pills') },
                      { value: 'ml', label: t('rx_unit_ml') },
                    ]}
                  />
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
                    className="w-16 rounded border border-border bg-field px-2 py-1.5 text-xs text-text-primary"
                  />
                </label>
              </div>
              {/* Horarios: fijos O cada N horas */}
              <div className="space-y-2">
                <span className="text-[10px] font-medium uppercase text-text-muted">
                  {t('rx_schedule_mode')}
                </span>
                <div className="inline-flex rounded-lg border border-border bg-field p-0.5">
                  {(['fixed', 'interval'] as RxScheduleMode[]).map(mode => {
                    const active = resolvePhaseScheduleMode(phase) === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPhaseScheduleMode(pi, mode)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                          active
                            ? 'bg-accent-teal/15 text-accent-teal'
                            : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        {mode === 'fixed' ? t('rx_schedule_fixed') : t('rx_schedule_interval')}
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
                          className="w-20 rounded border border-border bg-field px-2 py-1.5 text-xs text-text-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
                        <span>{t('rx_interval_start')}</span>
                        <TimeInput
                          value={phase.startTime || '08:00'}
                          onChange={v => {
                            const startTime = v || '08:00';
                            const everyHours = phase.everyHours && phase.everyHours >= 1 ? phase.everyHours : 8;
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
        </div>
      ) : null
        }
        classify={
      !isRx && !isEventLike && !isHabit && !isFinance ? (
        <>
          <div className={cn('flex flex-wrap items-center gap-2', isModal && 'gap-3')}>
            <SimpleSelect
              value={projectId ?? ''}
              onChange={value => {
                const next = value || null;
                setProjectId(next);
                setProjectCategoryId(null);
              }}
              className={cn(
                'min-w-0 flex-1 rounded-lg border border-border bg-field text-text-primary focus:outline-none focus:ring-1 focus:ring-ring',
                isModal ? 'px-3 py-2.5 text-sm' : 'px-1.5 py-1 text-xs rounded border'
              )}
              options={[
                { value: '', label: t('task_no_project') },
                ...projects.map(project => ({
                  value: project.id,
                  label: `${project.icon} ${project.name}`,
                })),
              ]}
            />

            {(() => {
              const selectedProject = projects.find(p => p.id === projectId);
              const cats = selectedProject?.categories ?? [];
              if (!projectId || cats.length === 0) return null;
              return (
                <SimpleSelect
                  value={projectCategoryId ?? ''}
                  onChange={value => setProjectCategoryId(value || null)}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border border-border bg-field text-text-primary focus:outline-none focus:ring-1 focus:ring-ring',
                    isModal ? 'px-3 py-2.5 text-sm' : 'px-1.5 py-1 text-xs rounded border'
                  )}
                  options={[
                    { value: '', label: t('task_no_category') },
                    ...cats.map(c => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              );
            })()}

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
        </>
      ) : null
        }
        more={
          <>
      {supportsSteps ? (
        <TaskStepsEditor steps={steps} onChange={setSteps} />
      ) : null}

      {/* Imágenes adjuntas (drag & drop o selector del SO) */}
      <TaskImagesField
        images={images}
        onChange={setImages}
        compact={!isModal}
      />

      {/* Lugar (tarea / recordatorio / evento / posible) + salida solo en evento real */}
      {supportsLocation && (
        <div
          className={cn(
            isModal ? 'space-y-3' : 'space-y-3 rounded-xl border p-3',
            !isModal && isEvent
              ? 'border-sky-500/30 bg-sky-500/5'
              : !isModal && isPossible
                ? 'border-fuchsia-500/30 bg-fuchsia-500/5'
                : !isModal
                  ? 'border-border bg-field'
                  : undefined
          )}
        >
          <label className="flex flex-col gap-1 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
              <MapPin className="h-3 w-3" />
              {isEvent
                ? t('task_event_location')
                : isPossible
                  ? t('task_possible_event_location')
                  : t('task_location')}
            </span>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={
                isEvent
                  ? t('task_event_location_ph')
                  : isPossible
                    ? t('task_possible_event_location_ph')
                    : t('task_location_ph')
              }
              maxLength={200}
              className="h-9 text-sm"
            />
          </label>
          {isEvent && (
            <label className="flex flex-col gap-1 text-[11px] text-text-muted">
              <span className="font-medium uppercase tracking-wide">
                {t('task_event_departure')}
              </span>
              <TimeInput
                value={departureTime}
                onChange={setDepartureTime}
                nowLabel={t('time_now')}
                clearLabel={t('task_clear_time')}
              />
              <span className="text-[10px]">{t('task_event_departure_hint')}</span>
            </label>
          )}
        </div>
      )}

      {/* Evento / evento posible: contactos del Círculo con filtros */}
      {isEventLike && (
        <div
          className={cn(
            isModal ? 'space-y-1.5' : 'space-y-1.5 rounded-xl border p-3',
            !isModal && isEvent
              ? 'border-sky-500/30 bg-sky-500/5'
              : !isModal
                ? 'border-fuchsia-500/30 bg-fuchsia-500/5'
                : undefined
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('task_involved_contacts')}
          </p>
          <p className="text-[10px] text-text-muted">{t('task_involved_contacts_hint')}</p>
          <InvolvedContactsPicker
            contacts={contacts}
            selectedIds={involvedContactIds}
            onToggle={toggleInvolvedContact}
            accent={isEvent ? 'event' : 'possible'}
          />
          {involvedContactIds.length === 0 && contacts.length > 0 && (
            <p className="text-[10px] text-text-muted">{t('task_involved_none')}</p>
          )}
        </div>
      )}

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
          </>
        }
        when={
          <>
      {(formStartDayId || startDayId) &&
        (isRx ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-xl border border-border bg-field',
              isModal ? 'px-3 py-3' : 'px-2 py-1.5 rounded border'
            )}
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('rx_plan_start')}</span>
              <input
                type="date"
                value={formStartDayId}
                onChange={e => {
                  const next = e.target.value || formStartDayId;
                  setFormStartDayId(next);
                  setEndDayId(next);
                }}
                className="rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={t('rx_plan_start')}
              />
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('rx_plan_duration')}</span>
              <div className="rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-text-primary">
                {rxPlanDays <= 0 || rxPhaseRanges.length === 0 ? (
                  <p>—</p>
                ) : rxPhaseRanges.length === 1 ? (
                  <p>
                    {t('rx_plan_duration_value')
                      .replace('{days}', String(rxPlanDays))
                      .replace('{end}', rxEndDayId)}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {rxPhaseRanges.map(r => (
                      <li key={r.phaseIndex}>
                        {t('rx_phase_date_range')
                          .replace('{n}', String(r.phaseIndex + 1))
                          .replace('{start}', r.startDayId)
                          .replace('{end}', r.endDayId)
                          .replace('{days}', String(r.days))}
                      </li>
                    ))}
                    <li className="border-t border-border/50 pt-1 font-medium text-text-primary">
                      {t('rx_plan_duration_value')
                        .replace('{days}', String(rxPlanDays))
                        .replace('{end}', rxEndDayId)}
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : isHabit ? (
          <>
            <DateRangeField
              startDayId={formStartDayId}
              endDayId={formStartDayId}
              onChange={({ startDayId: s }) => {
                setFormStartDayId(s);
                setEndDayId(s);
              }}
              endReadOnly
              showDragStrip={false}
              compact={!isModal}
            />
            <HabitPomodoroSection
              target={pomodoroTarget}
              planOnly
              onTargetChange={setPomodoroTarget}
            />
          </>
        ) : (
          <DateRangeField
            startDayId={formStartDayId}
            endDayId={endDayId || formStartDayId}
            onChange={({ startDayId: s, endDayId: e }) => {
              setFormStartDayId(s);
              setEndDayId(e);
            }}
            compact={!isModal}
            showDragStrip={isModal}
          />
        ))}

      {/* Schedule times — no aplica a recetario, hábitos ni finanzas */}
      <div
        className={cn(
          'flex flex-wrap items-end gap-2',
          isModal && 'gap-3',
          (isRx || isHabit || isFinance) && 'hidden'
        )}
      >
        <label className="flex min-w-0 flex-col gap-0.5 text-[10px] text-text-muted">
          <span>{t('task_start_time')}</span>
          <TimeInput
            value={startTime}
            onChange={setStartTime}
            nowLabel={t('time_now')}
            clearLabel={t('task_clear_time')}
            aria-label={t('task_start_time')}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-0.5 text-[10px] text-text-muted">
          <span>{t('task_end_time')}</span>
          <TimeInput
            value={endTime}
            onChange={setEndTime}
            minTime={isMultiDay ? undefined : startTime || undefined}
            nowLabel={t('time_now')}
            clearLabel={t('task_clear_time')}
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
          'space-y-2 rounded-xl border border-border bg-field',
          isModal ? 'px-3 py-3' : 'px-2 py-1.5 rounded border',
          isRx && 'hidden'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Repeat className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <SimpleSelect
            value={recurrenceFrequency}
            onChange={value => {
              const next = value as RecurrenceFrequency;
              setRecurrenceFrequency(next);
              if (next !== 'monthly') {
                setMonthlyAnchor('day_of_month');
                setUseBusinessDays(false);
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={t('task_repeat')}
            options={recurrenceOptions.map(option => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />

          {recurrenceFrequency !== 'none' && (
            <label className="flex items-center gap-1 text-xs text-text-muted">
              <span>{t('task_repeat_every')}</span>
              <input
                type="number"
                min={1}
                max={365}
                value={recurrenceInterval}
                onChange={e =>
                  setRecurrenceInterval(
                    Math.max(1, Math.min(365, Number(e.target.value) || 1))
                  )
                }
                className="w-12 rounded-lg border border-border bg-field px-1 py-1 text-center text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
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

        {recurrenceFrequency === 'monthly' && (
          <div className="space-y-2 border-t border-border/50 pt-2">
            {lastDayPrompt && !useBusinessDays && (
              <div className="rounded-lg border border-accent-teal/30 bg-accent-teal/10 px-2.5 py-2 text-[11px] text-text-primary">
                <p className="font-medium">{t('task_repeat_last_day_prompt')}</p>
                <p className="mt-0.5 text-text-muted">
                  {t('task_repeat_last_day_prompt_hint')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-accent-teal/20 px-2.5 py-1 text-[11px] font-semibold text-accent-teal"
                    onClick={() => {
                      setMonthlyAnchor('last_day');
                      setLastDayPrompt(false);
                    }}
                  >
                    {t('task_repeat_use_last_day')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary"
                    onClick={() => {
                      setMonthlyAnchor('day_of_month');
                      setLastDayPrompt(false);
                    }}
                  >
                    {t('task_repeat_keep_day_n')}
                  </button>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={useBusinessDays}
                onChange={e => {
                  const on = e.target.checked;
                  setUseBusinessDays(on);
                  setLastDayPrompt(false);
                  if (on) setMonthlyAnchor('last_business');
                  else setMonthlyAnchor('day_of_month');
                }}
                className="rounded border-border"
              />
              <span>{t('task_repeat_business_days')}</span>
            </label>
            <p className="text-[10px] text-text-muted">
              {t('task_repeat_business_days_hint')}
            </p>

            {useBusinessDays ? (
              <SimpleSelect
                value={
                  monthlyAnchor === 'first_business' ||
                  monthlyAnchor === 'last_business'
                    ? monthlyAnchor
                    : 'last_business'
                }
                onChange={value => setMonthlyAnchor(value as MonthlyAnchor)}
                className="w-full rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-text-primary"
                options={[
                  { value: 'first_business', label: t('task_repeat_first_business') },
                  { value: 'last_business', label: t('task_repeat_last_business') },
                ]}
              />
            ) : (
              monthlyAnchor === 'last_day' && (
                <p className="text-[11px] font-medium text-accent-teal">
                  ✓ {t('task_repeat_use_last_day')}
                </p>
              )
            )}
          </div>
        )}
      </div>

      {isMultiDay && (
        <p className="px-0.5 text-[10px] text-text-muted">{t('task_span_recurrence_hint')}</p>
      )}
          </>
        }
        actions={
      <div
        className={cn(
          'flex items-center justify-end gap-2',
          isModal && 'sticky bottom-0 z-10 border-t border-border bg-field pt-4'
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
          data-tour={isModal ? 'create-save' : undefined}
          className={cn(
            isModal && 'min-w-[140px] rounded-xl bg-accent-teal text-background hover:bg-accent-teal/90',
            !isModal && 'h-7 px-2 text-xs'
          )}
          disabled={!title.trim()}
        >
          {isEventLike
            ? t('action_save_event')
            : isHabit
              ? t('action_add_habit')
              : kind === 'reminder'
                ? t('action_add_reminder')
                : t('action_add_task')}
        </Button>
      </div>
        }
      />
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
          : 'border-border bg-field text-text-muted hover:text-text-primary'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
