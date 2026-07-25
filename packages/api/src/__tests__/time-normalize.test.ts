import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/** Mirror of routes/tasks normalizeTimeValue for unit test isolation */
function normalizeTimeValue(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return raw as string;
  const s = raw.trim();
  if (!s) return null;
  let t = s;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) t = t.slice(0, t.lastIndexOf(':'));
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return s;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const timeSchema = z.preprocess(
  normalizeTimeValue,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora formato HH:mm')
    .nullable()
    .optional()
);

describe('time normalize + schema', () => {
  it('acepta 9:30 y normaliza a 09:30', () => {
    expect(timeSchema.parse('9:30')).toBe('09:30');
  });

  it('acepta 09:30:00 (segundos del browser)', () => {
    expect(timeSchema.parse('09:30:00')).toBe('09:30');
  });

  it('vacío → null', () => {
    expect(timeSchema.parse('')).toBeNull();
    expect(timeSchema.parse(null)).toBeNull();
  });

  it('undefined se mantiene opcional', () => {
    expect(timeSchema.parse(undefined)).toBeUndefined();
  });
});
