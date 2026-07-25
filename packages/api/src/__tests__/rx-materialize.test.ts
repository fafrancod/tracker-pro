import { describe, it, expect } from 'vitest';
import {
  expandIntervalTimes,
  materializeRxOccurrences,
  validateRxPhases,
} from '../lib/rx.js';

describe('materializeRxOccurrences', () => {
  it('expande dos fases con horarios en días consecutivos', () => {
    const occs = materializeRxOccurrences('2026-03-10', [
      { amount: 1, unit: 'pills', days: 2, times: ['08:00', '20:00'] },
      { amount: 0.5, unit: 'pills', days: 1, times: ['08:00'] },
    ]);
    expect(occs).toHaveLength(5);
    expect(occs[0]).toMatchObject({
      dayId: '2026-03-10',
      startTime: '08:00',
      amount: 1,
      phaseIndex: 0,
    });
    expect(occs[1]).toMatchObject({ dayId: '2026-03-10', startTime: '20:00' });
    expect(occs[2]).toMatchObject({ dayId: '2026-03-11', startTime: '08:00', amount: 1 });
    expect(occs[4]).toMatchObject({
      dayId: '2026-03-12',
      startTime: '08:00',
      amount: 0.5,
      phaseIndex: 1,
    });
  });

  it('expande modo interval cada 8h desde 08:00', () => {
    const phase = {
      amount: 1,
      unit: 'pills' as const,
      days: 1,
      scheduleMode: 'interval' as const,
      times: [] as string[],
      everyHours: 8,
      startTime: '08:00',
    };
    expect(validateRxPhases([phase])).toBeNull();
    expect(phase.times).toEqual(['08:00', '16:00', '00:00']);
    const occs = materializeRxOccurrences('2026-03-10', [phase]);
    expect(occs).toHaveLength(3);
    expect(occs.map(o => o.startTime).sort()).toEqual(['00:00', '08:00', '16:00']);
  });

  it('valida plan vacío', () => {
    expect(validateRxPhases([])).toMatch(/fase/i);
  });
});

describe('expandIntervalTimes', () => {
  it('cada 6h desde 06:00', () => {
    expect(expandIntervalTimes('06:00', 6)).toEqual(['06:00', '12:00', '18:00', '00:00']);
  });
});
