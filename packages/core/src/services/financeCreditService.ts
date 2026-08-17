import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseCreditPayload } from '../lib/finance/payload';
import type { FinanceCredit, FinanceCreditKind } from '../lib/finance/types';

const DEMO_KEY = 'daily-tracker:demo-finance-credits';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadDemo(): FinanceCredit[] {
  try {
    const raw = ls()?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceCredit[];
    return Array.isArray(parsed) ? parsed.filter(c => !c.archived) : [];
  } catch {
    return [];
  }
}

function saveDemo(value: FinanceCredit[]): void {
  try {
    ls()?.setItem(DEMO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapCredit(raw: Record<string, unknown>): FinanceCredit {
  const payload = parseCreditPayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    currency: String(raw.currency ?? 'EUR'),
    kind:
      raw.kind === 'mortgage' || raw.kind === 'auto' || raw.kind === 'consumer'
        ? raw.kind
        : 'other',
    dueDay: typeof raw.dueDay === 'number' ? raw.dueDay : Number(raw.due_day) || 1,
    startDayId: String(raw.startDayId ?? raw.start_day_id ?? ''),
    termMonths:
      typeof raw.termMonths === 'number'
        ? raw.termMonths
        : Number(raw.term_months) || 1,
    name: typeof raw.name === 'string' ? raw.name : payload.name,
    principal:
      typeof raw.principal === 'number' ? raw.principal : payload.principal,
    monthlyInstallment:
      typeof raw.monthlyInstallment === 'number'
        ? raw.monthlyInstallment
        : payload.monthlyInstallment,
    notes: typeof raw.notes === 'string' ? raw.notes : payload.notes,
    archived: Boolean(raw.archived ?? raw.archived_at),
    sealed: Boolean(raw.sealed),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceCredits(): Promise<FinanceCredit[]> {
  if (isDemoMode()) return loadDemo();
  const res = await api.get<{ credits?: Record<string, unknown>[] }>(
    '/api/finances/credits'
  );
  return (res.credits ?? []).map(mapCredit);
}

export async function createFinanceCredit(payload: {
  name: string;
  principal: number;
  monthlyInstallment: number;
  dueDay: number;
  startDayId: string;
  termMonths: number;
  currency?: string;
  kind?: FinanceCreditKind;
  notes?: string;
}): Promise<FinanceCredit> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const credit: FinanceCredit = {
      id: `demo-fc-${Date.now().toString(36)}`,
      currency: payload.currency ?? 'EUR',
      kind: payload.kind ?? 'consumer',
      dueDay: payload.dueDay,
      startDayId: payload.startDayId,
      termMonths: payload.termMonths,
      name: payload.name,
      principal: payload.principal,
      monthlyInstallment: payload.monthlyInstallment,
      notes: payload.notes ?? '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveDemo([credit, ...loadDemo()]);
    return credit;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/credits',
    payload
  );
  return mapCredit(res);
}

export async function updateFinanceCredit(
  id: string,
  payload: Partial<{
    name: string;
    principal: number;
    monthlyInstallment: number;
    dueDay: number;
    startDayId: string;
    termMonths: number;
    currency: string;
    kind: FinanceCreditKind;
    notes: string;
    archived: boolean;
  }>
): Promise<FinanceCredit> {
  if (isDemoMode()) {
    const all = loadDemo();
    const idx = all.findIndex(c => c.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = { ...all[idx], ...payload, updatedAt: new Date().toISOString() };
    all[idx] = next;
    saveDemo(all);
    return next;
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/credits/${encodeURIComponent(id)}`,
    payload
  );
  return mapCredit(res);
}

export async function deleteFinanceCredit(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(c => c.id !== id));
    return;
  }
  await api.del(`/api/finances/credits/${encodeURIComponent(id)}`);
}
