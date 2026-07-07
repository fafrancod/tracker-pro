/** YYYY-MM del momento actual (usado para `users/{uid}/usage/{period}`). */
export function currentPeriod(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const WEEK_ID_RE = /^\d{4}-W\d{2}$/;
const DAY_ID_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidWeekId(value: string): boolean {
  return WEEK_ID_RE.test(value);
}

export function isValidDayId(value: string): boolean {
  return DAY_ID_RE.test(value);
}
