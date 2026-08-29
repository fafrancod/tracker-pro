import { addDays, addMonths, differenceInCalendarDays, format, startOfMonth } from 'date-fns';
import { civilDateFromDayId } from './civilDate';
import { isFinanceKind } from './financeKinds';
import { isHabitKind } from './habits';
import { isRxKind } from './rx';
import { BOARD_NO_PROJECT } from './boardFilters';
import type { Project, TaskKind } from '../types';

/** Ítems que viven en la carta Gantt (planificación). */
export const GANTT_KINDS = [
  'task',
  'reminder',
  'event',
  'possible_event',
] as const;

export type GanttKind = (typeof GANTT_KINDS)[number];

export type GanttScale = 'day' | 'week' | 'month';

/** Horizonte visible (pasado corto + futuro). `all` usa min/max de los datos. */
export type GanttHorizon = '3m' | '6m' | '1y' | '2y' | 'all';

export const GANTT_PX_PER_DAY: Record<GanttScale, number> = {
  day: 28,
  week: 12,
  month: 5,
};

export interface GanttSourceRow {
  id: string;
  title: string;
  kind: TaskKind | string;
  completed: boolean;
  projectId: string | null;
  projectCategoryId: string | null;
  color: string | null;
  weekId: string;
  dayId: string;
  endDayId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  seriesId?: string | null;
}

export interface GanttOccurrence {
  id: string;
  weekId: string;
  startDayId: string;
  endDayId: string;
  completed: boolean;
}

export interface GanttItem {
  id: string;
  title: string;
  kind: GanttKind;
  completed: boolean;
  projectId: string | null;
  projectCategoryId: string | null;
  color: string | null;
  weekId: string;
  startDayId: string;
  endDayId: string;
  startTime: string | null;
  endTime: string | null;
  seriesId: string | null;
  occurrences: GanttOccurrence[];
}

export interface GanttCategoryGroup {
  key: string;
  categoryId: string | null;
  categoryName: string;
  items: GanttItem[];
  spanStart: string;
  spanEnd: string;
  urgencyColor: string | null;
  importanceColor: string | null;
}

export interface GanttProjectGroup {
  key: string;
  projectId: string | null;
  projectName: string;
  projectColor: string;
  projectOrder: number;
  categories: GanttCategoryGroup[];
  spanStart: string;
  spanEnd: string;
  itemCount: number;
}

export interface GanttBarLayout {
  left: number;
  width: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface GanttMonthHeader {
  startDayId: string;
  offset: number;
  days: number;
  year: number;
  month: number;
}

export interface GanttHorizonWindow {
  from: string;
  to: string;
}

const UNLABELED_PROJECT = '—';
const UNLABELED_CATEGORY = '—';
const FALLBACK_COLOR = '#7d8590';

export function isGanttKind(kind: TaskKind | string | null | undefined): kind is GanttKind {
  return (
    kind === 'task' ||
    kind === 'reminder' ||
    kind === 'event' ||
    kind === 'possible_event'
  );
}

export function shouldExcludeFromGantt(kind: TaskKind | string | null | undefined): boolean {
  return isRxKind(kind) || isHabitKind(kind) || isFinanceKind(kind) || !isGanttKind(kind);
}

export function toGanttItem(row: GanttSourceRow): GanttItem | null {
  if (!isGanttKind(row.kind)) return null;
  const start = row.dayId;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const end = row.endDayId && row.endDayId >= start ? row.endDayId : start;
  const occ: GanttOccurrence = {
    id: row.id,
    weekId: row.weekId,
    startDayId: start,
    endDayId: end,
    completed: row.completed,
  };
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    completed: row.completed,
    projectId: row.projectId ?? null,
    projectCategoryId: row.projectCategoryId ?? null,
    color: row.color ?? null,
    weekId: row.weekId,
    startDayId: start,
    endDayId: end,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    seriesId: row.seriesId ?? null,
    occurrences: [occ],
  };
}

function occurrenceOf(item: GanttItem): GanttOccurrence {
  return (
    item.occurrences[0] ?? {
      id: item.id,
      weekId: item.weekId,
      startDayId: item.startDayId,
      endDayId: item.endDayId,
      completed: item.completed,
    }
  );
}

/**
 * Una fila por serie recurrente. Las instancias sueltas (sin seriesId) no se fusionan.
 * En la fila quedan N barras (`occurrences`), no N filas.
 */
/** Sustituye filas remotas por la versión del store (mismo id). */
export function overlayRowsById<T extends { id: string }>(
  remote: T[],
  fresh: Iterable<T>
): T[] {
  const byId = new Map<string, T>();
  for (const row of fresh) byId.set(row.id, row);
  if (byId.size === 0) return remote;
  return remote.map(row => byId.get(row.id) ?? row);
}

export function collapseGanttSeries(items: GanttItem[]): GanttItem[] {
  const singles: GanttItem[] = [];
  const bySeries = new Map<string, GanttItem[]>();
  for (const item of items) {
    if (!item.seriesId) {
      singles.push(item.occurrences.length ? item : { ...item, occurrences: [occurrenceOf(item)] });
      continue;
    }
    const list = bySeries.get(item.seriesId) ?? [];
    list.push(item);
    bySeries.set(item.seriesId, list);
  }

  const collapsed: GanttItem[] = [];
  for (const group of bySeries.values()) {
    const occs = group
      .flatMap(i => (i.occurrences.length ? i.occurrences : [occurrenceOf(i)]))
      .sort(
        (a, b) =>
          a.startDayId.localeCompare(b.startDayId) ||
          a.endDayId.localeCompare(b.endDayId) ||
          a.id.localeCompare(b.id)
      );
    const seen = new Set<string>();
    const unique: GanttOccurrence[] = [];
    for (const occ of occs) {
      if (seen.has(occ.id)) continue;
      seen.add(occ.id);
      unique.push(occ);
    }
    const first = unique[0];
    const last = unique[unique.length - 1];
    const open = unique.find(o => !o.completed);
    const representative =
      group.find(i => i.id === (open ?? first).id) ?? group[0];
    collapsed.push({
      ...representative,
      id: representative.id,
      weekId: (open ?? first).weekId,
      startDayId: first.startDayId,
      endDayId: last.endDayId,
      completed: unique.every(o => o.completed),
      seriesId: representative.seriesId,
      occurrences: unique,
    });
  }

  return [...singles, ...collapsed];
}

export function ganttDayOffset(fromDayId: string, dayId: string): number {
  return differenceInCalendarDays(
    civilDateFromDayId(dayId),
    civilDateFromDayId(fromDayId)
  );
}

export function ganttInclusiveDays(startDayId: string, endDayId: string): number {
  return ganttDayOffset(startDayId, endDayId) + 1;
}

export function ganttPxPerDay(scale: GanttScale): number {
  return GANTT_PX_PER_DAY[scale];
}

export function ganttBarLayout(
  item: Pick<GanttItem, 'startDayId' | 'endDayId'>,
  rangeFrom: string,
  rangeTo: string,
  pxPerDay: number
): GanttBarLayout | null {
  const start = item.startDayId > rangeFrom ? item.startDayId : rangeFrom;
  const end = item.endDayId < rangeTo ? item.endDayId : rangeTo;
  if (end < rangeFrom || start > rangeTo || start > end) return null;
  const left = ganttDayOffset(rangeFrom, start) * pxPerDay;
  const days = ganttInclusiveDays(start, end);
  const width = Math.max(pxPerDay * 0.55, days * pxPerDay - 1);
  return {
    left,
    width,
    clippedStart: item.startDayId < rangeFrom,
    clippedEnd: item.endDayId > rangeTo,
  };
}

export function ganttItemColor(item: GanttItem, projectColor: string | null | undefined): string {
  if (item.color && /^#[0-9A-Fa-f]{6}$/.test(item.color)) return item.color;
  if (projectColor && /^#[0-9A-Fa-f]{6}$/.test(projectColor)) return projectColor;
  if (item.kind === 'event') return '#3fb950';
  if (item.kind === 'possible_event') return '#d29922';
  return '#58a6ff';
}

/**
 * Ventana de fetch/display para un horizonte anclado en `todayId`.
 * `all` no tiene ventana fija: el caller debe usar fetchAll + min/max de ítems.
 */
export function ganttHorizonWindow(
  todayId: string,
  horizon: GanttHorizon
): GanttHorizonWindow | null {
  if (horizon === 'all') return null;
  const today = civilDateFromDayId(todayId);
  let backMonths: number;
  let forwardMonths: number;
  switch (horizon) {
    case '3m':
      backMonths = 1;
      forwardMonths = 3;
      break;
    case '6m':
      backMonths = 2;
      forwardMonths = 6;
      break;
    case '1y':
      backMonths = 3;
      forwardMonths = 12;
      break;
    case '2y':
      backMonths = 6;
      forwardMonths = 24;
      break;
  }
  const from = format(addMonths(today, -backMonths), 'yyyy-MM-dd');
  const to = format(addDays(addMonths(today, forwardMonths), -1), 'yyyy-MM-dd');
  return from <= to ? { from, to } : { from: todayId, to: todayId };
}

/** Rango visible: horizonte fijo, o span de ítems (con padding) si horizon=all. */
export function ganttDisplayRange(
  items: GanttItem[],
  todayId: string,
  horizon: GanttHorizon
): GanttHorizonWindow {
  const fixed = ganttHorizonWindow(todayId, horizon);
  if (fixed) return fixed;
  if (items.length === 0) {
    return {
      from: format(addDays(civilDateFromDayId(todayId), -14), 'yyyy-MM-dd'),
      to: format(addDays(civilDateFromDayId(todayId), 45), 'yyyy-MM-dd'),
    };
  }
  let min = items[0].startDayId;
  let max = items[0].endDayId;
  for (const item of items) {
    if (item.startDayId < min) min = item.startDayId;
    if (item.endDayId > max) max = item.endDayId;
  }
  return {
    from: format(addDays(civilDateFromDayId(min), -7), 'yyyy-MM-dd'),
    to: format(addDays(civilDateFromDayId(max), 7), 'yyyy-MM-dd'),
  };
}

export function ganttMonthHeaders(from: string, to: string): GanttMonthHeader[] {
  const out: GanttMonthHeader[] = [];
  let cursor = startOfMonth(civilDateFromDayId(from));
  const last = civilDateFromDayId(to);
  while (cursor <= last) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const startDayId = format(
      cursor < civilDateFromDayId(from) ? civilDateFromDayId(from) : cursor,
      'yyyy-MM-dd'
    );
    const next = addMonths(startOfMonth(cursor), 1);
    const endExclusive = next;
    const rangeEnd = addDays(civilDateFromDayId(to), 1);
    const clipEnd = endExclusive < rangeEnd ? endExclusive : rangeEnd;
    const days = differenceInCalendarDays(clipEnd, civilDateFromDayId(startDayId));
    if (days > 0) {
      out.push({
        startDayId,
        offset: ganttDayOffset(from, startDayId),
        days,
        year,
        month,
      });
    }
    cursor = next;
  }
  return out;
}

export function ganttWeekendOffsets(from: string, to: string): number[] {
  const start = civilDateFromDayId(from);
  const n = ganttInclusiveDays(from, to);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const wd = addDays(start, i).getDay();
    if (wd === 0 || wd === 6) out.push(i);
  }
  return out;
}

export function ganttTimelineWidth(from: string, to: string, pxPerDay: number): number {
  return Math.max(pxPerDay, ganttInclusiveDays(from, to) * pxPerDay);
}

function spanOf(items: GanttItem[]): { spanStart: string; spanEnd: string } {
  let spanStart = items[0].startDayId;
  let spanEnd = items[0].endDayId;
  for (const item of items) {
    if (item.startDayId < spanStart) spanStart = item.startDayId;
    if (item.endDayId > spanEnd) spanEnd = item.endDayId;
  }
  return { spanStart, spanEnd };
}

function sortItems(items: GanttItem[]): GanttItem[] {
  return [...items].sort(
    (a, b) =>
      a.startDayId.localeCompare(b.startDayId) ||
      a.endDayId.localeCompare(b.endDayId) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
  );
}

function ganttProjectKey(projectId: string | null): string {
  return projectId ?? BOARD_NO_PROJECT;
}

function itemMatchesProjectScope(
  item: GanttItem,
  opts?: {
    projectId?: string | null;
    projectIds?: string[] | 'all';
  }
): boolean {
  if (opts?.projectIds !== undefined) {
    if (opts.projectIds === 'all') return true;
    return opts.projectIds.includes(ganttProjectKey(item.projectId));
  }
  const scopedProjectId = opts?.projectId;
  if (scopedProjectId === undefined) return true;
  if (scopedProjectId === null) return item.projectId === null;
  return item.projectId === scopedProjectId;
}

export function buildGanttGroups(
  items: GanttItem[],
  projects: Project[],
  opts?: {
    projectId?: string | null;
    /** Multi-select. `'all'` = sin filtro. `[]` = ninguno. Gana sobre `projectId`. */
    projectIds?: string[] | 'all';
    kinds?: readonly GanttKind[];
    includeCompleted?: boolean;
    unlabeledProject?: string;
    unlabeledCategory?: string;
  }
): GanttProjectGroup[] {
  const unlabeledProject = opts?.unlabeledProject ?? UNLABELED_PROJECT;
  const unlabeledCategory = opts?.unlabeledCategory ?? UNLABELED_CATEGORY;
  const includeCompleted = opts?.includeCompleted ?? true;
  const kindSet = opts?.kinds ? new Set(opts.kinds) : null;

  const filtered: GanttItem[] = [];
  for (const raw of items) {
    if (kindSet && !kindSet.has(raw.kind)) continue;
    if (!itemMatchesProjectScope(raw, opts)) continue;
    let item = raw;
    if (!includeCompleted) {
      const occs = (item.occurrences.length ? item.occurrences : [occurrenceOf(item)]).filter(
        o => !o.completed
      );
      if (occs.length === 0) continue;
      const first = occs[0];
      const last = occs[occs.length - 1];
      item = {
        ...item,
        occurrences: occs,
        startDayId: first.startDayId,
        endDayId: last.endDayId,
        completed: false,
        id: occs.find(o => o.id === item.id)?.id ?? first.id,
        weekId: first.weekId,
      };
    }
    filtered.push(item);
  }

  const projectById = new Map(projects.map(p => [p.id, p]));

  type CatBucket = { categoryId: string | null; items: GanttItem[] };
  type ProjBucket = {
    projectId: string | null;
    cats: Map<string, CatBucket>;
  };
  const projMap = new Map<string, ProjBucket>();

  for (const item of filtered) {
    const pKey = ganttProjectKey(item.projectId);
    let proj = projMap.get(pKey);
    if (!proj) {
      proj = { projectId: item.projectId, cats: new Map() };
      projMap.set(pKey, proj);
    }
    const project = item.projectId ? projectById.get(item.projectId) : undefined;
    const validCat =
      project && item.projectCategoryId
        ? project.categories.some(c => c.id === item.projectCategoryId)
        : false;
    const cKey = validCat ? item.projectCategoryId! : '__none__';
    let cat = proj.cats.get(cKey);
    if (!cat) {
      cat = { categoryId: validCat ? item.projectCategoryId : null, items: [] };
      proj.cats.set(cKey, cat);
    }
    cat.items.push(item);
  }

  const groups: GanttProjectGroup[] = [];

  for (const [pKey, bucket] of projMap) {
    const project = bucket.projectId ? projectById.get(bucket.projectId) : undefined;
    const categories: GanttCategoryGroup[] = [];
    for (const [cKey, cat] of bucket.cats) {
      const sorted = sortItems(cat.items);
      const catMeta =
        project && cat.categoryId
          ? project.categories.find(c => c.id === cat.categoryId)
          : undefined;
      const { spanStart, spanEnd } = spanOf(sorted);
      categories.push({
        key: `${pKey}:${cKey}`,
        categoryId: cat.categoryId,
        categoryName: catMeta?.name ?? unlabeledCategory,
        items: sorted,
        spanStart,
        spanEnd,
        urgencyColor: catMeta?.urgencyColor ?? null,
        importanceColor: catMeta?.importanceColor ?? null,
      });
    }
    categories.sort((a, b) => {
      if (a.categoryId === null && b.categoryId !== null) return 1;
      if (a.categoryId !== null && b.categoryId === null) return -1;
      const ao =
        project?.categories.find(c => c.id === a.categoryId)?.order ?? 999;
      const bo =
        project?.categories.find(c => c.id === b.categoryId)?.order ?? 999;
      return ao - bo || a.categoryName.localeCompare(b.categoryName);
    });

    const allItems = categories.flatMap(c => c.items);
    const { spanStart, spanEnd } = spanOf(allItems);
    groups.push({
      key: pKey,
      projectId: bucket.projectId,
      projectName: project?.name ?? (bucket.projectId ? unlabeledProject : unlabeledProject),
      projectColor: project?.color ?? FALLBACK_COLOR,
      projectOrder: project?.order ?? (bucket.projectId ? 998 : 999),
      categories,
      spanStart,
      spanEnd,
      itemCount: allItems.length,
    });
  }

  groups.sort((a, b) => a.projectOrder - b.projectOrder || a.projectName.localeCompare(b.projectName));
  return groups;
}
