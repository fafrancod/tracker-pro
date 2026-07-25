import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type {
  DoseUnit,
  RxMeta,
  RxPhase,
  RxScheduleMode,
  Task,
  TaskKind,
} from '../types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizePhaseTime(raw: string): string {
  const s = raw.trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    return normalizePhaseTime(s.slice(0, s.lastIndexOf(':')));
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return s;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function isRxKind(kind: TaskKind | string | null | undefined): boolean {
  return kind === 'rx_human' || kind === 'rx_pet';
}

export function isPossibleEventKind(kind: TaskKind | string | null | undefined): boolean {
  return kind === 'possible_event';
}

export function isEventKind(kind: TaskKind | string | null | undefined): boolean {
  return kind === 'event';
}

/** Evento confirmado o posible (no son tareas de proyecto). */
export function isAnyEventKind(kind: TaskKind | string | null | undefined): boolean {
  return kind === 'event' || kind === 'possible_event';
}

export function isProjectKind(kind: TaskKind | string | null | undefined): boolean {
  return kind === 'task' || kind === 'reminder' || !kind;
}

export function formatDose(amount: number, unit: DoseUnit): string {
  const a = Number.isFinite(amount) ? amount : 0;
  if (unit === 'ml') {
    return `${a} ml`;
  }
  const label = a === 1 ? 'pastilla' : 'pastillas';
  return `${a} ${label}`;
}

/**
 * Expande "cada N horas desde startTime" a horarios del día (máx. 12).
 * Ej. cada 8 h desde 08:00 → 08:00, 16:00, 00:00.
 */
export function expandIntervalTimes(startTime: string, everyHours: number): string[] {
  const st = normalizePhaseTime(startTime);
  if (!TIME_RE.test(st)) return [];
  const eh = Math.floor(everyHours);
  if (!Number.isFinite(eh) || eh < 1 || eh > 24) return [];

  const [h0, m0] = st.split(':').map(Number);
  const startMin = h0 * 60 + m0;
  const step = eh * 60;
  const dayMins = 24 * 60;
  const out: string[] = [];

  for (let i = 0; i < 12; i++) {
    const elapsed = i * step;
    if (elapsed >= dayMins) break;
    const mins = (startMin + elapsed) % dayMins;
    if (i > 0 && mins === startMin) break;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    out.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
}

export function resolvePhaseScheduleMode(phase: RxPhase): RxScheduleMode {
  if (phase.scheduleMode === 'interval' || phase.scheduleMode === 'fixed') {
    return phase.scheduleMode;
  }
  // Inferencia: everyHours válido y sin times → interval
  const eh = phase.everyHours;
  if (typeof eh === 'number' && eh >= 1 && (!phase.times || phase.times.length === 0)) {
    return 'interval';
  }
  return 'fixed';
}

/**
 * Normaliza una fase: en modo interval calcula times[]; en fixed limpia everyHours/startTime.
 * Mutates phase in place (como validateRxPhases ya hace con times).
 */
export function normalizeRxPhaseSchedule(phase: RxPhase, phaseLabel: string): string | null {
  const mode = resolvePhaseScheduleMode(phase);
  phase.scheduleMode = mode;

  if (mode === 'interval') {
    const eh = Math.floor(Number(phase.everyHours));
    if (!Number.isFinite(eh) || eh < 1 || eh > 24) {
      return `${phaseLabel}: indica cada cuántas horas (1–24)`;
    }
    const stRaw = phase.startTime ?? '08:00';
    if (typeof stRaw !== 'string') {
      return `${phaseLabel}: hora de inicio inválida`;
    }
    const st = normalizePhaseTime(stRaw);
    if (!TIME_RE.test(st)) {
      return `${phaseLabel}: hora de inicio inválida (${stRaw})`;
    }
    const times = expandIntervalTimes(st, eh);
    if (times.length === 0) {
      return `${phaseLabel}: no se pudieron calcular horarios con ese intervalo`;
    }
    if (times.length > 12) {
      return `${phaseLabel}: demasiadas tomas al día (máx. 12)`;
    }
    phase.everyHours = eh;
    phase.startTime = st;
    phase.times = times;
    return null;
  }

  // fixed
  phase.everyHours = null;
  phase.startTime = null;
  if (!Array.isArray(phase.times) || phase.times.length === 0) {
    return `${phaseLabel}: indica al menos un horario o usa «cada N horas»`;
  }
  if (phase.times.length > 12) {
    return `${phaseLabel}: máximo 12 horarios por día`;
  }
  for (let ti = 0; ti < phase.times.length; ti++) {
    const t = phase.times[ti];
    if (typeof t !== 'string') {
      return `${phaseLabel}: horario inválido`;
    }
    const nt = normalizePhaseTime(t);
    if (!TIME_RE.test(nt)) {
      return `${phaseLabel}: horario inválido (${t})`;
    }
    phase.times[ti] = nt;
  }
  return null;
}

export function validateRxPhases(phases: RxPhase[]): string | null {
  if (!Array.isArray(phases) || phases.length === 0) {
    return 'El recetario necesita al menos una fase';
  }
  if (phases.length > 12) {
    return 'Máximo 12 fases por recetario';
  }
  let totalDays = 0;
  let totalSessions = 0;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (!p || typeof p.amount !== 'number' || !(p.amount > 0) || p.amount > 10000) {
      return `Fase ${i + 1}: cantidad inválida`;
    }
    if (p.unit !== 'pills' && p.unit !== 'ml') {
      return `Fase ${i + 1}: unidad debe ser pastillas o ml`;
    }
    const days = Math.floor(p.days);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return `Fase ${i + 1}: días entre 1 y 365`;
    }
    p.days = days;
    const schedErr = normalizeRxPhaseSchedule(p, `Fase ${i + 1}`);
    if (schedErr) return schedErr;
    totalDays += days;
    totalSessions += days * p.times.length;
  }
  if (totalDays > 730) {
    return 'El plan no puede superar 730 días en total';
  }
  if (totalSessions > 2000) {
    return 'Demasiadas tomas materializadas (máx. 2000)';
  }
  return null;
}

export interface RxOccurrence {
  dayId: string;
  startTime: string;
  amount: number;
  unit: DoseUnit;
  phaseIndex: number;
}

/** Expande fases en una toma por (día × horario). */
export function materializeRxOccurrences(
  startDayId: string,
  phases: RxPhase[]
): RxOccurrence[] {
  const err = validateRxPhases(phases);
  if (err) throw new Error(err);

  const out: RxOccurrence[] = [];
  let dayOffset = 0;
  const start = parseISO(startDayId);

  phases.forEach((phase, phaseIndex) => {
    const days = Math.floor(phase.days);
    const times = [...phase.times].sort();
    for (let d = 0; d < days; d++) {
      const dayId = format(addDays(start, dayOffset + d), 'yyyy-MM-dd');
      for (const startTime of times) {
        out.push({
          dayId,
          startTime,
          amount: phase.amount,
          unit: phase.unit,
          phaseIndex,
        });
      }
    }
    dayOffset += days;
  });

  return out;
}

function snapshotPhase(p: RxPhase): RxPhase {
  const mode = resolvePhaseScheduleMode(p);
  return {
    amount: p.amount,
    unit: p.unit,
    days: Math.floor(p.days),
    scheduleMode: mode,
    times: [...p.times].sort(),
    everyHours: mode === 'interval' ? (p.everyHours ?? null) : null,
    startTime: mode === 'interval' ? (p.startTime ?? null) : null,
  };
}

export function buildRxMetaForOccurrence(
  planStartDayId: string,
  phases: RxPhase[],
  occ: RxOccurrence,
  subject: string | null
): RxMeta {
  return {
    subject: subject?.trim() ? subject.trim() : null,
    amount: occ.amount,
    unit: occ.unit,
    phaseIndex: occ.phaseIndex,
    planStartDayId,
    phases: phases.map(snapshotPhase),
  };
}

/** Suma de días de tratamiento del plan (todas las fases). */
export function totalRxPlanDays(phases: RxPhase[] | null | undefined): number {
  if (!phases?.length) return 0;
  return phases.reduce((s, p) => s + Math.max(0, Math.floor(p.days || 0)), 0);
}

/**
 * Día de fin inclusive del plan: start + totalDays - 1.
 * Si no hay fases, devuelve startDayId.
 */
export function rxPlanEndDayId(startDayId: string, phases: RxPhase[] | null | undefined): string {
  const total = totalRxPlanDays(phases);
  if (total <= 1) return startDayId;
  return format(addDays(parseISO(startDayId), total - 1), 'yyyy-MM-dd');
}

/** Rango de fechas (inclusive) de una fase dentro del plan. */
export interface RxPhaseDateRange {
  phaseIndex: number;
  days: number;
  startDayId: string;
  endDayId: string;
}

/**
 * Fechas de cada fase, en orden, a partir del inicio del plan.
 * Fase 0: [start, start+d0-1]; fase 1: a continuación, etc.
 */
export function rxPhaseDateRanges(
  startDayId: string,
  phases: RxPhase[] | null | undefined
): RxPhaseDateRange[] {
  if (!phases?.length) return [];
  const start = parseISO(startDayId);
  const out: RxPhaseDateRange[] = [];
  let offset = 0;
  phases.forEach((p, phaseIndex) => {
    const days = Math.max(0, Math.floor(p.days || 0));
    if (days <= 0) return;
    const phaseStart = addDays(start, offset);
    const phaseEnd = addDays(phaseStart, days - 1);
    out.push({
      phaseIndex,
      days,
      startDayId: format(phaseStart, 'yyyy-MM-dd'),
      endDayId: format(phaseEnd, 'yyyy-MM-dd'),
    });
    offset += days;
  });
  return out;
}

export function parseRxMeta(raw: unknown): RxMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.amount !== 'number' || (o.unit !== 'pills' && o.unit !== 'ml')) {
    return null;
  }
  const phases = Array.isArray(o.phases) ? (o.phases as RxPhase[]) : [];
  return {
    subject: typeof o.subject === 'string' ? o.subject : null,
    amount: o.amount,
    unit: o.unit,
    phaseIndex: typeof o.phaseIndex === 'number' ? o.phaseIndex : 0,
    planStartDayId: typeof o.planStartDayId === 'string' ? o.planStartDayId : '',
    phases,
  };
}

/** Tomas planificadas de una fase (días × horarios). */
export function plannedDosesInPhase(phase: RxPhase | null | undefined): number {
  if (!phase) return 0;
  const days = Math.max(0, Math.floor(phase.days || 0));
  const times = Array.isArray(phase.times) ? phase.times.length : 0;
  return days * times;
}

/** Tomas planificadas del plan completo. */
export function plannedDosesTotal(phases: RxPhase[] | null | undefined): number {
  if (!phases?.length) return 0;
  return phases.reduce((s, p) => s + plannedDosesInPhase(p), 0);
}

export type RxPhaseStatus = 'upcoming' | 'active' | 'done';

export interface RxPhaseProgress {
  phaseIndex: number;
  amount: number;
  unit: DoseUnit;
  days: number;
  timesPerDay: number;
  startDayId: string;
  endDayId: string;
  /** Días que faltan de la fase (0 si ya terminó; total si aún no empieza). */
  daysRemaining: number;
  /** Días transcurridos dentro de la fase (0 si no ha empezado). */
  daysElapsed: number;
  totalDoses: number;
  completedDoses: number;
  remainingDoses: number;
  status: RxPhaseStatus;
}

export interface RxTreatmentProgress {
  /** seriesId o clave estable de fallback. */
  key: string;
  seriesId: string | null;
  title: string;
  kind: 'rx_human' | 'rx_pet';
  subject: string | null;
  planStartDayId: string;
  planEndDayId: string;
  phases: RxPhase[];
  totalDoses: number;
  completedDoses: number;
  remainingDoses: number;
  /** 0–100 */
  progressPct: number;
  phaseProgress: RxPhaseProgress[];
  /** true si el plan no ha terminado o aún hay tomas pendientes. */
  isActive: boolean;
  /** Todas las tomas materializadas conocidas de este tratamiento. */
  tasks: Task[];
}

export interface RxSubjectGroup {
  /** Clave de agrupación (subject normalizado o fallback por kind). */
  subjectKey: string;
  subjectLabel: string;
  kind: 'rx_human' | 'rx_pet' | 'mixed';
  treatments: RxTreatmentProgress[];
  todayDoses: Task[];
  /** Agregado de todos los tratamientos del sujeto. */
  totalDoses: number;
  completedDoses: number;
  remainingDoses: number;
  progressPct: number;
}

function clampPct(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

function phaseDaysRemaining(
  todayId: string,
  startDayId: string,
  endDayId: string,
  totalDays: number
): { daysRemaining: number; daysElapsed: number; status: RxPhaseStatus } {
  if (!startDayId || !endDayId || totalDays <= 0) {
    return { daysRemaining: 0, daysElapsed: 0, status: 'done' };
  }
  if (todayId < startDayId) {
    return { daysRemaining: totalDays, daysElapsed: 0, status: 'upcoming' };
  }
  if (todayId > endDayId) {
    return { daysRemaining: 0, daysElapsed: totalDays, status: 'done' };
  }
  const daysRemaining =
    differenceInCalendarDays(parseISO(endDayId), parseISO(todayId)) + 1;
  const daysElapsed =
    differenceInCalendarDays(parseISO(todayId), parseISO(startDayId));
  return {
    daysRemaining: Math.max(0, daysRemaining),
    daysElapsed: Math.max(0, Math.min(totalDays, daysElapsed)),
    status: 'active',
  };
}

/** Clave estable de un tratamiento a partir de una toma. */
export function rxTreatmentKey(task: Task): string {
  if (task.seriesId) return `series:${task.seriesId}`;
  const plan = task.rx?.planStartDayId || task.endDayId || '';
  const subject = (task.rx?.subject ?? '').trim().toLowerCase();
  return `solo:${task.kind}|${plan}|${subject}|${task.title.trim().toLowerCase()}`;
}

/**
 * Construye el progreso de un tratamiento a partir de sus tomas materializadas.
 * Prefiere el snapshot de fases de la toma más reciente con plan.
 */
export function buildRxTreatmentProgress(
  tasks: Task[],
  todayId: string
): RxTreatmentProgress | null {
  const doses = tasks.filter(t => isRxKind(t.kind));
  if (!doses.length) return null;

  const sorted = [...doses].sort((a, b) => {
    const dayCmp = (a.endDayId || '').localeCompare(b.endDayId || '');
    if (dayCmp !== 0) return dayCmp;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
  const sample =
    [...sorted].reverse().find(t => t.rx?.phases?.length) ?? sorted[sorted.length - 1];
  const kind = sample.kind === 'rx_pet' ? 'rx_pet' : 'rx_human';
  const subject = sample.rx?.subject?.trim() || null;
  const phases = sample.rx?.phases?.length ? sample.rx.phases : [];
  const planStartDayId =
    sample.rx?.planStartDayId ||
    sorted[0].endDayId ||
    todayId;
  const planEndDayId = phases.length
    ? rxPlanEndDayId(planStartDayId, phases)
    : sorted[sorted.length - 1].endDayId || planStartDayId;

  const planned = plannedDosesTotal(phases);
  const completedDoses = sorted.filter(t => t.completed).length;
  // Si no hay plan en meta, usa el recuento de instancias conocidas.
  const totalDoses = planned > 0 ? Math.max(planned, sorted.length) : sorted.length;
  const remainingDoses = Math.max(0, totalDoses - completedDoses);
  const ranges = rxPhaseDateRanges(planStartDayId, phases);

  const phaseProgress: RxPhaseProgress[] = phases.map((phase, phaseIndex) => {
    const range = ranges.find(r => r.phaseIndex === phaseIndex);
    const startDayId = range?.startDayId ?? planStartDayId;
    const endDayId = range?.endDayId ?? planStartDayId;
    const days = Math.max(0, Math.floor(phase.days || 0));
    const timesPerDay = Array.isArray(phase.times) ? phase.times.length : 0;
    const total = plannedDosesInPhase(phase);
    const phaseTasks = sorted.filter(t => (t.rx?.phaseIndex ?? 0) === phaseIndex);
    const completed = phaseTasks.filter(t => t.completed).length;
    // Preferir plan para total de fase; no bajar del recuento real.
    const phaseTotal = total > 0 ? Math.max(total, phaseTasks.length) : phaseTasks.length;
    const timing = phaseDaysRemaining(todayId, startDayId, endDayId, days);
    return {
      phaseIndex,
      amount: phase.amount,
      unit: phase.unit,
      days,
      timesPerDay,
      startDayId,
      endDayId,
      daysRemaining: timing.daysRemaining,
      daysElapsed: timing.daysElapsed,
      totalDoses: phaseTotal,
      completedDoses: completed,
      remainingDoses: Math.max(0, phaseTotal - completed),
      status: timing.status,
    };
  });

  const isActive =
    remainingDoses > 0 ||
    todayId <= planEndDayId ||
    phaseProgress.some(p => p.status !== 'done');

  return {
    key: rxTreatmentKey(sample),
    seriesId: sample.seriesId,
    title: sample.title,
    kind,
    subject,
    planStartDayId,
    planEndDayId,
    phases,
    totalDoses,
    completedDoses,
    remainingDoses,
    progressPct: clampPct(completedDoses, totalDoses),
    phaseProgress,
    isActive,
    tasks: sorted,
  };
}

/**
 * Agrupa tomas de recetario por persona/mascota y calcula progreso de tratamientos.
 */
export function buildRxSubjectGroups(
  tasks: Task[] | null | undefined,
  todayId: string,
  opts?: { includeFinished?: boolean }
): RxSubjectGroup[] {
  const includeFinished = opts?.includeFinished ?? true;
  const rxTasks = (tasks ?? []).filter(t => isRxKind(t.kind));
  if (!rxTasks.length) return [];

  const byTreatment = new Map<string, Task[]>();
  for (const task of rxTasks) {
    const key = rxTreatmentKey(task);
    const list = byTreatment.get(key);
    if (list) list.push(task);
    else byTreatment.set(key, [task]);
  }

  const treatments: RxTreatmentProgress[] = [];
  for (const list of byTreatment.values()) {
    const progress = buildRxTreatmentProgress(list, todayId);
    if (!progress) continue;
    if (!includeFinished && !progress.isActive && progress.remainingDoses === 0) continue;
    treatments.push(progress);
  }

  const bySubject = new Map<string, RxTreatmentProgress[]>();
  for (const tr of treatments) {
    const label = tr.subject?.trim() || '';
    const subjectKey = label
      ? `${tr.kind}:${label.toLowerCase()}`
      : `${tr.kind}:__none__`;
    const list = bySubject.get(subjectKey);
    if (list) list.push(tr);
    else bySubject.set(subjectKey, [tr]);
  }

  const groups: RxSubjectGroup[] = [];
  for (const [subjectKey, trs] of bySubject) {
    trs.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
    const kinds = new Set(trs.map(t => t.kind));
    const kind: RxSubjectGroup['kind'] =
      kinds.size === 1 ? (kinds.has('rx_pet') ? 'rx_pet' : 'rx_human') : 'mixed';
    const sample = trs[0];
    // Vacío = sin nombre; la UI pinta el fallback i18n.
    const subjectLabel = sample.subject?.trim() || '';

    const todayDoses = rxTasks
      .filter(t => {
        // Preferir bucket dayId si viene del store; si no, endDayId / plan day.
        const doseDay =
          (t as Task & { dayId?: string }).dayId || t.endDayId || '';
        if (doseDay !== todayId) return false;
        const k = rxTreatmentKey(t);
        return trs.some(tr => tr.key === k);
      })
      .slice()
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');
      });

    const totalDoses = trs.reduce((s, t) => s + t.totalDoses, 0);
    const completedDoses = trs.reduce((s, t) => s + t.completedDoses, 0);
    const remainingDoses = trs.reduce((s, t) => s + t.remainingDoses, 0);

    groups.push({
      subjectKey,
      subjectLabel,
      kind,
      treatments: trs,
      todayDoses,
      totalDoses,
      completedDoses,
      remainingDoses,
      progressPct: clampPct(completedDoses, totalDoses),
    });
  }

  groups.sort((a, b) => {
    const aPet = a.kind === 'rx_pet' ? 1 : 0;
    const bPet = b.kind === 'rx_pet' ? 1 : 0;
    if (aPet !== bPet) return aPet - bPet;
    return a.subjectLabel.localeCompare(b.subjectLabel, undefined, {
      sensitivity: 'base',
    });
  });

  return groups;
}

export interface RxPhaseEndingSoon {
  treatmentKey: string;
  title: string;
  subject: string | null;
  kind: 'rx_human' | 'rx_pet';
  phaseIndex: number;
  amount: number;
  unit: DoseUnit;
  startDayId: string;
  endDayId: string;
  daysRemaining: number;
  status: RxPhaseStatus;
}

/**
 * Fases cuyo fin cae en [fromDayId, toDayId] (inclusive), o activas con días restantes
 * dentro de la ventana.
 */
export function listPhasesEndingInRange(
  treatments: RxTreatmentProgress[],
  fromDayId: string,
  toDayId: string
): RxPhaseEndingSoon[] {
  const out: RxPhaseEndingSoon[] = [];
  for (const tr of treatments) {
    for (const p of tr.phaseProgress) {
      if (p.status === 'done') continue;
      // Fin de fase dentro del rango, o fase activa que termina antes de toDayId
      const endsInRange = p.endDayId >= fromDayId && p.endDayId <= toDayId;
      if (!endsInRange) continue;
      out.push({
        treatmentKey: tr.key,
        title: tr.title,
        subject: tr.subject,
        kind: tr.kind,
        phaseIndex: p.phaseIndex,
        amount: p.amount,
        unit: p.unit,
        startDayId: p.startDayId,
        endDayId: p.endDayId,
        daysRemaining: p.daysRemaining,
        status: p.status,
      });
    }
  }
  out.sort((a, b) => {
    const d = a.endDayId.localeCompare(b.endDayId);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
  return out;
}

/**
 * Aplana tomas de recetario del store.
 * `dayId` es el bucket de inicio (día de la toma materializada).
 */
export function collectRxTasksFromStore(
  tasksByDay: Record<string, Record<string, Task[]>> | null | undefined
): Array<Task & { dayId: string }> {
  if (!tasksByDay) return [];
  const byId = new Map<string, Task & { dayId: string }>();
  for (const days of Object.values(tasksByDay)) {
    for (const [dayId, list] of Object.entries(days)) {
      for (const t of list) {
        if (!isRxKind(t.kind)) continue;
        byId.set(t.id, { ...t, dayId });
      }
    }
  }
  return [...byId.values()];
}
