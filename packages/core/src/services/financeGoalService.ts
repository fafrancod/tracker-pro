import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseGoalPayload } from '../lib/finance/payload';
import type { FinanceGoal } from '../lib/finance/types';

const DEMO_KEY = 'daily-tracker:demo-finance-goals';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadDemo(): FinanceGoal[] {
  try {
    const raw = ls()?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceGoal[];
    return Array.isArray(parsed) ? parsed.filter(g => !g.archived) : [];
  } catch {
    return [];
  }
}

function saveDemo(value: FinanceGoal[]): void {
  try {
    ls()?.setItem(DEMO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapGoal(raw: Record<string, unknown>): FinanceGoal {
  const payload = parseGoalPayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    currency: String(raw.currency ?? 'EUR'),
    targetDayId:
      (raw.targetDayId as string | null) ??
      (raw.target_day_id as string | null) ??
      null,
    linkedAccountId:
      (raw.linkedAccountId as string | null) ??
      (raw.linked_account_id as string | null) ??
      null,
    name: typeof raw.name === 'string' ? raw.name : payload.name,
    targetAmount:
      typeof raw.targetAmount === 'number' ? raw.targetAmount : payload.targetAmount,
    notes: typeof raw.notes === 'string' ? raw.notes : payload.notes,
    archived: Boolean(raw.archived ?? raw.archived_at),
    sealed: Boolean(raw.sealed),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceGoals(): Promise<FinanceGoal[]> {
  if (isDemoMode()) return loadDemo();
  const res = await api.get<{ goals?: Record<string, unknown>[] }>(
    '/api/finances/goals'
  );
  return (res.goals ?? []).map(mapGoal);
}

export async function createFinanceGoal(payload: {
  name: string;
  targetAmount: number;
  currency?: string;
  notes?: string;
  targetDayId?: string | null;
  linkedAccountId?: string | null;
}): Promise<FinanceGoal> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const goal: FinanceGoal = {
      id: `demo-fg-${Date.now().toString(36)}`,
      currency: payload.currency ?? 'EUR',
      targetDayId: payload.targetDayId ?? null,
      linkedAccountId: payload.linkedAccountId ?? null,
      name: payload.name,
      targetAmount: payload.targetAmount,
      notes: payload.notes ?? '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveDemo([goal, ...loadDemo()]);
    return goal;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/goals',
    payload
  );
  return mapGoal(res);
}

export async function updateFinanceGoal(
  id: string,
  payload: {
    name?: string;
    targetAmount?: number;
    currency?: string;
    notes?: string;
    targetDayId?: string | null;
    linkedAccountId?: string | null;
    archived?: boolean;
  }
): Promise<FinanceGoal> {
  if (isDemoMode()) {
    const all = loadDemo();
    const idx = all.findIndex(g => g.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = { ...all[idx], ...payload, updatedAt: new Date().toISOString() };
    all[idx] = next;
    saveDemo(all);
    return next;
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/goals/${encodeURIComponent(id)}`,
    payload
  );
  return mapGoal(res);
}

export async function deleteFinanceGoal(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(g => g.id !== id));
    return;
  }
  await api.del(`/api/finances/goals/${encodeURIComponent(id)}`);
}
