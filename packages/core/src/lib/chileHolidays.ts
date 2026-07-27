/**
 * Feriados nacionales de Chile (días no laborables).
 * Incluye fijos y los que dependen de Pascua (Viernes/Sábado Santo).
 * Suficiente para calendario 2024–2035 y para “día hábil”.
 */

export interface ChileHoliday {
  dayId: string;
  name: string;
}

/** Computus: domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function ymd(y: number, month1: number, day: number): string {
  const m = String(month1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysDate(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function formatYmd(d: Date): string {
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Feriados fijos (mes 1–12, día). Algunos se “mueven” por ley de feriados; usamos fecha civil habitual. */
const FIXED: Array<{ m: number; d: number; name: string }> = [
  { m: 1, d: 1, name: 'Año Nuevo' },
  { m: 5, d: 1, name: 'Día Nacional del Trabajo' },
  { m: 5, d: 21, name: 'Día de las Glorias Navales' },
  { m: 6, d: 20, name: 'Día Nacional de los Pueblos Indígenas' }, // aprox. solsticio; varía ligeramente
  { m: 6, d: 29, name: 'San Pedro y San Pablo' },
  { m: 7, d: 16, name: 'Día de la Virgen del Carmen' },
  { m: 8, d: 15, name: 'Asunción de la Virgen' },
  { m: 9, d: 18, name: 'Independencia Nacional' },
  { m: 9, d: 19, name: 'Día de las Glorias del Ejército' },
  { m: 10, d: 12, name: 'Encuentro de Dos Mundos' },
  { m: 10, d: 31, name: 'Día de las Iglesias Evangélicas y Protestantes' },
  { m: 11, d: 1, name: 'Día de Todos los Santos' },
  { m: 12, d: 8, name: 'Inmaculada Concepción' },
  { m: 12, d: 25, name: 'Navidad' },
];

const cache = new Map<number, ChileHoliday[]>();

export function getChileHolidaysForYear(year: number): ChileHoliday[] {
  const hit = cache.get(year);
  if (hit) return hit;

  const list: ChileHoliday[] = FIXED.map(f => ({
    dayId: ymd(year, f.m, f.d),
    name: f.name,
  }));

  // Pueblos indígenas: alrededor del solsticio de invierno (20 o 21 jun)
  // Reemplazamos el fijo 20 si el solsticio cae el 21.
  const solstice = new Date(year, 5, 21);
  // rough: day of year for solstice is often 20 or 21
  const solsticeDay = solstice.getDate() === 21 ? 21 : 20;
  const piIdx = list.findIndex(h => h.name.startsWith('Día Nacional de los Pueblos'));
  if (piIdx >= 0) {
    list[piIdx] = {
      dayId: ymd(year, 6, solsticeDay),
      name: 'Día Nacional de los Pueblos Indígenas',
    };
  }

  const easter = easterSunday(year);
  list.push(
    { dayId: formatYmd(addDaysDate(easter, -2)), name: 'Viernes Santo' },
    { dayId: formatYmd(addDaysDate(easter, -1)), name: 'Sábado Santo' }
  );

  list.sort((a, b) => a.dayId.localeCompare(b.dayId));
  // Deduplicate dayIds (keep first name)
  const seen = new Set<string>();
  const unique: ChileHoliday[] = [];
  for (const h of list) {
    if (seen.has(h.dayId)) continue;
    seen.add(h.dayId);
    unique.push(h);
  }
  cache.set(year, unique);
  return unique;
}

export function getChileHolidaysInRange(
  fromDayId: string,
  toDayId: string
): ChileHoliday[] {
  const fromY = Number(fromDayId.slice(0, 4));
  const toY = Number(toDayId.slice(0, 4));
  if (!Number.isFinite(fromY) || !Number.isFinite(toY)) return [];
  const out: ChileHoliday[] = [];
  for (let y = fromY; y <= toY; y++) {
    for (const h of getChileHolidaysForYear(y)) {
      if (h.dayId >= fromDayId && h.dayId <= toDayId) out.push(h);
    }
  }
  return out;
}

export function isChileHoliday(dayId: string): boolean {
  const y = Number(dayId.slice(0, 4));
  if (!Number.isFinite(y)) return false;
  return getChileHolidaysForYear(y).some(h => h.dayId === dayId);
}

export function chileHolidayName(dayId: string): string | null {
  const y = Number(dayId.slice(0, 4));
  if (!Number.isFinite(y)) return null;
  return getChileHolidaysForYear(y).find(h => h.dayId === dayId)?.name ?? null;
}

/** Sábado o domingo. */
export function isWeekendDayId(dayId: string): boolean {
  const d = parseISOLocal(dayId);
  if (!d) return false;
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

/** Día hábil Chile: no fin de semana y no feriado nacional. */
export function isBusinessDayChile(dayId: string): boolean {
  return !isWeekendDayId(dayId) && !isChileHoliday(dayId);
}

function parseISOLocal(dayId: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayId);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function dayIdInMonth(year: number, monthIndex0: number, day: number): string {
  const dim = daysInMonth(year, monthIndex0);
  const d = Math.min(Math.max(1, day), dim);
  return ymd(year, monthIndex0 + 1, d);
}

export function lastCalendarDayOfMonth(year: number, monthIndex0: number): string {
  return dayIdInMonth(year, monthIndex0, daysInMonth(year, monthIndex0));
}

export function firstBusinessDayOfMonth(year: number, monthIndex0: number): string {
  const dim = daysInMonth(year, monthIndex0);
  for (let d = 1; d <= dim; d++) {
    const id = dayIdInMonth(year, monthIndex0, d);
    if (isBusinessDayChile(id)) return id;
  }
  return dayIdInMonth(year, monthIndex0, 1);
}

export function lastBusinessDayOfMonth(year: number, monthIndex0: number): string {
  const dim = daysInMonth(year, monthIndex0);
  for (let d = dim; d >= 1; d--) {
    const id = dayIdInMonth(year, monthIndex0, d);
    if (isBusinessDayChile(id)) return id;
  }
  return dayIdInMonth(year, monthIndex0, dim);
}

export function isLastCalendarDayOfMonth(dayId: string): boolean {
  const d = parseISOLocal(dayId);
  if (!d) return false;
  const last = daysInMonth(d.getFullYear(), d.getMonth());
  return d.getDate() === last;
}
