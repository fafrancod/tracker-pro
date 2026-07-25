import { addDays, format, parseISO } from 'date-fns';
import type { DoseUnit, RxMeta, RxPhase, TaskKind } from '../types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    if (!Array.isArray(p.times) || p.times.length === 0) {
      return `Fase ${i + 1}: indica al menos un horario`;
    }
    if (p.times.length > 12) {
      return `Fase ${i + 1}: máximo 12 horarios por día`;
    }
    for (const t of p.times) {
      if (typeof t !== 'string' || !TIME_RE.test(t)) {
        return `Fase ${i + 1}: horario inválido (${t})`;
      }
    }
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
    phases: phases.map(p => ({
      amount: p.amount,
      unit: p.unit,
      days: Math.floor(p.days),
      times: [...p.times].sort(),
    })),
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
