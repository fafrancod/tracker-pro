/**
 * Monedas soportadas en Finances y movimientos de calendario.
 * LATAM + Europa + USD (y CAD de apoyo).
 */
export interface CurrencyOption {
  code: string;
  /** Etiqueta corta para combobox */
  label: string;
  region: 'latam' | 'europe' | 'north_america' | 'other';
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  // North America
  { code: 'USD', label: 'USD — US Dollar', region: 'north_america' },
  { code: 'CAD', label: 'CAD — Canadian Dollar', region: 'north_america' },
  // LATAM
  { code: 'CLP', label: 'CLP — Peso chileno', region: 'latam' },
  { code: 'ARS', label: 'ARS — Peso argentino', region: 'latam' },
  { code: 'MXN', label: 'MXN — Peso mexicano', region: 'latam' },
  { code: 'COP', label: 'COP — Peso colombiano', region: 'latam' },
  { code: 'PEN', label: 'PEN — Sol peruano', region: 'latam' },
  { code: 'BRL', label: 'BRL — Real brasileño', region: 'latam' },
  { code: 'UYU', label: 'UYU — Peso uruguayo', region: 'latam' },
  { code: 'BOB', label: 'BOB — Boliviano', region: 'latam' },
  { code: 'PYG', label: 'PYG — Guaraní', region: 'latam' },
  { code: 'CRC', label: 'CRC — Colón costarricense', region: 'latam' },
  { code: 'GTQ', label: 'GTQ — Quetzal', region: 'latam' },
  { code: 'HNL', label: 'HNL — Lempira', region: 'latam' },
  { code: 'NIO', label: 'NIO — Córdoba', region: 'latam' },
  { code: 'PAB', label: 'PAB — Balboa', region: 'latam' },
  { code: 'DOP', label: 'DOP — Peso dominicano', region: 'latam' },
  { code: 'CUP', label: 'CUP — Peso cubano', region: 'latam' },
  { code: 'VES', label: 'VES — Bolívar venezolano', region: 'latam' },
  // Europe
  { code: 'EUR', label: 'EUR — Euro', region: 'europe' },
  { code: 'GBP', label: 'GBP — Libra esterlina', region: 'europe' },
  { code: 'CHF', label: 'CHF — Franco suizo', region: 'europe' },
  { code: 'SEK', label: 'SEK — Corona sueca', region: 'europe' },
  { code: 'NOK', label: 'NOK — Corona noruega', region: 'europe' },
  { code: 'DKK', label: 'DKK — Corona danesa', region: 'europe' },
  { code: 'PLN', label: 'PLN — Złoty', region: 'europe' },
  { code: 'CZK', label: 'CZK — Corona checa', region: 'europe' },
  { code: 'HUF', label: 'HUF — Florín húngaro', region: 'europe' },
  { code: 'RON', label: 'RON — Leu rumano', region: 'europe' },
  { code: 'BGN', label: 'BGN — Lev búlgaro', region: 'europe' },
  { code: 'ISK', label: 'ISK — Corona islandesa', region: 'europe' },
];

const CODE_SET = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

export function isSupportedCurrency(code: string | null | undefined): boolean {
  if (!code) return false;
  return CODE_SET.has(code.toUpperCase());
}

export function normalizeCurrencyCode(
  code: string | null | undefined,
  fallback = 'EUR'
): string {
  if (!code) return fallback;
  const u = code.trim().toUpperCase().slice(0, 8);
  return isSupportedCurrency(u) ? u : fallback;
}

/** Default by browser locale when possible. */
export function defaultCurrencyFromLocale(
  locale?: string | null
): string {
  const l = (locale ?? '').toLowerCase();
  if (l.includes('cl')) return 'CLP';
  if (l.includes('ar')) return 'ARS';
  if (l.includes('mx')) return 'MXN';
  if (l.includes('co')) return 'COP';
  if (l.includes('pe')) return 'PEN';
  if (l.includes('br')) return 'BRL';
  if (l.includes('uy')) return 'UYU';
  if (l.includes('us') || l.includes('en-us')) return 'USD';
  if (l.includes('gb') || l.includes('en-gb')) return 'GBP';
  return 'EUR';
}
