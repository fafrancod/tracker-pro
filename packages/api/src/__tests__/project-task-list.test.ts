import { describe, it, expect } from 'vitest';
import {
  collapseProjectTaskSeries,
  type LocatedTaskRow,
} from '@daily-tracker/core';

function row(
  partial: Partial<LocatedTaskRow> & Pick<LocatedTaskRow, 'id' | 'title' | 'dayId'>
): LocatedTaskRow {
  return {
    weekId: '2026-W32',
    completed: false,
    completedAt: null,
    projectId: 'p1',
    projectCategoryId: 'cat1',
    priority: 'medium',
    notes: '',
    order: 0,
    tags: [],
    movedFrom: null,
    seriesId: null,
    recurrence: { frequency: 'none', interval: 1 },
    endDayId: partial.dayId,
    urgency: null,
    importance: null,
    kind: 'task',
    color: null,
    startTime: null,
    endTime: null,
    rx: null,
    involvedContactIds: [],
    location: null,
    departureTime: null,
    steps: [],
    images: [],
    finance: null,
    financeMovementId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('collapseProjectTaskSeries', () => {
  it('deja las tareas sueltas como están', () => {
    const out = collapseProjectTaskSeries([
      row({ id: 'a', title: 'Una', dayId: '2026-08-03' }),
      row({ id: 'b', title: 'Otra', dayId: '2026-08-04' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('fusiona ocurrencias de la misma serie en una fila', () => {
    const series = { frequency: 'weekly' as const, interval: 1 };
    const out = collapseProjectTaskSeries([
      row({
        id: 's1',
        title: 'Standup',
        dayId: '2026-08-04',
        seriesId: 'ser',
        recurrence: series,
        completed: true,
      }),
      row({
        id: 's2',
        title: 'Standup',
        dayId: '2026-08-11',
        seriesId: 'ser',
        recurrence: series,
      }),
      row({
        id: 's3',
        title: 'Standup',
        dayId: '2026-08-18',
        seriesId: 'ser',
        recurrence: series,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s2');
    expect(out[0].seriesCount).toBe(3);
    expect(out[0].recurrence.frequency).toBe('weekly');
  });
});
