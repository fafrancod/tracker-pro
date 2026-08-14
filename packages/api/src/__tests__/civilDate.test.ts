import { describe, it, expect } from 'vitest';
import { dayIdInTimeZone, civilDateFromDayId } from '@daily-tracker/core';

describe('dayIdInTimeZone', () => {
  it('UTC 04:00 del 15 ene es el 14 en Los Ángeles y el 15 en UTC', () => {
    const instant = new Date('2026-01-15T04:00:00.000Z');
    expect(dayIdInTimeZone(instant, 'UTC')).toBe('2026-01-15');
    expect(dayIdInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-01-14');
    expect(dayIdInTimeZone(instant, 'Europe/Madrid')).toBe('2026-01-15');
  });

  it('civilDateFromDayId es mediodía local de ese día', () => {
    const d = civilDateFromDayId('2026-08-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(12);
  });
});
