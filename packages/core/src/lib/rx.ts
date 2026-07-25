import { addDays, format, parseISO } from 'date-fns';
import type { DoseUnit, RxMeta, RxPhase, RxScheduleMode, TaskKind } from '../types';

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
