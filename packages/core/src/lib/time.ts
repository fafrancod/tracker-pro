/** HH:mm 24h. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Normaliza entradas de hora a HH:mm o null.
 * Acepta: "9:30", "09:30", "09:30:00", "930", "0930".
 * Cadena vacía / null → null. Inválido → null (si strict=false) o lanza.
 */
export function normalizeTimeInput(
  raw: string | null | undefined,
  opts?: { strict?: boolean }
): string | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // HH:mm:ss → HH:mm
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    s = s.slice(0, s.lastIndexOf(':'));
  }

  // Solo dígitos: 930 → 09:30, 0930 → 09:30, 9 → 09:00
  if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) {
      const h = Number(s);
      if (h > 23) {
        if (opts?.strict) throw new Error(`Hora inválida: ${raw}`);
        return null;
      }
      s = `${String(h).padStart(2, '0')}:00`;
    } else if (s.length === 3) {
      s = `0${s[0]}:${s.slice(1)}`;
    } else {
      s = `${s.slice(0, 2)}:${s.slice(2)}`;
    }
  }

  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) {
    if (opts?.strict) throw new Error(`Hora inválida: ${raw}`);
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    if (opts?.strict) throw new Error(`Hora inválida: ${raw}`);
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function isValidTime(value: string | null | undefined): boolean {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Hora actual local como HH:mm. */
export function nowTimeLocal(date = new Date()): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formatea tecleo progresivo hacia HH:mm.
 * Ej: "9" → "9", "93" → "9:3", "930" → "9:30", "0930" → "09:30"
 */
export function formatTimeTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}
