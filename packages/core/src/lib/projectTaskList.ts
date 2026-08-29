import type { LocatedTaskRow } from '../services/taskService';
import { isRecurring } from './recurrence';

export type ProjectListTask = LocatedTaskRow & {
  seriesCount: number;
};

/**
 * Una fila por serie recurrente. Las ocurrencias sueltas no se fusionan.
 */
export function collapseProjectTaskSeries(rows: LocatedTaskRow[]): ProjectListTask[] {
  const singles: ProjectListTask[] = [];
  const bySeries = new Map<string, LocatedTaskRow[]>();
  for (const row of rows) {
    if (!row.seriesId || !isRecurring(row.recurrence)) {
      singles.push({ ...row, seriesCount: 1 });
      continue;
    }
    const list = bySeries.get(row.seriesId) ?? [];
    list.push(row);
    bySeries.set(row.seriesId, list);
  }
  for (const group of bySeries.values()) {
    group.sort((a, b) => {
      const byDay = a.dayId.localeCompare(b.dayId);
      if (byDay !== 0) return byDay;
      return a.id.localeCompare(b.id);
    });
    const open = group.find(r => !r.completed) ?? group[group.length - 1]!;
    singles.push({ ...open, seriesCount: group.length });
  }
  return singles;
}
