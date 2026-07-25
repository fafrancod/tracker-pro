/** Calendario de semanas de vida (inspirado en Memento mori / Wait But Why). */

export const WEEKS_PER_YEAR = 52;
export const DEFAULT_LIFESPAN_YEARS = 80;
export const MIN_LIFESPAN_YEARS = 40;
export const MAX_LIFESPAN_YEARS = 120;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Parsea YYYY-MM-DD como fecha local (medianoche). */
export function parseBirthDate(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  const today = startOfLocalDay(new Date());
  if (date.getTime() > today.getTime()) return null;
  // Rango razonable (p. ej. no antes de 1900)
  if (y < 1900) return null;
  return date;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Semanas enteras entre dos fechas locales (desde medianoche). */
export function wholeWeeksBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  if (b < a) return 0;
  return Math.floor((b - a) / MS_PER_WEEK);
}

export function clampLifespanYears(years: number | null | undefined): number {
  const n = typeof years === 'number' && Number.isFinite(years) ? Math.round(years) : DEFAULT_LIFESPAN_YEARS;
  return Math.min(MAX_LIFESPAN_YEARS, Math.max(MIN_LIFESPAN_YEARS, n));
}

export interface LifeWeeksSnapshot {
  birthDate: Date;
  lifespanYears: number;
  totalWeeks: number;
  weeksLived: number;
  weeksRemaining: number;
  /** Índice 0-based de la semana actual dentro del total (clamped). */
  currentWeekIndex: number;
  ageYears: number;
  ageWeeksRemainder: number;
  percentLived: number;
  /** true si ya superó la esperanza de vida configurada */
  pastExpectation: boolean;
}

export function computeLifeWeeks(
  birthDateIso: string | null | undefined,
  lifespanYears?: number | null,
  now: Date = new Date()
): LifeWeeksSnapshot | null {
  const birth = parseBirthDate(birthDateIso);
  if (!birth) return null;

  const years = clampLifespanYears(lifespanYears);
  const totalWeeks = years * WEEKS_PER_YEAR;
  const today = startOfLocalDay(now);
  const rawLived = wholeWeeksBetween(birth, today);
  const pastExpectation = rawLived >= totalWeeks;
  const weeksLived = Math.min(rawLived, totalWeeks);
  const weeksRemaining = Math.max(0, totalWeeks - weeksLived);
  const currentWeekIndex = pastExpectation ? totalWeeks - 1 : weeksLived;
  const ageYears = Math.floor(rawLived / WEEKS_PER_YEAR);
  const ageWeeksRemainder = rawLived % WEEKS_PER_YEAR;
  const percentLived = totalWeeks > 0 ? Math.min(100, (weeksLived / totalWeeks) * 100) : 0;

  return {
    birthDate: birth,
    lifespanYears: years,
    totalWeeks,
    weeksLived,
    weeksRemaining,
    currentWeekIndex,
    ageYears,
    ageWeeksRemainder,
    percentLived,
    pastExpectation,
  };
}

export type WeekCellState = 'lived' | 'current' | 'remaining';

export function weekCellState(index: number, snap: LifeWeeksSnapshot): WeekCellState {
  if (snap.pastExpectation) {
    return index < snap.totalWeeks ? 'lived' : 'remaining';
  }
  if (index < snap.weeksLived) return 'lived';
  if (index === snap.currentWeekIndex) return 'current';
  return 'remaining';
}

/**
 * Edades múltiplo de 5 aún por cumplir (p. ej. 32 → 35, 40, 45…).
 * No incluye la edad actual aunque sea múltiplo de 5 (ya cumplida).
 */
export function nextFiveYearMilestones(
  currentAgeYears: number,
  lifespanYears: number
): number[] {
  const age = Math.max(0, Math.floor(currentAgeYears));
  const max = Math.max(age, Math.floor(lifespanYears));
  // Primer múltiplo de 5 estrictamente mayor que la edad actual.
  const first = Math.ceil((age + 1) / 5) * 5;
  const out: number[] = [];
  for (let a = first; a <= max; a += 5) {
    out.push(a);
  }
  return out;
}

/** Índice 0-based de la primera semana del año de vida `ageYears` (cumpleaños de esa edad). */
export function weekIndexForAge(ageYears: number): number {
  return Math.max(0, Math.floor(ageYears)) * WEEKS_PER_YEAR;
}

/** Mapa weekIndex → edad hito (35, 40, …) para marcar celdas. */
export function milestoneWeekMap(
  currentAgeYears: number,
  lifespanYears: number
): Map<number, number> {
  const map = new Map<number, number>();
  for (const age of nextFiveYearMilestones(currentAgeYears, lifespanYears)) {
    const idx = weekIndexForAge(age);
    if (idx < lifespanYears * WEEKS_PER_YEAR) {
      map.set(idx, age);
    }
  }
  return map;
}
