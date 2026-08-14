/** Zonas IANA frecuentes + la del dispositivo. */
const COMMON_TIMEZONES = [
  'UTC',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Atlantic/Canary',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Lista para el select: dispositivo primero, luego IANA (o comunes). */
export function listTimezoneOptions(): string[] {
  const device = getDeviceTimezone();
  let rest: string[] = [...COMMON_TIMEZONES];
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      rest = intl.supportedValuesOf('timeZone');
    }
  } catch {
    /* keep COMMON */
  }
  return [device, ...rest.filter(z => z !== device)];
}

/** Etiqueta legible con offset actual. */
export function formatTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    return offset ? `${tz} (${offset})` : tz;
  } catch {
    return tz;
  }
}
