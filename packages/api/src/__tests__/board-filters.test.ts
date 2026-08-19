import { describe, it, expect } from 'vitest';
import {
  BOARD_NO_PROJECT,
  boardShowsHolidays,
  boardShowsTasks,
  resolvedKindGroups,
  taskKindGroup,
  taskMatchesFilters,
  toggleKindGroup,
  toggleProjectKey,
  type BoardTaskFilters,
} from '@daily-tracker/core';

function task(
  partial: Partial<{
    kind: string;
    projectId: string | null;
    completed: boolean;
    urgency: 'urgent' | 'not_urgent' | null;
  }>
) {
  return {
    projectId: null as string | null,
    urgency: null,
    importance: null,
    kind: 'task',
    completed: false,
    ...partial,
  };
}

describe('board kind groups', () => {
  it('agrupa task+reminder, eventos y hábitos', () => {
    expect(taskKindGroup('task')).toBe('tasks');
    expect(taskKindGroup('reminder')).toBe('tasks');
    expect(taskKindGroup('event')).toBe('events');
    expect(taskKindGroup('possible_event')).toBe('possible');
    expect(taskKindGroup('habit_quit')).toBe('habits');
    expect(taskKindGroup('rx_human')).toBeNull();
  });

  it('toggle combina tipos (no son exclusivos)', () => {
    expect(toggleKindGroup('all', 'habits')).toEqual([
      'tasks',
      'events',
      'possible',
      'finances',
      'holidays',
    ]);
    expect(toggleKindGroup(['tasks', 'possible'], 'events')).toEqual([
      'tasks',
      'events',
      'possible',
    ]);
  });
});

describe('taskMatchesFilters combinable', () => {
  it('tareas + posibles del proyecto AMSA, sin hábitos', () => {
    const filters: BoardTaskFilters = {
      kinds: ['tasks', 'possible'],
      projectIds: ['amsa'],
    };
    expect(
      taskMatchesFilters(task({ kind: 'task', projectId: 'amsa' }), filters)
    ).toBe(true);
    expect(
      taskMatchesFilters(
        task({ kind: 'possible_event', projectId: 'amsa' }),
        filters
      )
    ).toBe(true);
    expect(
      taskMatchesFilters(task({ kind: 'event', projectId: 'amsa' }), filters)
    ).toBe(false);
    expect(
      taskMatchesFilters(task({ kind: 'habit_good', projectId: 'amsa' }), filters)
    ).toBe(false);
    expect(
      taskMatchesFilters(task({ kind: 'task', projectId: 'cs' }), filters)
    ).toBe(false);
  });

  it('sin proyecto entra con sentinel', () => {
    const filters: BoardTaskFilters = {
      kinds: ['tasks'],
      projectIds: [BOARD_NO_PROJECT],
    };
    expect(taskMatchesFilters(task({ kind: 'task', projectId: null }), filters)).toBe(
      true
    );
    expect(
      taskMatchesFilters(task({ kind: 'task', projectId: 'amsa' }), filters)
    ).toBe(false);
  });

  it('kinds all sigue ocultando recetario', () => {
    expect(
      taskMatchesFilters(task({ kind: 'rx_pet' }), { kinds: 'all' })
    ).toBe(false);
    expect(taskMatchesFilters(task({ kind: 'task' }), { kinds: 'all' })).toBe(
      true
    );
  });

  it('category legado sigue funcionando si kinds no está', () => {
    expect(
      taskMatchesFilters(task({ kind: 'event' }), { category: 'events' })
    ).toBe(true);
    expect(
      taskMatchesFilters(task({ kind: 'task' }), { category: 'events' })
    ).toBe(false);
    expect(resolvedKindGroups({ category: 'projects' })).toEqual(['tasks']);
  });
});

describe('holidays vs tasks', () => {
  it('feriados se pueden apagar sin apagar tareas', () => {
    const filters: BoardTaskFilters = {
      kinds: ['tasks', 'events', 'possible', 'habits', 'finances'],
    };
    expect(boardShowsHolidays(filters)).toBe(false);
    expect(boardShowsTasks(filters)).toBe(true);
  });

  it('solo feriados no muestra tareas', () => {
    const filters: BoardTaskFilters = { kinds: ['holidays'] };
    expect(boardShowsHolidays(filters)).toBe(true);
    expect(boardShowsTasks(filters)).toBe(false);
    expect(taskMatchesFilters(task({ kind: 'task' }), filters)).toBe(false);
  });
});

describe('toggleProjectKey', () => {
  const keys = [BOARD_NO_PROJECT, 'amsa', 'cs'];
  it('deseleccionar uno sale de all', () => {
    expect(toggleProjectKey('all', 'amsa', keys)).toEqual([
      BOARD_NO_PROJECT,
      'cs',
    ]);
  });
  it('volver a marcar todos regresa a all', () => {
    const one = toggleProjectKey('all', 'amsa', keys);
    expect(toggleProjectKey(one, 'amsa', keys)).toBe('all');
  });
});
