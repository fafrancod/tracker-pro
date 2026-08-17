import { Router } from 'express';
import { z } from 'zod';
import {
  MAX_TASK_IMAGES,
  normalizePomodoroCount,
  normalizeTaskImages,
} from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { isValidDayId, isValidWeekId } from '../lib/period.js';
import { bumpUsage, readProfilePlan, readUsage } from '../lib/usage.js';
import { getLimits } from '../lib/planLimits.js';
import {
  addDaysToDayId,
  getWeekIdFromDayId,
  inclusiveDurationDays,
  isMultiDayRecurrenceAllowed,
  materializeOccurrenceRanges,
  normalizeMonthlyAnchor,
  normalizeRecurrence,
  type MonthlyAnchor,
  type RecurrenceFrequency,
} from '../lib/recurrence.js';
import {
  buildRxMetaForOccurrence,
  isRxKind,
  materializeRxOccurrences,
  parseRxMeta,
  validateRxPhases,
  type RxPhase,
} from '../lib/rx.js';
import { extractHashtags, mergeTags, mergeTagsForRx } from '../lib/tags.js';
import { logger } from '../logger.js';
import {
  nowMs,
  recordTaskCreate,
  recordTaskUpdate,
} from '../lib/requestMetrics.js';

/**
 * Contadores de filas por day_id en **una** query (evita N+1 de COUNT secuenciales
 * al materializar hábitos diarios / recetarios).
 * @see roadmap_optimization.md §0.1 / §1.1
 * @returns map + nº de round-trips SELECT (chunks), para métricas Fase 5.
 */
async function loadOrderCounters(
  uid: string,
  dayIds: string[]
): Promise<{ map: Map<string, number>; queryCount: number }> {
  const unique = Array.from(new Set(dayIds.filter(Boolean)));
  const map = new Map<string, number>();
  for (const id of unique) map.set(id, 0);
  if (unique.length === 0) return { map, queryCount: 0 };

  // Un solo SELECT de day_id (sin head count por día).
  // Chunk si hay muchos días (p. ej. > 80) para no saturar `.in()`.
  const CHUNK = 80;
  let queryCount = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await getSupabaseAdmin()
      .from('tasks')
      .select('day_id')
      .eq('user_id', uid)
      .in('day_id', slice);
    queryCount += 1;
    if (error) throw error;
    for (const row of data ?? []) {
      const d = row.day_id as string;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
  }
  return { map, queryCount };
}

export const tasksRouter = Router();

tasksRouter.use(requireAuth);
tasksRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));

const taskLocation = z.object({
  weekId: z.string().refine(isValidWeekId, 'weekId formato YYYY-Www'),
  dayId: z.string().refine(isValidDayId, 'dayId formato YYYY-MM-DD'),
});

const prioritySchema = z.enum(['low', 'medium', 'high']);
const recurrenceFrequencySchema = z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']);
const monthlyAnchorSchema = z.enum([
  'day_of_month',
  'last_day',
  'first_business',
  'last_business',
]);
const urgencySchema = z.enum(['urgent', 'not_urgent']);
const importanceSchema = z.enum(['important', 'not_important']);
const kindSchema = z.enum([
  'task',
  'reminder',
  'rx_human',
  'rx_pet',
  'possible_event',
  'event',
  'habit_good',
  'habit_quit',
  'finance_income',
  'finance_expense',
]);
const financeCertaintySchema = z.enum(['fixed', 'potential']);
const financeMetaSchema = z
  .object({
    amount: z.number().nonnegative().max(1_000_000_000),
    currency: z.string().min(1).max(8),
    certainty: financeCertaintySchema.default('fixed'),
  })
  .nullable()
  .optional();
const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'color hex #RRGGBB')
  .nullable()
  .optional();

/**
 * Local time HH:mm (24h).
 * Acepta y normaliza: "9:30", "09:30", "09:30:00", "" → null.
 */
function normalizeTimeValue(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return raw as string;
  const s = raw.trim();
  if (!s) return null;
  // HH:mm:ss
  let t = s;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) t = t.slice(0, t.lastIndexOf(':'));
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return s; // dejar fallar al regex
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return s;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const pomodoroCountSchema = z.number().int().min(0).max(24);

const timeSchema = z.preprocess(
  normalizeTimeValue,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora formato HH:mm')
    .nullable()
    .optional()
);

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora formato HH:mm');

const rxPhaseSchema = z
  .object({
    amount: z.number().positive().max(10000),
    unit: z.enum(['pills', 'ml']),
    days: z.number().int().min(1).max(365),
    scheduleMode: z.enum(['fixed', 'interval']).optional(),
    times: z
      .array(z.preprocess(normalizeTimeValue, hhmmSchema))
      .max(12)
      .optional()
      .default([]),
    everyHours: z.number().int().min(1).max(24).nullable().optional(),
    startTime: z.preprocess(normalizeTimeValue, hhmmSchema.nullable().optional()),
  })
  .superRefine((p, ctx) => {
    const mode =
      p.scheduleMode === 'interval' ||
      (typeof p.everyHours === 'number' && p.everyHours >= 1 && (!p.times || p.times.length === 0))
        ? 'interval'
        : 'fixed';
    if (mode === 'interval') {
      if (p.everyHours == null || p.everyHours < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'everyHours requerido en modo interval (1–24)',
          path: ['everyHours'],
        });
      }
      if (!p.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startTime requerido en modo interval',
          path: ['startTime'],
        });
      }
    } else if (!p.times || p.times.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'times requerido en modo fixed (o usa scheduleMode interval)',
        path: ['times'],
      });
    }
  });

/**
 * Mismo día: endTime >= startTime.
 * Multi-día (endDayId > startDayId): se permite cruce de medianoche (20:00 → 03:00).
 */
function assertTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  startDayId?: string | null,
  endDayId?: string | null
) {
  if (!startTime || !endTime) return;
  const multi = Boolean(startDayId && endDayId && endDayId > startDayId);
  if (!multi && endTime < startTime) {
    throw ApiError.badRequest(
      'endTime debe ser >= startTime en el mismo día (en varios días se permite cruce de medianoche)'
    );
  }
}

function normalizeSteps(raw: unknown): Array<{
  id: string;
  title: string;
  completed: boolean;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; title: string; completed: boolean }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    if (!title) continue;
    const idRaw = o.id;
    const id =
      typeof idRaw === 'string' && idRaw.trim()
        ? idRaw.trim().slice(0, 80)
        : typeof idRaw === 'number'
          ? String(idRaw).slice(0, 80)
          : `step-${out.length + 1}`;
    out.push({
      id,
      title: title.slice(0, 280),
      completed: Boolean(o.completed),
    });
    if (out.length >= 40) break;
  }
  return out;
}

/** Data URLs de imagen o PDF (misma normalización que core). */
function normalizeImages(raw: unknown): string[] {
  return normalizeTaskImages(raw);
}

const createSchema = taskLocation.extend({
  title: z.string().min(1).max(280).trim(),
  projectId: z.string().nullable().optional(),
  projectCategoryId: z.string().min(1).max(80).nullable().optional(),
  priority: prioritySchema.optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  eventId: z.string().min(1).max(80).optional(),
  endDayId: z.string().refine(isValidDayId, 'endDayId formato YYYY-MM-DD').optional(),
  recurrenceFrequency: recurrenceFrequencySchema.optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional(),
  recurrenceMonthlyAnchor: monthlyAnchorSchema.nullable().optional(),
  urgency: urgencySchema.nullable().optional(),
  importance: importanceSchema.nullable().optional(),
  kind: kindSchema.optional(),
  color: colorSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  rxPhases: z.array(rxPhaseSchema).min(1).max(12).optional(),
  rxSubject: z.string().max(120).nullable().optional(),
  involvedContactIds: z.array(z.string().min(1).max(80)).max(40).optional(),
  location: z.string().max(200).nullable().optional(),
  departureTime: timeSchema,
  // Preprocess steps so a single bad item does not 400 the whole create.
  steps: z
    .array(z.unknown())
    .max(40)
    .optional()
    .transform(arr => (arr === undefined ? undefined : normalizeSteps(arr))),
  images: z
    .array(z.unknown())
    .max(MAX_TASK_IMAGES)
    .optional()
    .transform(arr => (arr === undefined ? undefined : normalizeImages(arr))),
  finance: financeMetaSchema,
  financeAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  financeCurrency: z.string().min(1).max(8).optional(),
  financeCertainty: financeCertaintySchema.optional(),
  pomodoroTarget: pomodoroCountSchema.optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(280).trim().optional(),
    completed: z.boolean().optional(),
    projectId: z.string().nullable().optional(),
    projectCategoryId: z.string().min(1).max(80).nullable().optional(),
    priority: prioritySchema.optional(),
    notes: z.string().max(4000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    order: z.number().int().nonnegative().optional(),
    movedFrom: z.string().nullable().optional(),
    endDayId: z.string().refine(isValidDayId, 'endDayId formato YYYY-MM-DD').optional(),
    recurrenceFrequency: recurrenceFrequencySchema.optional(),
    recurrenceInterval: z.number().int().min(1).max(365).optional(),
    recurrenceMonthlyAnchor: monthlyAnchorSchema.nullable().optional(),
    urgency: urgencySchema.nullable().optional(),
    importance: importanceSchema.nullable().optional(),
    kind: kindSchema.optional(),
    color: colorSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    /** Ajuste de dosis de ESTA toma (recetario). */
    rxAmount: z.number().positive().max(10000).optional(),
    rxUnit: z.enum(['pills', 'ml']).optional(),
    rxSubject: z.string().max(120).nullable().optional(),
    involvedContactIds: z.array(z.string().min(1).max(80)).max(40).optional(),
    location: z.string().max(200).nullable().optional(),
    departureTime: timeSchema,
    // Same as create: normalize steps without failing the whole patch.
    steps: z
      .array(z.unknown())
      .max(40)
      .optional()
      .transform(arr => (arr === undefined ? undefined : normalizeSteps(arr))),
    images: z
      .array(z.unknown())
      .max(MAX_TASK_IMAGES)
      .optional()
      .transform(arr => (arr === undefined ? undefined : normalizeImages(arr))),
    finance: financeMetaSchema,
    financeAmount: z.number().nonnegative().max(1_000_000_000).optional(),
    financeCurrency: z.string().min(1).max(8).optional(),
    financeCertainty: financeCertaintySchema.optional(),
    pomodoroTarget: pomodoroCountSchema.optional(),
    pomodoroDone: pomodoroCountSchema.optional(),
    /** instance = solo esta fila; series = metadata en toda la serie. */
    applyTo: z.enum(['instance', 'series']).optional().default('instance'),
  })
  .refine(
    p => Object.keys(p).some(k => k !== 'applyTo'),
    { message: 'patch vacio' }
  );

const rematerializeRxSchema = z.object({
  title: z.string().min(1).max(280).trim().optional(),
  rxPhases: z.array(rxPhaseSchema).min(1).max(12),
  rxSubject: z.string().max(120).nullable().optional(),
  /**
   * Día desde el que se regeneran tomas incompletas (inclusive).
   * Por defecto: día de la tarea editada.
   */
  fromDayId: z.string().refine(isValidDayId).optional(),
  color: colorSchema,
});

function toClientTask(
  row: Record<string, unknown>,
  overrides?: { weekId?: string; dayId?: string }
) {
  const frequency = (row.recurrence_frequency as RecurrenceFrequency | undefined) ?? 'none';
  const interval = typeof row.recurrence_interval === 'number' ? row.recurrence_interval : 1;
  const dayId = overrides?.dayId ?? (row.day_id as string);
  const endDayId =
    (row.end_day_id as string | undefined) ??
    (row.endDayId as string | undefined) ??
    dayId;
  return {
    id: row.id as string,
    weekId: overrides?.weekId ?? (row.week_id as string),
    dayId,
    endDayId,
    title: row.title as string,
    completed: Boolean(row.completed),
    completedAt: (row.completed_at as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectCategoryId:
      (row.project_category_id as string | null | undefined) ??
      (row.projectCategoryId as string | null | undefined) ??
      null,
    priority: (row.priority as string) ?? 'medium',
    notes: (row.notes as string) ?? '',
    order: typeof row.order === 'number' ? row.order : 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    movedFrom: (row.moved_from as string | null) ?? null,
    seriesId: (row.series_id as string | null) ?? null,
    recurrence: normalizeRecurrence(
      frequency,
      interval,
      (row.recurrence_anchor as MonthlyAnchor | undefined) ??
        (row.recurrenceMonthlyAnchor as MonthlyAnchor | undefined)
    ),
    urgency: (row.urgency as string | null | undefined) ?? null,
    importance: (row.importance as string | null | undefined) ?? null,
    kind: normalizeKind(row.kind),
    color: (row.color as string | null | undefined) ?? null,
    startTime: (row.start_time as string | null | undefined) ?? null,
    endTime: (row.end_time as string | null | undefined) ?? null,
    rx: parseRxMeta(row.rx_meta ?? row.rx),
    involvedContactIds: Array.isArray(row.involved_contact_ids)
      ? (row.involved_contact_ids as string[])
      : Array.isArray(row.involvedContactIds)
        ? (row.involvedContactIds as string[])
        : [],
    location:
      typeof row.location === 'string' && row.location.trim()
        ? row.location.trim()
        : null,
    departureTime:
      (row.departure_time as string | null | undefined) ??
      (row.departureTime as string | null | undefined) ??
      null,
    steps: normalizeSteps(row.steps),
    images: normalizeImages(row.images),
    finance: parseFinanceMeta(row.finance_meta ?? row.finance),
    pomodoroTarget: normalizePomodoroCount(row.pomodoro_target ?? row.pomodoroTarget),
    pomodoroDone: normalizePomodoroCount(row.pomodoro_done ?? row.pomodoroDone),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function normalizeKind(
  raw: unknown
):
  | 'task'
  | 'reminder'
  | 'rx_human'
  | 'rx_pet'
  | 'possible_event'
  | 'event'
  | 'habit_good'
  | 'habit_quit'
  | 'finance_income'
  | 'finance_expense' {
  if (raw === 'reminder') return 'reminder';
  if (raw === 'rx_human') return 'rx_human';
  if (raw === 'rx_pet') return 'rx_pet';
  if (raw === 'possible_event') return 'possible_event';
  if (raw === 'event') return 'event';
  if (raw === 'habit_good') return 'habit_good';
  if (raw === 'habit_quit') return 'habit_quit';
  if (raw === 'finance_income') return 'finance_income';
  if (raw === 'finance_expense') return 'finance_expense';
  return 'task';
}

function isHabitKind(kind: string | null | undefined): boolean {
  return kind === 'habit_good' || kind === 'habit_quit';
}

function isFinanceKind(kind: string | null | undefined): boolean {
  return kind === 'finance_income' || kind === 'finance_expense';
}

function parseFinanceMeta(raw: unknown): {
  amount: number;
  currency: string;
  certainty: 'fixed' | 'potential';
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency =
    typeof o.currency === 'string' && o.currency.trim()
      ? o.currency.trim().toUpperCase().slice(0, 8)
      : 'EUR';
  const certainty = o.certainty === 'potential' ? 'potential' : 'fixed';
  return { amount, currency, certainty };
}

function resolveFinanceMeta(
  kind: string,
  opts: {
    finance?: { amount: number; currency: string; certainty?: 'fixed' | 'potential' } | null;
    financeAmount?: number;
    financeCurrency?: string;
    financeCertainty?: 'fixed' | 'potential';
    existing?: unknown;
  }
): { amount: number; currency: string; certainty: 'fixed' | 'potential' } | null {
  if (!isFinanceKind(kind)) return null;
  const prev = parseFinanceMeta(opts.existing);
  if (opts.finance && typeof opts.finance === 'object') {
    return {
      amount: Math.max(0, Number(opts.finance.amount) || 0),
      currency: (opts.finance.currency || prev?.currency || 'EUR')
        .toString()
        .toUpperCase()
        .slice(0, 8),
      certainty:
        opts.finance.certainty === 'potential'
          ? 'potential'
          : opts.finance.certainty === 'fixed'
            ? 'fixed'
            : (prev?.certainty ?? 'fixed'),
    };
  }
  return {
    amount:
      typeof opts.financeAmount === 'number'
        ? Math.max(0, opts.financeAmount)
        : (prev?.amount ?? 0),
    currency: (opts.financeCurrency || prev?.currency || 'EUR')
      .toString()
      .toUpperCase()
      .slice(0, 8),
    certainty:
      opts.financeCertainty === 'potential'
        ? 'potential'
        : opts.financeCertainty === 'fixed'
          ? 'fixed'
          : (prev?.certainty ?? 'fixed'),
  };
}

function kindSupportsSteps(kind: string | null | undefined): boolean {
  return (
    kind === 'task' ||
    kind === 'reminder' ||
    kind === 'event' ||
    kind === 'possible_event'
  );
}

tasksRouter.post('/', async (req, res, next) => {
  const t0 = nowMs();
  let orderQueryCount = 0;
  try {
    const uid = req.user!.uid;
    const {
      weekId,
      dayId,
      title,
      projectId,
      projectCategoryId: rawProjectCategoryId,
      priority,
      notes,
      tags,
      eventId,
      endDayId: rawEndDayId,
      recurrenceFrequency,
      recurrenceInterval,
      recurrenceMonthlyAnchor,
      urgency,
      importance,
      kind,
      color,
      startTime,
      endTime,
      rxPhases,
      rxSubject,
      involvedContactIds,
      location,
      departureTime,
      steps: rawSteps,
      images: rawImages,
      finance: rawFinance,
      financeAmount,
      financeCurrency,
      financeCertainty,
      pomodoroTarget: rawPomodoroTarget,
    } = createSchema.parse(req.body);

    const taskKind = kind ?? 'task';
    const isFinance = isFinanceKind(taskKind);
    const supportsProject =
      taskKind === 'task' || taskKind === 'reminder';

    // Subcategoría solo con proyecto de tarea/recordatorio.
    let resolvedProjectCategoryId: string | null = null;
    if (supportsProject && projectId && rawProjectCategoryId) {
      const { data: projRow, error: projErr } = await getSupabaseAdmin()
        .from('projects')
        .select('id, categories')
        .eq('id', projectId)
        .eq('user_id', uid)
        .maybeSingle();
      if (projErr) throw projErr;
      const cats = Array.isArray(projRow?.categories) ? projRow.categories : [];
      const ok = cats.some(
        (c: unknown) =>
          c &&
          typeof c === 'object' &&
          (c as { id?: string }).id === rawProjectCategoryId
      );
      if (ok) resolvedProjectCategoryId = rawProjectCategoryId;
    }
    const resolvedEndDayId =
      typeof rawEndDayId === 'string' && rawEndDayId >= dayId ? rawEndDayId : dayId;
    // Finanzas no usan horario.
    if (!isFinance) {
      assertTimeRange(startTime, endTime, dayId, resolvedEndDayId);
    }

    const now = new Date().toISOString();
    const seriesId = generateId();
    const rows: Record<string, unknown>[] = [];
    const involvedIds = Array.isArray(involvedContactIds)
      ? Array.from(
          new Set(involvedContactIds.map(s => s.trim()).filter(Boolean))
        ).slice(0, 40)
      : [];
    const isEventLike = taskKind === 'event' || taskKind === 'possible_event';
    // Lugar: tarea, recordatorio, evento y evento posible (no hábitos/finanzas/rx).
    const supportsLocation =
      taskKind === 'task' ||
      taskKind === 'reminder' ||
      taskKind === 'event' ||
      taskKind === 'possible_event';
    const locationValue =
      supportsLocation && typeof location === 'string' && location.trim()
        ? location.trim().slice(0, 200)
        : null;
    const departureValue = taskKind === 'event' ? (departureTime ?? null) : null;
    const stepsValue = kindSupportsSteps(taskKind)
      ? normalizeSteps(rawSteps)
      : [];
    const imagesValue = normalizeImages(rawImages);
    const financeValue = resolveFinanceMeta(taskKind, {
      finance: rawFinance,
      financeAmount,
      financeCurrency,
      financeCertainty,
    });
    const pomodoroTargetValue = isHabitKind(taskKind)
      ? normalizePomodoroCount(rawPomodoroTarget)
      : 0;

    // ——— Recetario: materializa 1 fila por (día × horario) con plan por fases ———
    if (isRxKind(taskKind)) {
      if (!rxPhases || rxPhases.length === 0) {
        throw ApiError.badRequest('Recetario requiere rxPhases (fases del plan)');
      }
      const phases = rxPhases as RxPhase[];
      const phaseErr = validateRxPhases(phases);
      if (phaseErr) throw ApiError.badRequest(phaseErr);

      let occurrences;
      try {
        occurrences = materializeRxOccurrences(dayId, phases);
      } catch (e) {
        throw ApiError.badRequest(e instanceof Error ? e.message : 'Plan de recetario inválido');
      }

      const [plan, usage] = await Promise.all([
        readProfilePlan(uid),
        readUsage(uid, monthFromDay(dayId)),
      ]);
      const limits = getLimits(plan);
      if (Number.isFinite(limits.maxTasksPerMonth)) {
        const tasksThisMonth = usage.tasks_created ?? 0;
        if (tasksThisMonth + occurrences.length > limits.maxTasksPerMonth) {
          throw ApiError.planLimit(
            `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
            {
              plan,
              limit: limits.maxTasksPerMonth,
              current: tasksThisMonth,
              requested: occurrences.length,
            }
          );
        }
      }

      const orderResult = await loadOrderCounters(
        uid,
        occurrences.map(o => o.dayId)
      );
      const orderByDay = orderResult.map;
      orderQueryCount = orderResult.queryCount;

      // Recetario: sin proyecto; se asume urgente e importante.
      // Mascota (rxSubject) y #hashtags del título → tags reutilizables.
      const rxTags = mergeTagsForRx(title, tags, taskKind, rxSubject ?? null);

      for (const occ of occurrences) {
        const occWeekId =
          occ.dayId === dayId ? weekId : getWeekIdFromDayId(occ.dayId);
        const order = orderByDay.get(occ.dayId) ?? 0;
        orderByDay.set(occ.dayId, order + 1);
        const rxMeta = buildRxMetaForOccurrence(
          dayId,
          phases,
          occ,
          rxSubject ?? null
        );
        rows.push({
          id: generateId(),
          user_id: uid,
          week_id: occWeekId,
          day_id: occ.dayId,
          end_day_id: occ.dayId,
          title,
          completed: false,
          completed_at: null,
          project_id: null,
          project_category_id: null,
          priority: 'high',
          notes: notes ?? '',
          order,
          tags: rxTags,
          moved_from: null,
          series_id: seriesId,
          recurrence_frequency: 'none',
          recurrence_interval: 1,
          urgency: 'urgent',
          importance: 'important',
          kind: taskKind,
          color: color ?? (taskKind === 'rx_pet' ? '#d29922' : '#a371f7'),
          start_time: occ.startTime,
          end_time: null,
          rx_meta: rxMeta,
          involved_contact_ids: [],
          location: null,
          departure_time: null,
          steps: [],
          // Primera toma del plan lleva las fotos; el resto vacío.
          images: rows.length === 0 ? imagesValue : [],
          pomodoro_target: 0,
          pomodoro_done: 0,
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      // ——— Tarea / recordatorio / eventos / hábitos (recurrence materialization) ———
      const isHabit = isHabitKind(taskKind);
      // Hábitos: un día por instancia (no multi-día) y, por defecto, diarios.
      const endDayId = isHabit ? dayId : (rawEndDayId ?? dayId);
      if (endDayId < dayId) {
        throw ApiError.badRequest('endDayId debe ser >= dayId');
      }

      const recurrence = normalizeRecurrence(
        isHabit && (!recurrenceFrequency || recurrenceFrequency === 'none')
          ? 'daily'
          : recurrenceFrequency,
        recurrenceInterval,
        recurrenceMonthlyAnchor
      );
      const isMultiDay = endDayId > dayId;
      if (isMultiDay && !isMultiDayRecurrenceAllowed(recurrence.frequency)) {
        throw ApiError.badRequest(
          'Las tareas de varios días solo admiten repetición none, monthly o yearly'
        );
      }

      // Hábitos lazy (roadmap Fase 2): solo seed del día de inicio.
      // El resto de días se materializa al completar o se muestra virtual en cliente.
      const occurrenceRanges = isHabit
        ? [{ dayId, endDayId: dayId }]
        : materializeOccurrenceRanges(
            dayId,
            endDayId,
            recurrence.frequency,
            recurrence.interval,
            recurrence.monthlyAnchor
          );

      const [plan, usage] = await Promise.all([
        readProfilePlan(uid),
        readUsage(uid, monthFromDay(dayId)),
      ]);
      const limits = getLimits(plan);
      if (Number.isFinite(limits.maxTasksPerMonth)) {
        const tasksThisMonth = usage.tasks_created ?? 0;
        if (tasksThisMonth + occurrenceRanges.length > limits.maxTasksPerMonth) {
          throw ApiError.planLimit(
            `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
            {
              plan,
              limit: limits.maxTasksPerMonth,
              current: tasksThisMonth,
              requested: occurrenceRanges.length,
            }
          );
        }
      }

      const orderResult = await loadOrderCounters(
        uid,
        occurrenceRanges.map(r => r.dayId)
      );
      const orderByDay = orderResult.map;
      orderQueryCount = orderResult.queryCount;

      // #hashtags en el título se convierten en tags reutilizables
      const mergedTags = mergeTags(tags, extractHashtags(title));

      for (const range of occurrenceRanges) {
        const occWeekId =
          range.dayId === dayId ? weekId : getWeekIdFromDayId(range.dayId);
        const order = orderByDay.get(range.dayId) ?? 0;
        orderByDay.set(range.dayId, order + 1);
        rows.push({
          id: generateId(),
          user_id: uid,
          week_id: occWeekId,
          day_id: range.dayId,
          end_day_id: range.endDayId,
          title,
          completed: false,
          completed_at: null,
          project_id:
            isEventLike || isHabit || isFinance ? null : (projectId ?? null),
          project_category_id:
            isEventLike || isHabit || isFinance
              ? null
              : resolvedProjectCategoryId,
          priority: priority ?? (isHabit ? 'medium' : 'medium'),
          notes: notes ?? '',
          order,
          tags: mergedTags,
          moved_from: null,
          // Hábitos siempre con series_id (plantilla de recurrencia lazy).
          series_id:
            isHabit || recurrence.frequency !== 'none' ? seriesId : null,
          recurrence_frequency: recurrence.frequency,
          recurrence_interval: recurrence.interval,
          recurrence_anchor:
            recurrence.frequency === 'monthly'
              ? (recurrence.monthlyAnchor ?? 'day_of_month')
              : null,
          urgency:
            isEventLike || isHabit || isFinance ? null : (urgency ?? null),
          importance:
            isEventLike || isHabit || isFinance ? null : (importance ?? null),
          kind: taskKind,
          color:
            color ??
            (taskKind === 'event'
              ? '#58a6ff'
              : taskKind === 'possible_event'
                ? '#a371f7'
                : taskKind === 'habit_good'
                  ? '#3fb950'
                  : taskKind === 'habit_quit'
                    ? '#f85149'
                    : taskKind === 'finance_income'
                      ? '#3fb950'
                      : taskKind === 'finance_expense'
                        ? '#f85149'
                        : null),
          // Finanzas y hábitos: sin hora inicio/fin
          start_time: isHabit || isFinance ? null : (startTime ?? null),
          end_time: isHabit || isFinance ? null : (endTime ?? null),
          rx_meta: null,
          finance_meta: isFinance ? financeValue : null,
          involved_contact_ids: isEventLike ? involvedIds : [],
          location: isHabit || isFinance ? null : locationValue,
          departure_time: isHabit || isFinance ? null : departureValue,
          steps: isHabit || isFinance ? [] : stepsValue,
          // Imágenes solo en la primera instancia (evita inflar toda la serie).
          images: rows.length === 0 ? imagesValue : [],
          pomodoro_target: pomodoroTargetValue,
          pomodoro_done: 0,
          created_at: now,
          updated_at: now,
        });
      }
    }

    const { error } = await getSupabaseAdmin().from('tasks').insert(rows);
    if (error) throw error;

    // Primera instancia completa (compat) + resto compacto (id/ubicación).
    // roadmap §1.4: no volcar 28–90 filas full con steps/rx en la respuesta.
    const first = toClientTask(rows[0]);
    const instances = rows.map(row => ({
      id: row.id as string,
      weekId: (row.week_id as string) ?? weekId,
      dayId: (row.day_id as string) ?? dayId,
      endDayId: (row.end_day_id as string) ?? (row.day_id as string) ?? dayId,
      seriesId: (row.series_id as string | null) ?? null,
    }));

    res.status(201).json({
      ...first,
      createdCount: rows.length,
      instances,
    });

    // Fase 5: métricas create (p95 rolling en logs Railway).
    const createKind = (rows[0]?.kind as string) ?? taskKind;
    const createRecurrence =
      (rows[0]?.recurrence_frequency as string | undefined) ??
      recurrenceFrequency ??
      'none';
    logger.info(
      recordTaskCreate({
        ms: nowMs() - t0,
        rows: rows.length,
        kind: createKind,
        orderQueries: orderQueryCount,
        recurrence: createRecurrence,
      }),
      'api.tasks.create'
    );

    // No bloquear la respuesta al cliente (roadmap §1.3 / 0).
    void bumpUsage(uid, { tasksCreated: rows.length }, eventId).catch(err => {
      logger.warn({ err, uid, n: rows.length }, 'bumpUsage after create failed');
    });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch('/:weekId/:dayId/:taskId', async (req, res, next) => {
  const t0 = nowMs();
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }
    const patch = updateSchema.parse(req.body);
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Task not found');

    if (patch.endDayId !== undefined) {
      const startDay = (existing.day_id as string) ?? dayId;
      if (patch.endDayId < startDay) {
        throw ApiError.badRequest('endDayId debe ser >= dayId');
      }
      const existingEnd =
        (existing.end_day_id as string | undefined) ?? startDay;
      const willBeMulti = patch.endDayId > startDay;
      const frequency =
        (patch.recurrenceFrequency as RecurrenceFrequency | undefined) ??
        ((existing.recurrence_frequency as RecurrenceFrequency | undefined) ?? 'none');
      if (willBeMulti && !isMultiDayRecurrenceAllowed(frequency)) {
        throw ApiError.badRequest(
          'Las tareas de varios días solo admiten repetición none, monthly o yearly'
        );
      }
      // no-op guard for type use of existingEnd
      void existingEnd;
    }

    const applyTo = patch.applyTo ?? 'instance';
    const seriesId = (existing.series_id as string | null | undefined) ?? null;

    const existingKind = normalizeKind(existing.kind as string);
    const nextKind =
      patch.kind !== undefined ? patch.kind : existingKind;
    const nextIsFinance = isFinanceKind(nextKind);

    const nextStart =
      patch.startTime !== undefined
        ? patch.startTime
        : ((existing.start_time as string | null | undefined) ?? null);
    const nextEnd =
      patch.endTime !== undefined
        ? patch.endTime
        : ((existing.end_time as string | null | undefined) ?? null);
    const rangeStartDay = (existing.day_id as string) ?? dayId;
    const rangeEndDay =
      patch.endDayId !== undefined
        ? patch.endDayId
        : ((existing.end_day_id as string | undefined) ?? rangeStartDay);
    if (!nextIsFinance) {
      assertTimeRange(nextStart, nextEnd, rangeStartDay, rangeEndDay);
    }

    const financePatch = resolveFinanceMeta(nextKind, {
      finance: patch.finance,
      financeAmount: patch.financeAmount,
      financeCurrency: patch.financeCurrency,
      financeCertainty: patch.financeCertainty,
      existing: existing.finance_meta,
    });
    // Only write finance_meta when kind is (or becomes) finance, or when
    // converting away from finance (clear). Never touch it on normal task saves
    // that happen to send finance: null.
    const wasFinance = isFinanceKind(existingKind);
    const financeTouched =
      nextIsFinance &&
      (patch.finance !== undefined ||
        patch.financeAmount !== undefined ||
        patch.financeCurrency !== undefined ||
        patch.financeCertainty !== undefined ||
        patch.kind !== undefined);
    const financeClear =
      wasFinance && !nextIsFinance && patch.kind !== undefined;

    // Metadata compartida de la serie (no fechas ni completed).
    const seriesUpdate: Record<string, unknown> = { updated_at: now };
    if (patch.title !== undefined) seriesUpdate.title = patch.title;
    if (patch.projectId !== undefined) seriesUpdate.project_id = patch.projectId;
    if (patch.projectCategoryId !== undefined) {
      seriesUpdate.project_category_id = patch.projectCategoryId;
    }
    // Si se limpia el proyecto, también la subcategoría.
    if (patch.projectId === null) {
      seriesUpdate.project_category_id = null;
    }
    if (patch.priority !== undefined) seriesUpdate.priority = patch.priority;
    if (patch.notes !== undefined) seriesUpdate.notes = patch.notes;
    if (patch.tags !== undefined) seriesUpdate.tags = patch.tags;
    if (patch.urgency !== undefined) seriesUpdate.urgency = patch.urgency;
    if (patch.importance !== undefined) seriesUpdate.importance = patch.importance;
    if (patch.kind !== undefined) seriesUpdate.kind = patch.kind;
    if (patch.color !== undefined) seriesUpdate.color = patch.color;
    if (patch.startTime !== undefined) seriesUpdate.start_time = patch.startTime;
    if (patch.endTime !== undefined) seriesUpdate.end_time = patch.endTime;
    if (nextIsFinance) {
      seriesUpdate.start_time = null;
      seriesUpdate.end_time = null;
    }
    if (financeTouched) {
      seriesUpdate.finance_meta = financePatch;
    } else if (financeClear) {
      seriesUpdate.finance_meta = null;
    }
    if (patch.involvedContactIds !== undefined) {
      seriesUpdate.involved_contact_ids = patch.involvedContactIds;
    }
    if (patch.location !== undefined) seriesUpdate.location = patch.location;
    if (patch.departureTime !== undefined) {
      seriesUpdate.departure_time = patch.departureTime;
    }
    if (patch.pomodoroTarget !== undefined) {
      seriesUpdate.pomodoro_target = normalizePomodoroCount(patch.pomodoroTarget);
    }
    // steps/images: solo en la instancia (roadmap §1.7). No volcar a toda la serie.

    // Campos solo de instancia (nunca se propagan a la serie).
    const instanceUpdate: Record<string, unknown> = { updated_at: now };
    if (patch.completed !== undefined) {
      instanceUpdate.completed = patch.completed;
      instanceUpdate.completed_at = patch.completed ? now : null;
    }
    if (patch.steps !== undefined) {
      instanceUpdate.steps = normalizeSteps(patch.steps);
    }
    if (patch.images !== undefined) {
      instanceUpdate.images = normalizeImages(patch.images);
    }
    if (patch.order !== undefined) instanceUpdate.order = patch.order;
    if (patch.movedFrom !== undefined) instanceUpdate.moved_from = patch.movedFrom;
    if (patch.pomodoroDone !== undefined) {
      instanceUpdate.pomodoro_done = normalizePomodoroCount(patch.pomodoroDone);
    }
    if (patch.endDayId !== undefined) instanceUpdate.end_day_id = patch.endDayId;
    if (patch.recurrenceFrequency !== undefined) {
      instanceUpdate.recurrence_frequency = patch.recurrenceFrequency;
    }
    if (patch.recurrenceInterval !== undefined) {
      instanceUpdate.recurrence_interval = patch.recurrenceInterval;
    }
    if (patch.recurrenceMonthlyAnchor !== undefined) {
      instanceUpdate.recurrence_anchor =
        patch.recurrenceMonthlyAnchor === null
          ? null
          : normalizeMonthlyAnchor(patch.recurrenceMonthlyAnchor);
    }
    // Dosis de esta toma (rx_meta merge) — instancia por defecto
    if (
      patch.rxAmount !== undefined ||
      patch.rxUnit !== undefined ||
      patch.rxSubject !== undefined
    ) {
      const prev = parseRxMeta(existing.rx_meta) ?? {
        subject: null,
        amount: 1,
        unit: 'pills' as const,
        phaseIndex: 0,
        planStartDayId: dayId,
        phases: [],
      };
      instanceUpdate.rx_meta = {
        ...prev,
        amount: patch.rxAmount !== undefined ? patch.rxAmount : prev.amount,
        unit: patch.rxUnit !== undefined ? patch.rxUnit : prev.unit,
        subject:
          patch.rxSubject !== undefined ? patch.rxSubject : prev.subject,
      };
    }

    // Tags de recetario al cambiar kind/sujeto en serie
    const nextKindForTags =
      patch.kind !== undefined
        ? patch.kind
        : normalizeKind(existing.kind as string);
    const prevRx = parseRxMeta(existing.rx_meta);
    const nextSubjectForTags =
      patch.rxSubject !== undefined ? patch.rxSubject : (prevRx?.subject ?? null);
    if (
      applyTo === 'series' &&
      seriesId &&
      (patch.kind !== undefined || patch.rxSubject !== undefined) &&
      (isRxKind(nextKindForTags) || isRxKind(normalizeKind(existing.kind as string)))
    ) {
      const titleForTags =
        typeof seriesUpdate.title === 'string'
          ? seriesUpdate.title
          : String(existing.title ?? '');
      const baseTags = Array.isArray(patch.tags)
        ? patch.tags
        : Array.isArray(existing.tags)
          ? (existing.tags as string[])
          : [];
      seriesUpdate.tags = mergeTagsForRx(
        titleForTags,
        baseTags,
        nextKindForTags,
        nextSubjectForTags
      );
      if (patch.kind === 'rx_pet' && patch.color === undefined && !seriesUpdate.color) {
        seriesUpdate.color = '#d29922';
      }
      if (patch.kind === 'rx_human' && patch.color === undefined && !seriesUpdate.color) {
        seriesUpdate.color = '#a371f7';
      }
    }

    const needsSeriesRxSubject =
      applyTo === 'series' &&
      seriesId != null &&
      patch.rxSubject !== undefined;

    const hasSeriesFields =
      Object.keys(seriesUpdate).length > 1 || needsSeriesRxSubject; // updated_at + …
    const hasInstanceFields = Object.keys(instanceUpdate).length > 1;

    let updatedCount = 0;

    if (applyTo === 'series' && hasSeriesFields) {
      if (!seriesId) {
        throw ApiError.badRequest('applyTo=series requiere una tarea con seriesId');
      }
      if (Object.keys(seriesUpdate).length > 1) {
        const { error, count } = await getSupabaseAdmin()
          .from('tasks')
          .update(seriesUpdate, { count: 'exact' })
          .eq('user_id', uid)
          .eq('series_id', seriesId);
        if (error) throw error;
        updatedCount = count ?? 0;
      }

      // Propagar subject (y amount/unit si vienen) a rx_meta de TODA la serie.
      const needsSeriesRxMeta =
        needsSeriesRxSubject ||
        (applyTo === 'series' &&
          seriesId != null &&
          (patch.rxAmount !== undefined || patch.rxUnit !== undefined));
      if (needsSeriesRxMeta) {
        const { data: siblings, error: sibErr } = await getSupabaseAdmin()
          .from('tasks')
          .select('id, rx_meta')
          .eq('user_id', uid)
          .eq('series_id', seriesId);
        if (sibErr) throw sibErr;
        const rows = siblings ?? [];
        updatedCount = Math.max(updatedCount, rows.length);
        await Promise.all(
          rows.map(async row => {
            const prev = parseRxMeta(row.rx_meta) ?? {
              subject: null,
              amount: 1,
              unit: 'pills' as const,
              phaseIndex: 0,
              planStartDayId: dayId,
              phases: [],
            };
            const nextMeta = {
              ...prev,
              subject:
                patch.rxSubject !== undefined ? patch.rxSubject : prev.subject,
              amount: patch.rxAmount !== undefined ? patch.rxAmount : prev.amount,
              unit: patch.rxUnit !== undefined ? patch.rxUnit : prev.unit,
            };
            const { error: metaErr } = await getSupabaseAdmin()
              .from('tasks')
              .update({ rx_meta: nextMeta, updated_at: now })
              .eq('id', row.id)
              .eq('user_id', uid);
            if (metaErr) throw metaErr;
          })
        );
      }

      // completed / order / endDayId solo en la fila pedida
      if (hasInstanceFields) {
        const instOnly = { ...instanceUpdate };
        if (needsSeriesRxMeta) {
          delete instOnly.rx_meta;
        }
        if (Object.keys(instOnly).length > 1) {
          const { error: instErr } = await getSupabaseAdmin()
            .from('tasks')
            .update(instOnly)
            .eq('id', taskId)
            .eq('user_id', uid);
          if (instErr) throw instErr;
        }
      }
    } else {
      // instance (default): merge series + instance fields on one row
      const update: Record<string, unknown> = { updated_at: now };
      if (patch.title !== undefined) update.title = patch.title;
      if (patch.completed !== undefined) {
        update.completed = patch.completed;
        update.completed_at = patch.completed ? now : null;
      }
      if (patch.projectId !== undefined) update.project_id = patch.projectId;
      if (patch.projectCategoryId !== undefined) {
        update.project_category_id = patch.projectCategoryId;
      }
      if (patch.projectId === null) {
        update.project_category_id = null;
      }
      if (patch.priority !== undefined) update.priority = patch.priority;
      if (patch.notes !== undefined) update.notes = patch.notes;
      if (patch.tags !== undefined) update.tags = patch.tags;
      if (patch.order !== undefined) update.order = patch.order;
      if (patch.movedFrom !== undefined) update.moved_from = patch.movedFrom;
      if (patch.endDayId !== undefined) update.end_day_id = patch.endDayId;
      if (patch.recurrenceFrequency !== undefined) {
        update.recurrence_frequency = patch.recurrenceFrequency;
      }
      if (patch.recurrenceInterval !== undefined) {
        update.recurrence_interval = patch.recurrenceInterval;
      }
      if (patch.recurrenceMonthlyAnchor !== undefined) {
        update.recurrence_anchor =
          patch.recurrenceMonthlyAnchor === null
            ? null
            : normalizeMonthlyAnchor(patch.recurrenceMonthlyAnchor);
      }
      if (patch.urgency !== undefined) update.urgency = patch.urgency;
      if (patch.importance !== undefined) update.importance = patch.importance;
      if (patch.kind !== undefined) update.kind = patch.kind;
      if (patch.color !== undefined) update.color = patch.color;
      if (patch.startTime !== undefined) update.start_time = patch.startTime;
      if (patch.endTime !== undefined) update.end_time = patch.endTime;
      if (nextIsFinance) {
        update.start_time = null;
        update.end_time = null;
      }
      if (financeTouched) {
        update.finance_meta = financePatch;
      } else if (financeClear) {
        update.finance_meta = null;
      }
      if (patch.involvedContactIds !== undefined) {
        update.involved_contact_ids = patch.involvedContactIds;
      }
      if (patch.location !== undefined) update.location = patch.location;
      if (patch.departureTime !== undefined) {
        update.departure_time = patch.departureTime;
      }
      if (patch.steps !== undefined) {
        update.steps = normalizeSteps(patch.steps);
      }
      if (patch.images !== undefined) {
        update.images = normalizeImages(patch.images);
      }
      if (patch.pomodoroTarget !== undefined) {
        update.pomodoro_target = normalizePomodoroCount(patch.pomodoroTarget);
      }
      if (patch.pomodoroDone !== undefined) {
        update.pomodoro_done = normalizePomodoroCount(patch.pomodoroDone);
      }
      if (
        patch.rxAmount !== undefined ||
        patch.rxUnit !== undefined ||
        patch.rxSubject !== undefined
      ) {
        const prev = parseRxMeta(existing.rx_meta) ?? {
          subject: null,
          amount: 1,
          unit: 'pills' as const,
          phaseIndex: 0,
          planStartDayId: dayId,
          phases: [],
        };
        update.rx_meta = {
          ...prev,
          amount: patch.rxAmount !== undefined ? patch.rxAmount : prev.amount,
          unit: patch.rxUnit !== undefined ? patch.rxUnit : prev.unit,
          subject:
            patch.rxSubject !== undefined ? patch.rxSubject : prev.subject,
        };
      }

      const { error } = await getSupabaseAdmin()
        .from('tasks')
        .update(update)
        .eq('id', taskId)
        .eq('user_id', uid);
      if (error) throw error;
      updatedCount = 1;
    }

    const { applyTo: _a, ...clientPatch } = patch;
    res.json({
      id: taskId,
      weekId,
      dayId,
      applyTo,
      updatedCount,
      ...clientPatch,
    });

    // Fase 5: métricas update (p95 rolling en logs Railway).
    logger.info(
      recordTaskUpdate({
        ms: nowMs() - t0,
        kind: normalizeKind(existing.kind),
        applyTo,
        updatedCount,
      }),
      'api.tasks.update'
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Regenera tomas incompletas de un recetario con un plan de fases nuevo.
 * Conserva tomas ya completadas. Elimina incompletas desde fromDayId.
 */
tasksRouter.post(
  '/:weekId/:dayId/:taskId/rematerialize-rx',
  async (req, res, next) => {
    try {
      const uid = req.user!.uid;
      const { weekId, dayId, taskId } = req.params;
      if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
        throw ApiError.badRequest('weekId/dayId con formato invalido');
      }
      const body = rematerializeRxSchema.parse(req.body);
      const phaseErr = validateRxPhases(body.rxPhases);
      if (phaseErr) throw ApiError.badRequest(phaseErr);

      const { data: existing, error: fetchError } = await getSupabaseAdmin()
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', uid)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!existing) throw ApiError.notFound('Task not found');

      const kind = normalizeKind(existing.kind);
      if (!isRxKind(kind)) {
        throw ApiError.badRequest('Solo recetarios admiten rematerialize-rx');
      }
      const seriesId = (existing.series_id as string | null) ?? null;
      if (!seriesId) {
        throw ApiError.badRequest('Recetario sin seriesId');
      }

      const fromDayId = body.fromDayId ?? dayId;
      const title = body.title ?? (existing.title as string);
      const subject =
        body.rxSubject !== undefined
          ? body.rxSubject
          : (parseRxMeta(existing.rx_meta)?.subject ?? null);
      const color =
        body.color !== undefined
          ? body.color
          : ((existing.color as string | null) ?? null);

      // Borrar incompletas de la serie desde fromDayId (conserva completadas y el pasado).
      const { error: delErr } = await getSupabaseAdmin()
        .from('tasks')
        .delete()
        .eq('user_id', uid)
        .eq('series_id', seriesId)
        .eq('completed', false)
        .gte('day_id', fromDayId);
      if (delErr) throw delErr;

      let occurrences;
      try {
        occurrences = materializeRxOccurrences(fromDayId, body.rxPhases);
      } catch (e) {
        throw ApiError.badRequest(
          e instanceof Error ? e.message : 'Plan de recetario inválido'
        );
      }

      const [plan, usage] = await Promise.all([
        readProfilePlan(uid),
        readUsage(uid, monthFromDay(fromDayId)),
      ]);
      const limits = getLimits(plan);
      if (Number.isFinite(limits.maxTasksPerMonth)) {
        const tasksThisMonth = usage.tasks_created ?? 0;
        if (tasksThisMonth + occurrences.length > limits.maxTasksPerMonth) {
          throw ApiError.planLimit(
            `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
            {
              plan,
              limit: limits.maxTasksPerMonth,
              current: tasksThisMonth,
              requested: occurrences.length,
            }
          );
        }
      }

      const now = new Date().toISOString();
      const orderResult = await loadOrderCounters(
        uid,
        occurrences.map(o => o.dayId)
      );
      const orderByDay = orderResult.map;

      const rows: Record<string, unknown>[] = [];
      for (const occ of occurrences) {
        const occWeekId = getWeekIdFromDayId(occ.dayId);
        const order = orderByDay.get(occ.dayId) ?? 0;
        orderByDay.set(occ.dayId, order + 1);
        const rxMeta = buildRxMetaForOccurrence(
          fromDayId,
          body.rxPhases,
          occ,
          subject
        );
        rows.push({
          id: generateId(),
          user_id: uid,
          week_id: occWeekId,
          day_id: occ.dayId,
          end_day_id: occ.dayId,
          title,
          completed: false,
          completed_at: null,
          project_id: null,
          priority: 'high',
          notes: (existing.notes as string) ?? '',
          order,
          tags: Array.isArray(existing.tags) ? existing.tags : [],
          moved_from: null,
          series_id: seriesId,
          recurrence_frequency: 'none',
          recurrence_interval: 1,
          urgency: 'urgent',
          importance: 'important',
          kind,
          color: color ?? (kind === 'rx_pet' ? '#d29922' : '#a371f7'),
          start_time: occ.startTime,
          end_time: null,
          rx_meta: rxMeta,
          created_at: now,
          updated_at: now,
        });
      }

      if (rows.length > 0) {
        const { error: insErr } = await getSupabaseAdmin()
          .from('tasks')
          .insert(rows);
        if (insErr) throw insErr;
      }

      // Actualizar título en tomas completadas conservadas
      if (body.title) {
        await getSupabaseAdmin()
          .from('tasks')
          .update({ title: body.title, updated_at: now })
          .eq('user_id', uid)
          .eq('series_id', seriesId)
          .eq('completed', true);
      }

      const instances = rows.map(row => toClientTask(row));
      res.status(201).json({
        seriesId,
        fromDayId,
        created: instances.length,
        instances,
      });

      if (rows.length > 0) {
        void bumpUsage(uid, { tasksCreated: rows.length }).catch(err => {
          logger.warn(
            { err, uid, n: rows.length },
            'bumpUsage after rematerialize-rx failed'
          );
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Materializa (o devuelve) la instancia de un hábito en un día concreto.
 * Fase 2 lazy: create solo deja seed; al completar/editar un día virtual se llama aquí.
 */
const habitEnsureSchema = z.object({
  seriesId: z.string().min(1).max(80),
  dayId: z.string().refine(isValidDayId, 'dayId formato YYYY-MM-DD'),
  completed: z.boolean().optional(),
});

tasksRouter.post('/habit-ensure', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = habitEnsureSchema.parse(req.body);
    const { seriesId, dayId: targetDayId } = body;
    const now = new Date().toISOString();

    const { data: seriesRows, error: seriesErr } = await getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('series_id', seriesId)
      .order('day_id', { ascending: true })
      .limit(40);
    if (seriesErr) throw seriesErr;
    if (!seriesRows?.length) {
      throw ApiError.notFound('Serie de hábito no encontrada');
    }

    const template = seriesRows.find(r => isHabitKind(normalizeKind(r.kind))) ?? seriesRows[0];
    if (!isHabitKind(normalizeKind(template.kind))) {
      throw ApiError.badRequest('La serie no es un hábito');
    }

    const existing = seriesRows.find(r => r.day_id === targetDayId);
    if (existing) {
      if (body.completed !== undefined) {
        const { error: upErr } = await getSupabaseAdmin()
          .from('tasks')
          .update({
            completed: body.completed,
            completed_at: body.completed ? now : null,
            updated_at: now,
          })
          .eq('id', existing.id)
          .eq('user_id', uid);
        if (upErr) throw upErr;
        existing.completed = body.completed;
        existing.completed_at = body.completed ? now : null;
        existing.updated_at = now;
      }
      res.json(toClientTask(existing as Record<string, unknown>));
      return;
    }

    const seedDay = (template.day_id as string) ?? targetDayId;
    if (targetDayId < seedDay) {
      throw ApiError.badRequest('dayId anterior al inicio del hábito');
    }

    const { count } = await getSupabaseAdmin()
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('day_id', targetDayId);

    const newId = generateId();
    const weekId = getWeekIdFromDayId(targetDayId);
    const row: Record<string, unknown> = {
      id: newId,
      user_id: uid,
      week_id: weekId,
      day_id: targetDayId,
      end_day_id: targetDayId,
      title: template.title,
      completed: body.completed ?? false,
      completed_at: body.completed ? now : null,
      project_id: null,
      project_category_id: null,
      priority: template.priority ?? 'medium',
      notes: (template.notes as string) ?? '',
      order: count ?? 0,
      tags: Array.isArray(template.tags) ? template.tags : [],
      moved_from: null,
      series_id: seriesId,
      recurrence_frequency: template.recurrence_frequency ?? 'daily',
      recurrence_interval:
        typeof template.recurrence_interval === 'number'
          ? template.recurrence_interval
          : 1,
      urgency: null,
      importance: null,
      kind: template.kind,
      color: template.color ?? null,
      start_time: null,
      end_time: null,
      rx_meta: null,
      involved_contact_ids: [],
      location: null,
      departure_time: null,
      steps: Array.isArray(template.steps) ? template.steps : [],
      images: [],
      finance_meta: template.finance_meta ?? null,
      pomodoro_target: normalizePomodoroCount(
        template.pomodoro_target ?? template.pomodoroTarget
      ),
      pomodoro_done: 0,
      created_at: now,
      updated_at: now,
    };

    const { error: insErr } = await getSupabaseAdmin().from('tasks').insert(row);
    if (insErr) throw insErr;

    res.status(201).json(toClientTask(row));

    void bumpUsage(uid, { tasksCreated: 1 }).catch(err => {
      logger.warn({ err, uid }, 'bumpUsage after habit-ensure failed');
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Elimina todas las filas de una serie (p. ej. recetario completo).
 * Debe ir antes de `/:weekId/:dayId/:taskId` para no capturar "series" como weekId.
 */
tasksRouter.delete('/series/:seriesId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const seriesId = String(req.params.seriesId ?? '').trim();
    if (!seriesId || seriesId.length > 80) {
      throw ApiError.badRequest('seriesId inválido');
    }

    const { error } = await getSupabaseAdmin()
      .from('tasks')
      .delete()
      .eq('user_id', uid)
      .eq('series_id', seriesId);
    if (error) throw error;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:weekId/:dayId/:taskId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Task not found');

    const { error } = await getSupabaseAdmin()
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', uid);
    if (error) throw error;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const moveSchema = z.object({
  toWeekId: z.string().refine(isValidWeekId),
  toDayId: z.string().refine(isValidDayId),
});

tasksRouter.post('/:weekId/:dayId/:taskId/move', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }
    const { toWeekId, toDayId } = moveSchema.parse(req.body);

    // Lookup by id+user first (path week/day may be stale if dragged from mid-span).
    const { data: fromTask, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!fromTask) throw ApiError.notFound('Task not found');

    const oldStart = (fromTask.day_id as string) ?? dayId;
    const oldEnd = (fromTask.end_day_id as string | undefined) ?? oldStart;
    // inclusiveDurationDays = offset (span length − 1)
    const duration = inclusiveDurationDays(oldStart, oldEnd);
    const newEndDayId = addDaysToDayId(toDayId, duration);
    const movedFrom =
      `${(fromTask.week_id as string) ?? weekId}/${oldStart}` || dayId;

    const now = new Date().toISOString();
    // UPDATE in place — never insert+delete same PK (that failed in prod and
    // left the optimistic client move orphaned / "disappeared").
    const { error: updateError } = await getSupabaseAdmin()
      .from('tasks')
      .update({
        week_id: toWeekId,
        day_id: toDayId,
        end_day_id: newEndDayId,
        moved_from: movedFrom,
        updated_at: now,
      })
      .eq('id', taskId)
      .eq('user_id', uid);
    if (updateError) throw updateError;

    res.json({
      id: taskId,
      weekId: toWeekId,
      dayId: toDayId,
      endDayId: newEndDayId,
      movedFrom,
    });
  } catch (err) {
    next(err);
  }
});

function monthFromDay(dayId: string): string {
  return dayId.slice(0, 7);
}
