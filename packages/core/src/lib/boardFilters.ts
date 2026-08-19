import type {
  BoardCategoryFilter,
  BoardTaskFilters,
  Importance,
  PersistedBoardFilters,
  Task,
  TaskKind,
  Urgency,
} from '../types';

/** Sentinel: tareas sin proyecto en el multi-select. */
export const BOARD_NO_PROJECT = '__none__';

export type BoardKindGroup =
  | 'tasks'
  | 'events'
  | 'possible'
  | 'habits'
  | 'finances'
  | 'holidays';

export const ALL_BOARD_KIND_GROUPS: readonly BoardKindGroup[] = [
  'tasks',
  'events',
  'possible',
  'habits',
  'finances',
  'holidays',
] as const;

export function taskKindGroup(
  kind: TaskKind | string | null | undefined
): BoardKindGroup | null {
  switch (kind ?? 'task') {
    case 'task':
    case 'reminder':
      return 'tasks';
    case 'event':
      return 'events';
    case 'possible_event':
      return 'possible';
    case 'habit_good':
    case 'habit_quit':
      return 'habits';
    case 'finance_income':
    case 'finance_expense':
      return 'finances';
    default:
      return null;
  }
}

/**
 * Grupos visibles. `'all'` = todos (salvo recetario).
 * Si `kinds` no viene, se traduce el `category` exclusivo legado.
 */
export function resolvedKindGroups(
  filters: BoardTaskFilters | null | undefined
): BoardKindGroup[] | 'all' {
  if (!filters) return 'all';
  if (filters.kinds && filters.kinds !== 'all') return filters.kinds;
  const cat: BoardCategoryFilter | undefined = filters.category;
  if (!cat || cat === 'all' || cat === 'rx') return 'all';
  if (cat === 'projects') return ['tasks'];
  if (cat === 'events') return ['events'];
  if (cat === 'possible') return ['possible'];
  if (cat === 'habits') return ['habits'];
  if (cat === 'finances') return ['finances'];
  if (cat === 'holidays') return ['holidays'];
  return 'all';
}

export function boardShowsHolidays(filters?: BoardTaskFilters | null): boolean {
  const groups = resolvedKindGroups(filters);
  return groups === 'all' || groups.includes('holidays');
}

export function boardShowsTasks(filters?: BoardTaskFilters | null): boolean {
  const groups = resolvedKindGroups(filters);
  if (groups === 'all') return true;
  return groups.some(g => g !== 'holidays');
}

export const DEFAULT_PERSISTED_BOARD_FILTERS: PersistedBoardFilters = {
  kinds: 'all',
  projectIds: 'all',
  urgency: 'all',
  importance: 'all',
};

const URGENCY_SET = new Set<string>(['all', 'urgent', 'not_urgent']);
const IMPORTANCE_SET = new Set<string>(['all', 'important', 'not_important']);

export function normalizePersistedBoardFilters(
  raw: unknown
): PersistedBoardFilters {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PERSISTED_BOARD_FILTERS };
  const o = raw as Record<string, unknown>;
  let kinds: BoardKindGroup[] | 'all' = 'all';
  if (o.kinds === 'all') {
    kinds = 'all';
  } else if (Array.isArray(o.kinds)) {
    const rawKinds = o.kinds;
    const next = ALL_BOARD_KIND_GROUPS.filter(g => rawKinds.includes(g));
    kinds =
      next.length === 0
        ? []
        : next.length === ALL_BOARD_KIND_GROUPS.length
          ? 'all'
          : next;
  }
  let projectIds: string[] | 'all' = 'all';
  if (o.projectIds === 'all') {
    projectIds = 'all';
  } else if (Array.isArray(o.projectIds)) {
    projectIds = o.projectIds.filter(
      (id): id is string =>
        typeof id === 'string' && (id === BOARD_NO_PROJECT || id.length > 0)
    );
  }
  const urgency = (
    typeof o.urgency === 'string' && URGENCY_SET.has(o.urgency) ? o.urgency : 'all'
  ) as Urgency | 'all';
  const importance = (
    typeof o.importance === 'string' && IMPORTANCE_SET.has(o.importance)
      ? o.importance
      : 'all'
  ) as Importance | 'all';
  return { kinds, projectIds, urgency, importance };
}

export function toPersistedBoardFilters(
  filters: BoardTaskFilters
): PersistedBoardFilters {
  return normalizePersistedBoardFilters({
    kinds: filters.kinds ?? 'all',
    projectIds: filters.projectIds ?? 'all',
    urgency: filters.urgency ?? 'all',
    importance: filters.importance ?? 'all',
  });
}

export function toggleKindGroup(
  current: BoardKindGroup[] | 'all' | undefined,
  group: BoardKindGroup
): BoardKindGroup[] | 'all' {
  const set = new Set(current === 'all' || !current ? ALL_BOARD_KIND_GROUPS : current);
  if (set.has(group)) set.delete(group);
  else set.add(group);
  const next = ALL_BOARD_KIND_GROUPS.filter(g => set.has(g));
  return next.length === ALL_BOARD_KIND_GROUPS.length ? 'all' : next;
}

export function toggleProjectKey(
  current: string[] | 'all' | undefined,
  key: string,
  allKeys: string[]
): string[] | 'all' {
  const base = current === 'all' || !current ? allKeys : current;
  const set = new Set(base);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  const next = allKeys.filter(k => set.has(k));
  if (next.length === allKeys.length) return 'all';
  return next;
}

export function taskMatchesFilters(
  task: Pick<Task, 'projectId' | 'urgency' | 'importance' | 'kind' | 'completed'>,
  filters: BoardTaskFilters
): boolean {
  const kind = task.kind ?? 'task';
  const isRx = kind === 'rx_human' || kind === 'rx_pet';

  if (filters.hideCompleted && task.completed) {
    return false;
  }

  if (isRx && filters.category !== 'rx') {
    return false;
  }

  const groups = resolvedKindGroups(filters);
  if (groups !== 'all') {
    const group = taskKindGroup(kind);
    if (!group || !groups.includes(group)) return false;
  }

  if (filters.projectIds && filters.projectIds !== 'all') {
    const key = task.projectId ?? BOARD_NO_PROJECT;
    if (!filters.projectIds.includes(key)) return false;
  } else if (filters.projectId && filters.projectId !== 'all') {
    if (task.projectId !== filters.projectId) return false;
  }

  if (filters.urgency && filters.urgency !== 'all') {
    if (task.urgency !== filters.urgency) return false;
  }
  if (filters.importance && filters.importance !== 'all') {
    if (task.importance !== filters.importance) return false;
  }
  return true;
}
