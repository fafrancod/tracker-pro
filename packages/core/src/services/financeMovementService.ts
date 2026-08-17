import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseFinancePayload } from '../lib/finance/payload';
import { expandFinanceRules } from '../lib/finance/expandRules';
import type {
  CreateFinanceMovementPayload,
  FinanceMovement,
  FinanceRule,
  UpdateFinanceMovementPayload,
} from '../lib/finance/types';

const DEMO_MOV_KEY = 'daily-tracker:demo-finance-movements';
const DEMO_RULE_KEY = 'daily-tracker:demo-finance-rules';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadJson<T>(key: string): T[] {
  try {
    const raw = ls()?.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJson<T>(key: string, value: T[]): void {
  try {
    ls()?.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapMovement(raw: Record<string, unknown>): FinanceMovement {
  const payload = parseFinancePayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    dayId: String(raw.dayId ?? raw.day_id ?? ''),
    flow:
      raw.flow === 'income' || raw.flow === 'investment' ? raw.flow : 'expense',
    status:
      raw.status === 'confirmed' || raw.status === 'skipped'
        ? raw.status
        : 'planned',
    currency: String(raw.currency ?? 'EUR'),
    title: typeof raw.title === 'string' ? raw.title : payload.title,
    amount: typeof raw.amount === 'number' ? raw.amount : payload.amount,
    notes: typeof raw.notes === 'string' ? raw.notes : payload.notes,
    certainty: raw.certainty === 'potential' ? 'potential' : payload.certainty,
    ruleId: (raw.ruleId as string | null) ?? (raw.rule_id as string | null) ?? null,
    sourceTaskId:
      (raw.sourceTaskId as string | null) ??
      (raw.source_task_id as string | null) ??
      null,
    virtual: Boolean(raw.virtual),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

function mapRule(raw: Record<string, unknown>): FinanceRule {
  const payload = parseFinancePayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    flow: raw.flow === 'income' || raw.flow === 'investment' ? raw.flow : 'expense',
    currency: String(raw.currency ?? 'EUR'),
    frequency: raw.frequency === 'weekly' ? 'weekly' : 'monthly',
    recurrenceDay:
      typeof raw.recurrenceDay === 'number'
        ? raw.recurrenceDay
        : typeof raw.recurrence_day === 'number'
          ? raw.recurrence_day
          : 1,
    startDayId: String(raw.startDayId ?? raw.start_day_id ?? ''),
    title: typeof raw.title === 'string' ? raw.title : payload.title,
    amount: typeof raw.amount === 'number' ? raw.amount : payload.amount,
    notes: typeof raw.notes === 'string' ? raw.notes : payload.notes,
    certainty: raw.certainty === 'potential' ? 'potential' : payload.certainty,
    active: raw.active !== false,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceMovements(
  fromDayId: string,
  toDayId: string
): Promise<{ movements: FinanceMovement[]; rules: FinanceRule[] }> {
  if (isDemoMode()) {
    const movements = loadJson<FinanceMovement>(DEMO_MOV_KEY).filter(
      m => m.dayId >= fromDayId && m.dayId <= toDayId
    );
    const rules = loadJson<FinanceRule>(DEMO_RULE_KEY);
    return { movements, rules };
  }
  const res = await api.get<{
    movements?: Record<string, unknown>[];
    rules?: Record<string, unknown>[];
  }>(
    `/api/finances/movements?from=${encodeURIComponent(fromDayId)}&to=${encodeURIComponent(toDayId)}`
  );
  return {
    movements: (res.movements ?? []).map(mapMovement),
    rules: (res.rules ?? []).map(mapRule),
  };
}

export async function fetchFinanceCalendar(
  fromDayId: string,
  toDayId: string
): Promise<FinanceMovement[]> {
  const { movements, rules } = await fetchFinanceMovements(fromDayId, toDayId);
  const virtuals = expandFinanceRules(rules, movements, fromDayId, toDayId);
  return [...movements, ...virtuals].sort((a, b) => {
    if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId);
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

export async function createFinanceMovement(
  payload: CreateFinanceMovementPayload
): Promise<FinanceMovement> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const id = `demo-fm-${Date.now().toString(36)}`;
    let ruleId: string | null = null;
    if (payload.recurrence) {
      ruleId = `demo-fr-${Date.now().toString(36)}`;
      const rules = loadJson<FinanceRule>(DEMO_RULE_KEY);
      rules.unshift({
        id: ruleId,
        flow: payload.flow,
        currency: payload.currency ?? 'EUR',
        frequency: payload.recurrence.frequency,
        recurrenceDay: payload.recurrence.recurrenceDay,
        startDayId: payload.dayId,
        title: payload.title,
        amount: payload.amount,
        notes: payload.notes ?? '',
        certainty: payload.certainty ?? 'fixed',
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      saveJson(DEMO_RULE_KEY, rules);
    }
    const mov: FinanceMovement = {
      id,
      dayId: payload.dayId,
      flow: payload.flow,
      status: payload.status ?? 'planned',
      currency: payload.currency ?? 'EUR',
      title: payload.title,
      amount: payload.amount,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
      ruleId,
      sourceTaskId: null,
      createdAt: now,
      updatedAt: now,
    };
    const all = loadJson<FinanceMovement>(DEMO_MOV_KEY);
    all.unshift(mov);
    saveJson(DEMO_MOV_KEY, all);
    return mov;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/movements',
    payload
  );
  return mapMovement(res);
}

export async function updateFinanceMovement(
  id: string,
  payload: UpdateFinanceMovementPayload
): Promise<FinanceMovement> {
  if (isDemoMode()) {
    const all = loadJson<FinanceMovement>(DEMO_MOV_KEY);
    const idx = all.findIndex(m => m.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = {
      ...all[idx],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = next;
    saveJson(DEMO_MOV_KEY, all);
    return next;
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/movements/${encodeURIComponent(id)}`,
    payload
  );
  return mapMovement(res);
}

export async function deleteFinanceMovement(id: string): Promise<void> {
  if (isDemoMode()) {
    saveJson(
      DEMO_MOV_KEY,
      loadJson<FinanceMovement>(DEMO_MOV_KEY).filter(m => m.id !== id)
    );
    return;
  }
  await api.del<void>(`/api/finances/movements/${encodeURIComponent(id)}`);
}
