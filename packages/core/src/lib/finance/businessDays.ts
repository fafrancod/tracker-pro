import Holidays from 'date-holidays';

/** Países disponibles inicialmente para reglas financieras por día hábil. */
export const FINANCE_BUSINESS_DAY_COUNTRIES = [
  'AR', 'BR', 'CA', 'CL', 'CO', 'DE', 'ES', 'FR', 'GB', 'IT', 'MX', 'PE', 'US',
] as const;

export type FinanceBusinessDayCountry = (typeof FINANCE_BUSINESS_DAY_COUNTRIES)[number];

const holidayCache = new Map<string, Set<string>>();

function holidaysFor(country: FinanceBusinessDayCountry, year: number): Set<string> {
  const key = `${country}:${year}`;
  const cached = holidayCache.get(key);
  if (cached) return cached;
  const calendar = new Holidays(country);
  const dates = new Set(
    calendar
      .getHolidays(year)
      .filter(day => day.type === 'public' || day.type === 'bank')
      .map(day => day.date.slice(0, 10))
  );
  holidayCache.set(key, dates);
  return dates;
}

function dayId(year: number, monthIndex0: number, day: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Devuelve el N.º día laboral (lunes–viernes y feriado público/bancario local excluido). */
export function nthBusinessDayOfMonth(
  year: number,
  monthIndex0: number,
  ordinal: number,
  country: FinanceBusinessDayCountry
): string {
  const target = Math.min(23, Math.max(1, Math.floor(ordinal || 1)));
  const days = new Date(year, monthIndex0 + 1, 0).getDate();
  const holidays = holidaysFor(country, year);
  let seen = 0;
  let last = dayId(year, monthIndex0, days);
  for (let day = 1; day <= days; day += 1) {
    const current = dayId(year, monthIndex0, day);
    const weekday = new Date(year, monthIndex0, day).getDay();
    if (weekday === 0 || weekday === 6 || holidays.has(current)) continue;
    last = current;
    seen += 1;
    if (seen === target) return current;
  }
  return last;
}

export function isFinanceBusinessDayCountry(
  value: unknown
): value is FinanceBusinessDayCountry {
  return typeof value === 'string' && (FINANCE_BUSINESS_DAY_COUNTRIES as readonly string[]).includes(value);
}
