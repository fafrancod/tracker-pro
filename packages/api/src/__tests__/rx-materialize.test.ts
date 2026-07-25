import { describe, it, expect } from 'vitest';
import { materializeRxOccurrences, validateRxPhases } from '../lib/rx.js';

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

  it('valida plan vacío', () => {
    expect(validateRxPhases([])).toMatch(/fase/i);
  });
});
