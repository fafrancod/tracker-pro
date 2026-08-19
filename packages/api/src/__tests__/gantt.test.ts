import { describe, it, expect } from 'vitest';
import {
  kindSupportsProject,
  collapseGanttSeries,
  buildGanttGroups,
  ganttBarLayout,
  ganttDayOffset,
  ganttDisplayRange,
  ganttHorizonWindow,
  ganttInclusiveDays,
  ganttItemColor,
  ganttMonthHeaders,
  ganttPxPerDay,
  ganttTimelineWidth,
  isGanttKind,
  shouldExcludeFromGantt,
  toGanttItem,
  type GanttItem,
  type GanttSourceRow,
} from '@daily-tracker/core';
import type { Project } from '@daily-tracker/core';

function row(partial: Partial<GanttSourceRow> & Pick<GanttSourceRow, 'id' | 'title' | 'kind' | 'dayId'>): GanttSourceRow {
  return {
    completed: false,
    projectId: null,
    projectCategoryId: null,
    color: null,
    weekId: '2026-W33',
    endDayId: partial.dayId,
    startTime: null,
    endTime: null,
    ...partial,
  };
}

function item(partial: Partial<GanttItem> & Pick<GanttItem, 'id' | 'title' | 'kind' | 'startDayId'>): GanttItem {
  const endDayId = partial.endDayId ?? partial.startDayId;
  return {
    completed: false,
    projectId: null,
    projectCategoryId: null,
    color: null,
    weekId: '2026-W33',
    endDayId,
    startTime: null,
    endTime: null,
    seriesId: null,
    occurrences: [
      {
        id: partial.id,
        weekId: partial.weekId ?? '2026-W33',
        startDayId: partial.startDayId,
        endDayId,
        completed: partial.completed ?? false,
      },
    ],
    ...partial,
  };
}

const cerebro: Project = {
  id: 'cs',
  name: 'CerebroStudios',
  color: '#58a6ff',
  icon: '🧠',
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  categories: [
    { id: 'curso', name: 'Curso de Produccion Musical', order: 0 },
    { id: 'otro', name: 'Otro', order: 1 },
  ],
};

const amsa: Project = {
  id: 'amsa',
  name: 'AMSA',
  color: '#3fb950',
  icon: '🏭',
  order: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  categories: [{ id: 'mig', name: 'Migración reportes', order: 0 }],
};

describe('kindSupportsProject', () => {
  it('admite tarea, recordatorio, evento y evento posible', () => {
    expect(kindSupportsProject('task')).toBe(true);
    expect(kindSupportsProject('reminder')).toBe(true);
    expect(kindSupportsProject('event')).toBe(true);
    expect(kindSupportsProject('possible_event')).toBe(true);
  });

  it('rechaza hábitos, recetario y finanzas', () => {
    expect(kindSupportsProject('habit_good')).toBe(false);
    expect(kindSupportsProject('rx_human')).toBe(false);
    expect(kindSupportsProject('finance_expense')).toBe(false);
  });
});

describe('gantt kinds', () => {
  it('incluye tarea, recordatorio, evento y evento posible', () => {
    expect(isGanttKind('task')).toBe(true);
    expect(isGanttKind('reminder')).toBe(true);
    expect(isGanttKind('event')).toBe(true);
    expect(isGanttKind('possible_event')).toBe(true);
  });

  it('excluye recetario, hábitos y finanzas', () => {
    expect(shouldExcludeFromGantt('rx_human')).toBe(true);
    expect(shouldExcludeFromGantt('habit_good')).toBe(true);
    expect(shouldExcludeFromGantt('finance_expense')).toBe(true);
    expect(toGanttItem(row({ id: '1', title: 'x', kind: 'rx_pet', dayId: '2026-08-01' }))).toBeNull();
  });
});

describe('gantt geometry', () => {
  it('offset y duración inclusiva', () => {
    expect(ganttDayOffset('2026-08-01', '2026-08-01')).toBe(0);
    expect(ganttDayOffset('2026-08-01', '2026-08-11')).toBe(10);
    expect(ganttInclusiveDays('2026-08-01', '2026-08-03')).toBe(3);
  });

  it('barra de un día y de rango, recortada al horizonte', () => {
    const px = ganttPxPerDay('day');
    const single = ganttBarLayout(
      { startDayId: '2026-08-05', endDayId: '2026-08-05' },
      '2026-08-01',
      '2026-08-31',
      px
    );
    expect(single).toEqual({
      left: 4 * px,
      width: px - 1,
      clippedStart: false,
      clippedEnd: false,
    });

    const clipped = ganttBarLayout(
      { startDayId: '2026-07-20', endDayId: '2026-08-10' },
      '2026-08-01',
      '2026-08-31',
      px
    );
    expect(clipped?.clippedStart).toBe(true);
    expect(clipped?.clippedEnd).toBe(false);
    expect(clipped?.left).toBe(0);
    expect(clipped?.width).toBe(10 * px - 1);
  });

  it('fuera de rango → null', () => {
    expect(
      ganttBarLayout(
        { startDayId: '2026-06-01', endDayId: '2026-06-10' },
        '2026-08-01',
        '2026-08-31',
        10
      )
    ).toBeNull();
  });

  it('ancho de timeline y cabeceras de mes', () => {
    expect(ganttTimelineWidth('2026-08-01', '2026-08-02', 10)).toBe(20);
    const months = ganttMonthHeaders('2026-07-20', '2026-09-05');
    expect(months.map(m => `${m.year}-${m.month}`)).toEqual([
      '2026-7',
      '2026-8',
      '2026-9',
    ]);
    expect(months[0].offset).toBe(0);
    expect(months[0].days).toBe(12);
  });
});

describe('gantt horizon', () => {
  it('3m mira 1 mes atrás y 3 adelante', () => {
    const w = ganttHorizonWindow('2026-08-19', '3m');
    expect(w).toEqual({ from: '2026-07-19', to: '2026-11-18' });
  });

  it('all usa min/max de ítems con padding', () => {
    const range = ganttDisplayRange(
      [
        item({ id: 'a', title: 'A', kind: 'task', startDayId: '2026-03-10', endDayId: '2026-03-12' }),
        item({ id: 'b', title: 'B', kind: 'event', startDayId: '2026-09-01', endDayId: '2026-09-01' }),
      ],
      '2026-08-19',
      'all'
    );
    expect(range.from).toBe('2026-03-03');
    expect(range.to).toBe('2026-09-08');
  });
});

describe('buildGanttGroups', () => {
  const items: GanttItem[] = [
    item({
      id: 't1',
      title: 'Grabar módulo 1',
      kind: 'task',
      startDayId: '2026-09-01',
      endDayId: '2026-09-10',
      projectId: 'cs',
      projectCategoryId: 'curso',
    }),
    item({
      id: 'e1',
      title: 'Ensayo',
      kind: 'event',
      startDayId: '2026-09-05',
      projectId: 'cs',
      projectCategoryId: 'curso',
    }),
    item({
      id: 'p1',
      title: 'Festival (posible)',
      kind: 'possible_event',
      startDayId: '2026-10-01',
      endDayId: '2026-10-03',
      projectId: 'cs',
      projectCategoryId: 'curso',
    }),
    item({
      id: 'm1',
      title: 'Inventario reportes',
      kind: 'task',
      startDayId: '2026-08-20',
      endDayId: '2026-09-30',
      projectId: 'amsa',
      projectCategoryId: 'mig',
    }),
    item({
      id: 'loose',
      title: 'Dentista',
      kind: 'reminder',
      startDayId: '2026-08-22',
    }),
    item({
      id: 'done',
      title: 'Hecho',
      kind: 'task',
      startDayId: '2026-08-01',
      projectId: 'cs',
      projectCategoryId: 'curso',
      completed: true,
    }),
  ];

  it('macro: agrupa por proyecto y subproyecto', () => {
    const groups = buildGanttGroups(items, [cerebro, amsa], {
      unlabeledProject: 'Sin proyecto',
      unlabeledCategory: 'Sin subproyecto',
    });
    expect(groups.map(g => g.projectName)).toEqual([
      'CerebroStudios',
      'AMSA',
      'Sin proyecto',
    ]);
    const cs = groups[0];
    expect(cs.categories.map(c => c.categoryName)).toEqual(['Curso de Produccion Musical']);
    expect(cs.categories[0].items.map(i => i.id)).toEqual(['done', 't1', 'e1', 'p1']);
    expect(groups[1].categories[0].categoryName).toBe('Migración reportes');
    expect(groups[2].categories[0].items[0].id).toBe('loose');
  });

  it('proyecto: solo el subárbol pedido', () => {
    const groups = buildGanttGroups(items, [cerebro, amsa], { projectId: 'amsa' });
    expect(groups).toHaveLength(1);
    expect(groups[0].itemCount).toBe(1);
    expect(groups[0].categories[0].items[0].title).toBe('Inventario reportes');
  });

  it('filtra tipos y completados', () => {
    const onlyEvents = buildGanttGroups(items, [cerebro, amsa], {
      kinds: ['event', 'possible_event'],
    });
    expect(onlyEvents.flatMap(g => g.categories.flatMap(c => c.items)).map(i => i.id)).toEqual([
      'e1',
      'p1',
    ]);
    const open = buildGanttGroups(items, [cerebro, amsa], { includeCompleted: false });
    expect(open[0].categories[0].items.some(i => i.id === 'done')).toBe(false);
  });

  it('categoría huérfana cae en sin subproyecto', () => {
    const groups = buildGanttGroups(
      [
        item({
          id: 'x',
          title: 'Huérfana',
          kind: 'task',
          startDayId: '2026-08-01',
          projectId: 'cs',
          projectCategoryId: 'deleted-cat',
        }),
      ],
      [cerebro],
      { unlabeledCategory: 'Sin subproyecto' }
    );
    expect(groups[0].categories[0].categoryName).toBe('Sin subproyecto');
  });
});

describe('collapseGanttSeries', () => {
  it('una serie semanal es una sola fila con N barras', () => {
    const rows = [
      item({
        id: 'a',
        title: 'Standup',
        kind: 'event',
        startDayId: '2026-08-03',
        seriesId: 'ser-1',
      }),
      item({
        id: 'b',
        title: 'Standup',
        kind: 'event',
        startDayId: '2026-08-10',
        seriesId: 'ser-1',
      }),
      item({
        id: 'c',
        title: 'Standup',
        kind: 'event',
        startDayId: '2026-08-17',
        seriesId: 'ser-1',
        completed: true,
      }),
      item({
        id: 'solo',
        title: 'Única',
        kind: 'task',
        startDayId: '2026-08-04',
      }),
    ];
    const collapsed = collapseGanttSeries(rows);
    expect(collapsed).toHaveLength(2);
    const series = collapsed.find(i => i.seriesId === 'ser-1')!;
    expect(series.occurrences).toHaveLength(3);
    expect(series.startDayId).toBe('2026-08-03');
    expect(series.endDayId).toBe('2026-08-17');
    expect(series.completed).toBe(false);
    expect(collapsed.find(i => i.id === 'solo')).toBeTruthy();
  });

  it('ocultar completados deja la serie si queda alguna abierta', () => {
    const collapsed = collapseGanttSeries([
      item({
        id: 'a',
        title: 'Pago',
        kind: 'task',
        startDayId: '2026-07-01',
        seriesId: 'rent',
        completed: true,
      }),
      item({
        id: 'b',
        title: 'Pago',
        kind: 'task',
        startDayId: '2026-08-01',
        seriesId: 'rent',
      }),
    ]);
    const groups = buildGanttGroups(collapsed, [], { includeCompleted: false });
    expect(groups[0].categories[0].items).toHaveLength(1);
    expect(groups[0].categories[0].items[0].occurrences).toHaveLength(1);
    expect(groups[0].categories[0].items[0].occurrences[0].id).toBe('b');
  });
});

describe('ganttItemColor', () => {
  it('prioriza color propio, luego proyecto, luego kind', () => {
    expect(
      ganttItemColor(item({ id: '1', title: 'a', kind: 'task', startDayId: '2026-01-01', color: '#ff00aa' }), '#111111')
    ).toBe('#ff00aa');
    expect(
      ganttItemColor(item({ id: '1', title: 'a', kind: 'event', startDayId: '2026-01-01' }), '#3fb950')
    ).toBe('#3fb950');
    expect(
      ganttItemColor(item({ id: '1', title: 'a', kind: 'possible_event', startDayId: '2026-01-01' }), null)
    ).toBe('#d29922');
  });
});
