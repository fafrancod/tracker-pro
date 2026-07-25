import { addDaysToDayId } from './recurrence.js';

export type DoseUnit = 'pills' | 'ml';
export type RxTaskKind = 'rx_human' | 'rx_pet';

export interface RxPhase {
  amount: number;
  unit: DoseUnit;
  days: number;
  times: string[];
}

export interface RxMeta {
  subject: string | null;
  amount: number;
  unit: DoseUnit;
  phaseIndex: number;
  planStartDayId: string;
  phases: RxPhase[];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizePhaseTime(raw: string): string {
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

export function isRxKind(kind: string | null | undefined): boolean {
  return kind === 'rx_human' || kind === 'rx_pet';
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
    for (let ti = 0; ti < p.times.length; ti++) {
      const t = p.times[ti];
      if (typeof t !== 'string') {
        return `Fase ${i + 1}: horario inválido`;
      }
      const nt = normalizePhaseTime(t);
      if (!TIME_RE.test(nt)) {
        return `Fase ${i + 1}: horario inválido (${t})`;
      }
      p.times[ti] = nt;
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

export function materializeRxOccurrences(
  startDayId: string,
  phases: RxPhase[]
): RxOccurrence[] {
  const err = validateRxPhases(phases);
  if (err) throw new Error(err);

  const out: RxOccurrence[] = [];
  let dayOffset = 0;

  phases.forEach((phase, phaseIndex) => {
    const days = Math.floor(phase.days);
    const times = [...phase.times].sort();
    for (let d = 0; d < days; d++) {
      const dayId = addDaysToDayId(startDayId, dayOffset + d);
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
