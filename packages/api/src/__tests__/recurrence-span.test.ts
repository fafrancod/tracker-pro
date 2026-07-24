import { describe, it, expect } from 'vitest';
import {
  clampToMonth,
  materializeOccurrenceRanges,
  materializeOccurrenceDayIds,
  addDaysToDayId,
  inclusiveDurationDays,
} from '../lib/recurrence.js';

describe('clampToMonth', () => {
  it('preserva un día válido dentro del mes', () => {
    expect(clampToMonth(2026, 0, 15)).toBe('2026-01-15');
  });

  it('ajusta al último día de febrero no bisiesto (DOM 30/31)', () => {
    expect(clampToMonth(2026, 1, 30)).toBe('2026-02-28');
    expect(clampToMonth(2026, 1, 31)).toBe('2026-02-28');
  });

  it('ajusta al 29 en febrero bisiesto', () => {
    expect(clampToMonth(2024, 1, 31)).toBe('2024-02-29');
  });
});

describe('materializeOccurrenceRanges', () => {
  it('frequency none → un solo par start/end', () => {
    const ranges = materializeOccurrenceRanges('2026-03-10', '2026-03-15', 'none', 1);
    expect(ranges).toEqual([{ dayId: '2026-03-10', endDayId: '2026-03-15' }]);
  });

  it('none single-day → end = start', () => {
    const ranges = materializeOccurrenceRanges('2026-03-10', '2026-03-10', 'none', 1);
    expect(ranges).toEqual([{ dayId: '2026-03-10', endDayId: '2026-03-10' }]);
  });

  it('monthly multi-day 10–15 → horizonte 24 con offsets mensuales', () => {
    const ranges = materializeOccurrenceRanges('2026-01-10', '2026-01-15', 'monthly', 1);
    expect(ranges).toHaveLength(24);
    expect(ranges[0]).toEqual({ dayId: '2026-01-10', endDayId: '2026-01-15' });
    expect(ranges[1]).toEqual({ dayId: '2026-02-10', endDayId: '2026-02-15' });
    expect(ranges[2]).toEqual({ dayId: '2026-03-10', endDayId: '2026-03-15' });
    // última ocurrencia: +23 meses desde enero 2026 → dic 2027
    expect(ranges[23]).toEqual({ dayId: '2027-12-10', endDayId: '2027-12-15' });
  });

  it('monthly multi-day Jan 30–31 → febrero clamp sin fechas inválidas', () => {
    const ranges = materializeOccurrenceRanges('2026-01-30', '2026-01-31', 'monthly', 1);
    expect(ranges[0]).toEqual({ dayId: '2026-01-30', endDayId: '2026-01-31' });
    // Feb 2026 no bisiesto: 30 y 31 → 28 y 28; end >= start
    expect(ranges[1]).toEqual({ dayId: '2026-02-28', endDayId: '2026-02-28' });
    // Marzo recupera 30–31
    expect(ranges[2]).toEqual({ dayId: '2026-03-30', endDayId: '2026-03-31' });
  });

  it('single-day monthly → cada end = start (misma materialización de días)', () => {
    const ranges = materializeOccurrenceRanges('2026-01-15', '2026-01-15', 'monthly', 1);
    const dayIds = materializeOccurrenceDayIds('2026-01-15', 'monthly', 1);
    expect(ranges).toHaveLength(24);
    expect(ranges.map(r => r.dayId)).toEqual(dayIds);
    for (const r of ranges) {
      expect(r.endDayId).toBe(r.dayId);
    }
  });

  it('monthly interval 2 salta meses de dos en dos', () => {
    const ranges = materializeOccurrenceRanges('2026-01-10', '2026-01-12', 'monthly', 2);
    expect(ranges).toHaveLength(24);
    expect(ranges[0]).toEqual({ dayId: '2026-01-10', endDayId: '2026-01-12' });
    expect(ranges[1]).toEqual({ dayId: '2026-03-10', endDayId: '2026-03-12' });
    expect(ranges[2]).toEqual({ dayId: '2026-05-10', endDayId: '2026-05-12' });
  });
});

describe('move duration helpers', () => {
  it('inclusiveDurationDays cuenta días inclusivos menos 1 (offset)', () => {
    // 10–15 inclusive = 6 días → offset 5
    expect(inclusiveDurationDays('2026-03-10', '2026-03-15')).toBe(5);
    expect(inclusiveDurationDays('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('addDaysToDayId desplaza el dayId manteniendo formato', () => {
    expect(addDaysToDayId('2026-03-10', 5)).toBe('2026-03-15');
    expect(addDaysToDayId('2026-03-10', 0)).toBe('2026-03-10');
  });
});
