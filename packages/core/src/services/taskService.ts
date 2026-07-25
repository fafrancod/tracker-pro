import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import {
  materializeOccurrenceRanges,
  normalizeRecurrence,
  getWeekIdFromDayId,
} from '../lib/recurrence';
import type {
  Task,
  CreateTaskPayload,
  UpdateTaskPayload,
  RematerializeRxPayload,
  Recurrence,
} from '../types';
import { isRxKind, materializeRxOccurrences, buildRxMetaForOccurrence, parseRxMeta } from '../lib/rx';
import {
  isHabitKind,
  isVirtualHabitId,
  parseVirtualHabitId,
} from '../lib/habits';
import { kindSupportsSteps, normalizeTaskSteps } from '../lib/steps';
import { extractHashtags, mergeTags } from '../lib/tags';
import { findTaskLocation, useStore } from '../store';
import { getISOWeek, format } from 'date-fns';

export type TasksUnsubscribe = () => void;

export type LocatedTaskRow = Task & { weekId: string; dayId: string };

export function getWeekId(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getDayId(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Tareas que empiezan en (weekId, dayId) — bucket de start-day.
 * Prefer overlap helpers for mid-span presence.
 */
export async function fetchTasks(uid: string, weekId: string, dayId: string): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .eq('week_id', weekId)
    .eq('day_id', dayId)
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapTask(row.id as string, row));
}

function mapLocatedRow(row: Record<string, unknown>): LocatedTaskRow {
  return {
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  };
}

function mergeLocatedById(...lists: LocatedTaskRow[][]): LocatedTaskRow[] {
  const map = new Map<string, LocatedTaskRow>();
  for (const list of lists) {
    for (const row of list) {
      if (!map.has(row.id)) map.set(row.id, row);
    }
  }
  return Array.from(map.values());
}

/**
 * Hábitos con series_id con day_id <= upToDayId (seed + materializadas).
 * Necesario para expandir virtuales en collectTasksCovering tras recarga
 * (el seed puede estar fuera de la ventana de solape multi-día).
 */
async function fetchHabitSeriesUpTo(
  uid: string,
  upToDayId: string
): Promise<LocatedTaskRow[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .in('kind', ['habit_good', 'habit_quit'])
    .not('series_id', 'is', null)
    .lte('day_id', upToDayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapLocatedRow(row as Record<string, unknown>));
}

/**
 * Overlap fetch for a single day: day_id <= dayId AND end_day_id >= dayId.
 * Returns rows bucketed by **start** day (dayId field = start).
 * Incluye seeds de hábitos lazy para presencia virtual en el día.
 */
export async function fetchTasksCoveringDay(
  uid: string,
  dayId: string
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  const coveringPromise = getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .lte('day_id', dayId)
    .gte('end_day_id', dayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });

  const [coveringRes, habits] = await Promise.all([
    coveringPromise,
    fetchHabitSeriesUpTo(uid, dayId),
  ]);
  if (coveringRes.error) throw coveringRes.error;
  const covering = (coveringRes.data ?? []).map(row =>
    mapLocatedRow(row as Record<string, unknown>)
  );
  return mergeLocatedById(covering, habits);
}

/**
 * Overlap range load for month/calendar:
 * day_id <= to AND end_day_id >= from (includes spans that start before the window).
 * Rows are keyed by **start** day only.
 * Incluye seeds de hábitos lazy hasta `toDayId`.
 */
export async function fetchTasksInRange(
  uid: string,
  fromDayId: string,
  toDayId: string
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  const rangePromise = getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .lte('day_id', toDayId)
    .gte('end_day_id', fromDayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });

  const [rangeRes, habits] = await Promise.all([
    rangePromise,
    fetchHabitSeriesUpTo(uid, toDayId),
  ]);
  if (rangeRes.error) throw rangeRes.error;
  const covering = (rangeRes.data ?? []).map(row =>
    mapLocatedRow(row as Record<string, unknown>)
  );
  return mergeLocatedById(covering, habits);
}

/**
 * Todas las tareas del usuario (para Eisenhower y listados globales).
 * Opcionalmente filtra por proyecto en cliente tras el select.
 */
export async function fetchAllTasks(
  uid: string,
  opts?: { projectId?: string | null }
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  let query = getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });

  if (opts?.projectId) {
    query = query.eq('project_id', opts.projectId);
  } else if (opts?.projectId === null) {
    query = query.is('project_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(row => ({
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  }));
}

/**
 * Subscribe to tasks covering a day. Callback receives rows located at their **start** day
 * (not necessarily the subscribed dayId), so the store can merge into start buckets.
 */
export function subscribeTasks(
  uid: string,
  weekId: string,
  dayId: string,
  cb: (rows: LocatedTaskRow[]) => void
): TasksUnsubscribe {
  if (isDemoMode()) return () => undefined;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 200;

  const load = () => {
    void fetchTasksCoveringDay(uid, dayId).then(cb);
  };

  /** Coalesce ráfagas Realtime (p. ej. insert de 90 hábitos) — roadmap §0.4. */
  const scheduleLoad = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      load();
    }, DEBOUNCE_MS);
  };

  load();

  const unsub = subscribeTable({
    topic: `tasks:${uid}:${weekId}:${dayId}`,
    table: 'tasks',
    filter: `user_id=eq.${uid}`,
    onChange: scheduleLoad,
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsub();
  };
}

export interface CreateTaskResult {
  task: Task;
  instances: Array<Task & { weekId: string; dayId: string }>;
}

interface CreateTaskResponse {
  id: string;
  weekId: string;
  dayId: string;
  endDayId?: string;
  title?: string;
  completed?: boolean;
  completedAt?: string | null;
  projectId?: string | null;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  order?: number;
  tags?: string[];
  movedFrom?: string | null;
  seriesId?: string | null;
  recurrence?: Recurrence;
  kind?: Task['kind'];
  color?: string | null;
  urgency?: Task['urgency'];
  importance?: Task['importance'];
  startTime?: string | null;
  endTime?: string | null;
  /** Compact stubs: { id, weekId, dayId, endDayId?, seriesId? } or full rows. */
  instances?: Array<Record<string, unknown>>;
  createdCount?: number;
  createdAt?: string;
  updatedAt?: string;
  involvedContactIds?: string[];
  location?: string | null;
  departureTime?: string | null;
  steps?: Task['steps'];
}

/** ¿La fila de instancia trae título (full) o solo ids (compacta)? */
function isCompactInstanceStub(raw: Record<string, unknown>): boolean {
  return typeof raw.title !== 'string' && (raw.id != null || raw.weekId != null);
}

/**
 * Expande stubs compactos del API a Task completas usando el payload de create
 * (roadmap §1.4 — respuesta ligera).
 */
function expandCreateInstances(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  res: CreateTaskResponse
): Array<Task & { weekId: string; dayId: string }> {
  const kind = payload.kind ?? (res.kind as Task['kind']) ?? 'task';
  const isHabit = kind === 'habit_good' || kind === 'habit_quit';
  const isEventLike = kind === 'event' || kind === 'possible_event';
  const rawFreq =
    payload.recurrenceFrequency ?? res.recurrence?.frequency;
  const recurrence = normalizeRecurrence(
    isHabit && (!rawFreq || rawFreq === 'none') ? 'daily' : rawFreq,
    payload.recurrenceInterval ?? res.recurrence?.interval
  );
  const seriesId =
    (res.seriesId as string | null | undefined) ??
    (isHabit || recurrence.frequency !== 'none' ? (res.id as string) : null);
  const now = new Date().toISOString();
  const stubs = Array.isArray(res.instances)
    ? res.instances
    : [
        {
          id: res.id,
          weekId: res.weekId ?? weekId,
          dayId: res.dayId ?? dayId,
          endDayId: res.endDayId ?? dayId,
          seriesId,
        },
      ];

  const steps =
    kindSupportsSteps(kind) && payload.steps?.length
      ? normalizeTaskSteps(payload.steps)
      : [];

  return stubs.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    if (!isCompactInstanceStub(row) && typeof row.title === 'string') {
      const mapped = mapTask((row.id as string) ?? res.id, row);
      return {
        ...mapped,
        weekId: (row.weekId as string) ?? (row.week_id as string) ?? weekId,
        dayId: (row.dayId as string) ?? (row.day_id as string) ?? dayId,
      };
    }

    const instDayId =
      (row.dayId as string) ?? (row.day_id as string) ?? dayId;
    const instWeekId =
      (row.weekId as string) ?? (row.week_id as string) ?? weekId;
    const instEnd =
      (row.endDayId as string) ??
      (row.end_day_id as string) ??
      instDayId;
    const instSeries =
      (row.seriesId as string | null | undefined) ??
      (row.series_id as string | null | undefined) ??
      seriesId;

    return {
      id: (row.id as string) ?? `${res.id}-${index}`,
      title: payload.title,
      completed: false,
      completedAt: null,
      projectId: isHabit || isEventLike ? null : (payload.projectId ?? null),
      priority: payload.priority ?? 'medium',
      notes: payload.notes ?? '',
      order: index,
      tags: payload.tags ?? [],
      movedFrom: null,
      seriesId: instSeries,
      recurrence,
      endDayId: instEnd,
      urgency: isHabit || isEventLike ? null : (payload.urgency ?? null),
      importance: isHabit || isEventLike ? null : (payload.importance ?? null),
      kind,
      color:
        payload.color ??
        (kind === 'event'
          ? '#58a6ff'
          : kind === 'possible_event'
            ? '#a371f7'
            : kind === 'habit_good'
              ? '#3fb950'
              : kind === 'habit_quit'
                ? '#f85149'
                : null),
      startTime: isHabit ? null : (payload.startTime ?? null),
      endTime: isHabit ? null : (payload.endTime ?? null),
      rx: null,
      involvedContactIds: isEventLike ? (payload.involvedContactIds ?? []) : [],
      location:
        kind === 'event' || kind === 'possible_event'
          ? (payload.location?.trim() || null)
          : null,
      departureTime: kind === 'event' ? (payload.departureTime ?? null) : null,
      steps,
      createdAt: res.createdAt ?? now,
      updatedAt: res.updatedAt ?? now,
      weekId: instWeekId,
      dayId: instDayId,
    };
  });
}

export async function createTask(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  eventId?: string
): Promise<CreateTaskResult> {
  const endDayId = payload.endDayId ?? dayId;
  const res = await api.post<CreateTaskResponse>('/api/tasks', {
    weekId,
    dayId,
    endDayId,
    title: payload.title,
    projectId: payload.projectId ?? null,
    priority: payload.priority ?? 'medium',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
    recurrenceFrequency: payload.recurrenceFrequency ?? 'none',
    recurrenceInterval: payload.recurrenceInterval ?? 1,
    urgency: payload.urgency ?? null,
    importance: payload.importance ?? null,
    kind: payload.kind ?? 'task',
    color: payload.color ?? null,
    startTime: payload.startTime ?? null,
    endTime: payload.endTime ?? null,
    rxPhases: payload.rxPhases,
    rxSubject: payload.rxSubject ?? null,
    involvedContactIds: payload.involvedContactIds ?? [],
    location: payload.location ?? null,
    departureTime: payload.departureTime ?? null,
    steps: payload.steps,
    eventId,
  });

  // Demo: el API stub no materializa; lo hacemos en cliente.
  if (isDemoMode()) {
    return materializeDemoCreate(weekId, dayId, payload, res.id);
  }

  const instances = expandCreateInstances(weekId, dayId, payload, res);

  return {
    task: instances[0] ?? mapTask(res.id, res as unknown as Record<string, unknown>),
    instances,
  };
}

function materializeDemoCreate(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  firstId: string
): CreateTaskResult {
  const now = new Date().toISOString();
  const kind = payload.kind ?? 'task';

  if (isRxKind(kind) && payload.rxPhases?.length) {
    const occs = materializeRxOccurrences(dayId, payload.rxPhases);
    const rxTags = mergeTags(
      payload.tags,
      extractHashtags(payload.title),
      kind === 'rx_pet' ? payload.rxSubject : null
    );
    const instances = occs.map((occ, index) => {
      const id = index === 0 ? firstId : `${firstId}-${index}`;
      const rx = buildRxMetaForOccurrence(
        dayId,
        payload.rxPhases!,
        occ,
        payload.rxSubject ?? null
      );
      const task: Task & { weekId: string; dayId: string } = {
        id,
        title: payload.title,
        completed: false,
        completedAt: null,
        projectId: null,
        priority: 'high',
        notes: payload.notes ?? '',
        order: 0,
        tags: rxTags,
        movedFrom: null,
        seriesId: firstId,
        recurrence: { frequency: 'none', interval: 1 },
        endDayId: occ.dayId,
        urgency: 'urgent',
        importance: 'important',
        kind,
        color:
          payload.color ?? (kind === 'rx_pet' ? '#d29922' : '#a371f7'),
        startTime: occ.startTime,
        endTime: null,
        rx,
        involvedContactIds: [],
        location: null,
        departureTime: null,
        steps: [],
        createdAt: now,
        updatedAt: now,
        weekId: occ.dayId === dayId ? weekId : getWeekIdFromDayId(occ.dayId),
        dayId: occ.dayId,
      };
      return task;
    });
    return { task: instances[0], instances };
  }

  const isHabit = kind === 'habit_good' || kind === 'habit_quit';
  const steps =
    kindSupportsSteps(kind) && payload.steps?.length
      ? normalizeTaskSteps(payload.steps)
      : [];
  const recurrence = normalizeRecurrence(
    isHabit &&
      (!payload.recurrenceFrequency || payload.recurrenceFrequency === 'none')
      ? 'daily'
      : payload.recurrenceFrequency,
    payload.recurrenceInterval
  );
  const endDayId = isHabit ? dayId : (payload.endDayId ?? dayId);
  // Hábitos lazy (Fase 2): solo seed; el resto es virtual en collectTasksCovering.
  const ranges = isHabit
    ? [{ dayId, endDayId: dayId }]
    : materializeOccurrenceRanges(
        dayId,
        endDayId,
        recurrence.frequency,
        recurrence.interval
      );
  const seriesId =
    isHabit || recurrence.frequency !== 'none' ? firstId : null;
  const mergedTags = mergeTags(payload.tags, extractHashtags(payload.title));
  const involved = payload.involvedContactIds ?? [];
  const instances = ranges.map((range, index) => {
    const id = index === 0 ? firstId : `${firstId}-${index}`;
    const task: Task & { weekId: string; dayId: string } = {
      id,
      title: payload.title,
      completed: false,
      completedAt: null,
      projectId: isHabit ? null : (payload.projectId ?? null),
      priority: payload.priority ?? 'medium',
      notes: payload.notes ?? '',
      order: 0,
      tags: mergedTags,
      movedFrom: null,
      seriesId,
      recurrence,
      endDayId: range.endDayId,
      urgency: isHabit ? null : (payload.urgency ?? null),
      importance: isHabit ? null : (payload.importance ?? null),
      kind,
      color:
        payload.color ??
        (kind === 'habit_good'
          ? '#3fb950'
          : kind === 'habit_quit'
            ? '#f85149'
            : null),
      startTime: isHabit ? null : (payload.startTime ?? null),
      endTime: isHabit ? null : (payload.endTime ?? null),
      rx: null,
      involvedContactIds: isHabit ? [] : involved,
      location:
        kind === 'event' || kind === 'possible_event'
          ? (payload.location?.trim() || null)
          : null,
      departureTime:
        kind === 'event' ? (payload.departureTime ?? null) : null,
      steps,
      createdAt: now,
      updatedAt: now,
      weekId: range.dayId === dayId ? weekId : getWeekIdFromDayId(range.dayId),
      dayId: range.dayId,
    };
    return task;
  });
  return { task: instances[0], instances };
}

/**
 * Materializa una instancia de hábito lazy (virtual → fila real).
 * POST /api/tasks/habit-ensure
 */
export async function ensureHabitInstance(opts: {
  seriesId: string;
  dayId: string;
  completed?: boolean;
}): Promise<Task & { weekId: string; dayId: string }> {
  if (isDemoMode()) {
    // Demo: clonar seed del store
    const store = useStore.getState();
    let seed: (Task & { weekId: string; dayId: string }) | null = null;
    for (const [w, days] of Object.entries(store.tasksByDay)) {
      for (const [d, list] of Object.entries(days)) {
        for (const t of list) {
          if (t.seriesId === opts.seriesId && isHabitKind(t.kind)) {
            if (!seed || d < seed.dayId) {
              seed = { ...t, weekId: w, dayId: d };
            }
          }
        }
      }
    }
    if (!seed) throw new Error('Serie de hábito no encontrada (demo)');
    const now = new Date().toISOString();
    const id = `demo-habit-${opts.seriesId}-${opts.dayId}`;
    const task: Task & { weekId: string; dayId: string } = {
      ...seed,
      id,
      dayId: opts.dayId,
      weekId: getWeekIdFromDayId(opts.dayId),
      endDayId: opts.dayId,
      completed: opts.completed ?? false,
      completedAt: opts.completed ? now : null,
      updatedAt: now,
      createdAt: now,
    };
    store.addTaskOptimistic(task.weekId, task.dayId, task);
    return task;
  }

  const res = await api.post<Record<string, unknown>>('/api/tasks/habit-ensure', {
    seriesId: opts.seriesId,
    dayId: opts.dayId,
    completed: opts.completed,
  });
  const mapped = mapTask((res.id as string) ?? '', res);
  const w =
    (res.weekId as string) ??
    (res.week_id as string) ??
    getWeekIdFromDayId(opts.dayId);
  const d = (res.dayId as string) ?? (res.day_id as string) ?? opts.dayId;
  const located = { ...mapped, weekId: w, dayId: d };
  useStore.getState().addTaskOptimistic(w, d, located);
  return located;
}

export async function updateTask(
  weekId: string,
  dayId: string,
  taskId: string,
  payload: UpdateTaskPayload
): Promise<void> {
  // Hábito virtual: materializar primero, luego patch si hace falta.
  if (isVirtualHabitId(taskId)) {
    const parsed = parseVirtualHabitId(taskId);
    if (!parsed) throw new Error('Id de hábito virtual inválido');
    const ensured = await ensureHabitInstance({
      seriesId: parsed.seriesId,
      dayId: parsed.dayId,
      completed: payload.completed,
    });
    // Si solo era completed, ensure ya lo aplicó.
    const rest: UpdateTaskPayload = { ...payload };
    delete rest.completed;
    delete rest.applyTo;
    const keys = Object.keys(rest).filter(
      k => (rest as Record<string, unknown>)[k] !== undefined
    );
    if (keys.length === 0) return;

    if (isDemoMode()) {
      const partial: Partial<Task> = { updatedAt: new Date().toISOString() };
      for (const k of keys) {
        (partial as Record<string, unknown>)[k] = (rest as Record<string, unknown>)[k];
      }
      if (payload.applyTo === 'series' && ensured.seriesId) {
        useStore.getState().patchSeriesOptimistic(ensured.seriesId, partial);
      } else {
        useStore
          .getState()
          .updateTaskOptimistic(ensured.weekId, ensured.dayId, ensured.id, partial);
      }
      return;
    }

    await api.patch<void>(
      `/api/tasks/${encodeURIComponent(ensured.weekId)}/${encodeURIComponent(ensured.dayId)}/${encodeURIComponent(ensured.id)}`,
      { ...rest, applyTo: payload.applyTo }
    );
    return;
  }

  await api.patch<void>(
    `/api/tasks/${encodeURIComponent(weekId)}/${encodeURIComponent(dayId)}/${encodeURIComponent(taskId)}`,
    payload
  );
}

/**
 * Regenera tomas incompletas de un recetario y mergea en el store local.
 * Conserva completadas; borra incompletas desde fromDayId (inclusive).
 */
export async function rematerializeRxSeries(
  weekId: string,
  dayId: string,
  taskId: string,
  payload: RematerializeRxPayload
): Promise<{ created: number; instances: Array<Task & { weekId: string; dayId: string }> }> {
  if (isDemoMode()) {
    return rematerializeDemoRx(weekId, dayId, taskId, payload);
  }

  const res = await api.post<{
    seriesId: string;
    fromDayId: string;
    created: number;
    instances: Array<Record<string, unknown>>;
  }>(
    `/api/tasks/${encodeURIComponent(weekId)}/${encodeURIComponent(dayId)}/${encodeURIComponent(taskId)}/rematerialize-rx`,
    payload
  );

  const store = useStore.getState();
  const fromDayId = res.fromDayId ?? payload.fromDayId ?? dayId;
  const seriesId =
    res.seriesId ??
    findTaskLocation(taskId)?.task.seriesId ??
    null;

  purgeIncompleteSeriesFromStore(seriesId, fromDayId);

  const instances = (res.instances ?? []).map(raw => {
    const mapped = mapTask((raw.id as string) ?? '', raw);
    return {
      ...mapped,
      weekId: (raw.weekId as string) ?? (raw.week_id as string) ?? weekId,
      dayId: (raw.dayId as string) ?? (raw.day_id as string) ?? dayId,
    };
  });

  for (const instance of instances) {
    store.addTaskOptimistic(instance.weekId, instance.dayId, {
      id: instance.id,
      title: instance.title,
      completed: instance.completed,
      completedAt: instance.completedAt,
      projectId: instance.projectId,
      priority: instance.priority,
      notes: instance.notes,
      order: instance.order,
      tags: instance.tags,
      movedFrom: instance.movedFrom,
      seriesId: instance.seriesId,
      recurrence: instance.recurrence,
      endDayId: instance.endDayId,
      urgency: instance.urgency,
      importance: instance.importance,
      kind: instance.kind,
      color: instance.color,
      startTime: instance.startTime,
      endTime: instance.endTime,
      rx: instance.rx,
      involvedContactIds: instance.involvedContactIds ?? [],
      location: instance.location ?? null,
      departureTime: instance.departureTime ?? null,
      steps: instance.steps ?? [],
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    });
  }

  // Título en completadas locales (el API ya actualizó el servidor).
  if (payload.title && seriesId) {
    applySeriesTitleLocal(seriesId, payload.title);
  }

  return { created: res.created ?? instances.length, instances };
}

function purgeIncompleteSeriesFromStore(seriesId: string | null, fromDayId: string): void {
  if (!seriesId) return;
  const store = useStore.getState();
  for (const [w, days] of Object.entries(store.tasksByDay)) {
    for (const [d, list] of Object.entries(days)) {
      if (d < fromDayId) continue;
      for (const t of list) {
        if (t.seriesId === seriesId && !t.completed) {
          store.removeTaskOptimistic(w, d, t.id);
        }
      }
    }
  }
}

function applySeriesTitleLocal(seriesId: string, title: string): void {
  const store = useStore.getState();
  const now = new Date().toISOString();
  for (const [w, days] of Object.entries(store.tasksByDay)) {
    for (const [d, list] of Object.entries(days)) {
      for (const t of list) {
        if (t.seriesId === seriesId && t.completed && t.title !== title) {
          store.updateTaskOptimistic(w, d, t.id, { title, updatedAt: now });
        }
      }
    }
  }
}

function rematerializeDemoRx(
  weekId: string,
  dayId: string,
  taskId: string,
  payload: RematerializeRxPayload
): { created: number; instances: Array<Task & { weekId: string; dayId: string }> } {
  const loc = findTaskLocation(taskId);
  const existing = loc?.task;
  if (!existing || !isRxKind(existing.kind)) {
    throw new Error('Solo recetarios admiten rematerialize-rx');
  }
  const seriesId = existing.seriesId;
  if (!seriesId) {
    throw new Error('Recetario sin seriesId');
  }

  const fromDayId = payload.fromDayId ?? dayId;
  const title = payload.title ?? existing.title;
  const subject =
    payload.rxSubject !== undefined
      ? payload.rxSubject
      : (existing.rx?.subject ?? null);
  const color =
    payload.color !== undefined
      ? payload.color
      : existing.color;
  const kind = existing.kind;

  purgeIncompleteSeriesFromStore(seriesId, fromDayId);

  const occs = materializeRxOccurrences(fromDayId, payload.rxPhases);
  const now = new Date().toISOString();
  const baseId = `rx-${Date.now().toString(36)}`;
  const store = useStore.getState();

  const instances = occs.map((occ, index) => {
    const id = `${baseId}-${index}`;
    const rx = buildRxMetaForOccurrence(fromDayId, payload.rxPhases, occ, subject);
    const w = occ.dayId === dayId ? weekId : getWeekIdFromDayId(occ.dayId);
    const task: Task & { weekId: string; dayId: string } = {
      id,
      title,
      completed: false,
      completedAt: null,
      projectId: existing.projectId,
      priority: existing.priority,
      notes: existing.notes,
      order: store.tasksByDay[w]?.[occ.dayId]?.length ?? 0,
      tags: [...existing.tags],
      movedFrom: null,
      seriesId,
      recurrence: { frequency: 'none', interval: 1 },
      endDayId: occ.dayId,
      urgency: existing.urgency,
      importance: existing.importance,
      kind,
      involvedContactIds: [],
      location: null,
      departureTime: null,
      steps: [],
      color: color ?? (kind === 'rx_pet' ? '#d29922' : '#a371f7'),
      startTime: occ.startTime,
      endTime: null,
      rx,
      createdAt: now,
      updatedAt: now,
      weekId: w,
      dayId: occ.dayId,
    };
    store.addTaskOptimistic(w, occ.dayId, task);
    return task;
  });

  if (payload.title) {
    applySeriesTitleLocal(seriesId, title);
  }

  return { created: instances.length, instances };
}

export async function deleteTask(
  weekId: string,
  dayId: string,
  taskId: string
): Promise<void> {
  await api.del<void>(
    `/api/tasks/${encodeURIComponent(weekId)}/${encodeURIComponent(dayId)}/${encodeURIComponent(taskId)}`
  );
}

export async function moveTask(
  fromWeekId: string,
  fromDayId: string,
  taskId: string,
  toWeekId: string,
  toDayId: string
): Promise<void> {
  await api.post<void>(
    `/api/tasks/${encodeURIComponent(fromWeekId)}/${encodeURIComponent(fromDayId)}/${encodeURIComponent(taskId)}/move`,
    { toWeekId, toDayId }
  );
}

export function mapTask(id: string, raw: Record<string, unknown>): Task {
  const frequency =
    (raw.recurrence_frequency as Task['recurrence']['frequency'] | undefined) ??
    (raw.recurrence as Recurrence | undefined)?.frequency ??
    'none';
  const interval =
    (typeof raw.recurrence_interval === 'number' ? raw.recurrence_interval : undefined) ??
    (raw.recurrence as Recurrence | undefined)?.interval ??
    1;

  const startDayId =
    (raw.day_id as string | undefined) ?? (raw.dayId as string | undefined) ?? '';
  const endDayId =
    (raw.end_day_id as string | undefined) ??
    (raw.endDayId as string | undefined) ??
    startDayId;

  const urgencyRaw =
    (raw.urgency as Task['urgency'] | undefined) ?? null;
  const importanceRaw =
    (raw.importance as Task['importance'] | undefined) ?? null;

  return {
    id,
    title: (raw.title as string) ?? '',
    completed: (raw.completed as boolean) ?? false,
    completedAt: (raw.completed_at as string | null) ?? (raw.completedAt as string | null) ?? null,
    projectId: (raw.project_id as string | null) ?? (raw.projectId as string | null) ?? null,
    priority: (raw.priority as Task['priority']) ?? 'medium',
    notes: (raw.notes as string) ?? '',
    order: typeof raw.order === 'number' ? raw.order : 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    movedFrom: (raw.moved_from as string | null) ?? (raw.movedFrom as string | null) ?? null,
    seriesId: (raw.series_id as string | null) ?? (raw.seriesId as string | null) ?? null,
    recurrence: normalizeRecurrence(frequency, interval),
    endDayId: endDayId || startDayId,
    urgency: urgencyRaw === 'urgent' || urgencyRaw === 'not_urgent' ? urgencyRaw : null,
    importance:
      importanceRaw === 'important' || importanceRaw === 'not_important' ? importanceRaw : null,
    kind: normalizeTaskKind(raw.kind),
    color:
      typeof raw.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.color) ? raw.color : null,
    startTime: normalizeTimeField(raw.start_time ?? raw.startTime),
    endTime: normalizeTimeField(raw.end_time ?? raw.endTime),
    rx: parseRxMeta(raw.rx_meta ?? raw.rx),
    involvedContactIds: normalizeInvolvedContactIds(
      raw.involved_contact_ids ?? raw.involvedContactIds
    ),
    location: normalizeLocationField(raw.location),
    departureTime: normalizeTimeField(raw.departure_time ?? raw.departureTime),
    steps: normalizeTaskSteps(raw.steps),
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
    updatedAt: (raw.updated_at as string) ?? (raw.updatedAt as string) ?? new Date(0).toISOString(),
  };
}

function normalizeTaskKind(raw: unknown): Task['kind'] {
  if (raw === 'reminder') return 'reminder';
  if (raw === 'rx_human') return 'rx_human';
  if (raw === 'rx_pet') return 'rx_pet';
  if (raw === 'possible_event') return 'possible_event';
  if (raw === 'event') return 'event';
  if (raw === 'habit_good') return 'habit_good';
  if (raw === 'habit_quit') return 'habit_quit';
  return 'task';
}

function normalizeLocationField(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t ? t.slice(0, 200) : null;
}

function normalizeInvolvedContactIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, 40);
}

function normalizeTimeField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}
