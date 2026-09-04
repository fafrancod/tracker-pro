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

/**
 * IANA timezone → ISO 4217. Exact match first, then prefix rules.
 * Chile (America/Santiago) must win over the old EUR bootstrap default.
 */
const TIMEZONE_CURRENCY: Record<string, string> = {
  'America/Santiago': 'CLP',
  'America/Punta_Arenas': 'CLP',
  'Pacific/Easter': 'CLP',
  'America/Buenos_Aires': 'ARS',
  'America/Argentina/Buenos_Aires': 'ARS',
  'America/Argentina/Cordoba': 'ARS',
  'America/Argentina/Mendoza': 'ARS',
  'America/Argentina/Salta': 'ARS',
  'America/Mexico_City': 'MXN',
  'America/Cancun': 'MXN',
  'America/Merida': 'MXN',
  'America/Monterrey': 'MXN',
  'America/Tijuana': 'MXN',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'America/Sao_Paulo': 'BRL',
  'America/Fortaleza': 'BRL',
  'America/Recife': 'BRL',
  'America/Bahia': 'BRL',
  'America/Manaus': 'BRL',
  'America/Belem': 'BRL',
  'America/Montevideo': 'UYU',
  'America/La_Paz': 'BOB',
  'America/Asuncion': 'PYG',
  'America/Costa_Rica': 'CRC',
  'America/Guatemala': 'GTQ',
  'America/Tegucigalpa': 'HNL',
  'America/Managua': 'NIO',
  'America/Panama': 'PAB',
  'America/Santo_Domingo': 'DOP',
  'America/Havana': 'CUP',
  'America/Caracas': 'VES',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Anchorage': 'USD',
  'Pacific/Honolulu': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD',
  'America/Halifax': 'CAD',
  'Europe/London': 'GBP',
  'Europe/Zurich': 'CHF',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Bucharest': 'RON',
  'Europe/Sofia': 'BGN',
  'Atlantic/Reykjavik': 'ISK',
};

export function defaultCurrencyFromTimezone(
  timezone?: string | null
): string | null {
  const tz = (timezone ?? '').trim();
  if (!tz || tz === 'UTC' || tz === 'Etc/UTC' || tz === 'Etc/GMT') return null;
  const exact = TIMEZONE_CURRENCY[tz];
  if (exact) return exact;
  if (tz.startsWith('America/Argentina/')) return 'ARS';
  if (tz.startsWith('America/Mexico')) return 'MXN';
  if (tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza')) {
    return 'BRL';
  }
  if (tz.startsWith('America/') && /New_York|Chicago|Denver|Los_Angeles|Phoenix|Indiana|Kentucky|Detroit|Boise|Juneau/.test(tz)) {
    return 'USD';
  }
  if (tz.startsWith('Europe/London') || tz === 'GB') return 'GBP';
  if (tz.startsWith('Europe/')) return 'EUR';
  return null;
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

/**
 * Stored preference wins when it is a supported code.
 * Otherwise timezone, then locale. Last resort EUR.
 */
export function resolveDefaultCurrency(opts: {
  stored?: string | null;
  timezone?: string | null;
  locale?: string | null;
}): string {
  if (isSupportedCurrency(opts.stored)) {
    return normalizeCurrencyCode(opts.stored);
  }
  return (
    defaultCurrencyFromTimezone(opts.timezone) ??
    defaultCurrencyFromLocale(opts.locale)
  );
}

/**
 * Profiles created before timezone-aware defaults were saved as EUR.
 * If the zone implies another currency, return that replacement; else null.
 * Do not call this after the user has explicitly picked EUR.
 */
export function leftoverImplicitEurReplacement(
  stored: string | null | undefined,
  timezone?: string | null
): string | null {
  const code = (stored ?? '').trim().toUpperCase();
  if (code && code !== 'EUR') return null;
  const inferred = defaultCurrencyFromTimezone(timezone);
  if (!inferred || inferred === 'EUR') return null;
  return inferred;
}

export function normalizeFavoriteCurrencies(
  favorites?: string[] | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of favorites ?? []) {
    const u = String(raw ?? '')
      .trim()
      .toUpperCase();
    if (!isSupportedCurrency(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export function toggleFavoriteCurrency(
  favorites: string[] | null | undefined,
  code: string
): string[] {
  const u = String(code ?? '')
    .trim()
    .toUpperCase();
  const current = normalizeFavoriteCurrencies(favorites);
  if (!isSupportedCurrency(u)) return current;
  if (current.includes(u)) return current.filter(c => c !== u);
  return [...current, u];
}

export type CurrencyPickerGroups = {
  primary: CurrencyOption;
  favorites: CurrencyOption[];
  others: CurrencyOption[];
};

function optionByCode(code: string): CurrencyOption | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code);
}

/**
 * Orden del selector de transacción: moneda principal, favoritas (sin
 * duplicar la principal, en el orden en que se marcaron), resto.
 */
export function groupCurrenciesForPicker(opts: {
  preferred?: string | null;
  favorites?: string[] | null;
}): CurrencyPickerGroups {
  const preferred = isSupportedCurrency(opts.preferred)
    ? normalizeCurrencyCode(opts.preferred)
    : SUPPORTED_CURRENCIES[0].code;
  const primary = optionByCode(preferred) ?? SUPPORTED_CURRENCIES[0];
  const favorites = normalizeFavoriteCurrencies(opts.favorites)
    .filter(code => code !== primary.code)
    .map(code => optionByCode(code))
    .filter((c): c is CurrencyOption => Boolean(c));
  const used = new Set([primary.code, ...favorites.map(c => c.code)]);
  const others = SUPPORTED_CURRENCIES.filter(c => !used.has(c.code));
  return { primary, favorites, others };
}
