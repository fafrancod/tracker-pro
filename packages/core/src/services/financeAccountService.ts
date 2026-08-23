import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseAccountPayload } from '../lib/finance/payload';
import type { FinanceAccount, FinanceAccountType } from '../lib/finance/types';

const DEMO_KEY = 'daily-tracker:demo-finance-accounts';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadDemo(): FinanceAccount[] {
  try {
    const raw = ls()?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceAccount[];
    return Array.isArray(parsed) ? parsed.filter(a => !a.archived) : [];
  } catch {
    return [];
  }
}

function saveDemo(value: FinanceAccount[]): void {
  try {
    ls()?.setItem(DEMO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapAccount(raw: Record<string, unknown>): FinanceAccount {
  const payload = parseAccountPayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    type:
      raw.type === 'cash' ||
      raw.type === 'debit' ||
      raw.type === 'credit' ||
      raw.type === 'brokerage'
        ? raw.type
        : 'other',
    currency: String(raw.currency ?? 'EUR'),
    name: typeof raw.name === 'string' ? raw.name : payload.name,
    institution:
      typeof raw.institution === 'string' ? raw.institution : payload.institution,
    creditLimit:
      typeof raw.creditLimit === 'number' ? raw.creditLimit : payload.creditLimit,
    billedTotal:
      typeof raw.billedTotal === 'number' ? raw.billedTotal : payload.billedTotal,
    billingDate:
      typeof raw.billingDate === 'string' ? raw.billingDate : payload.billingDate,
    archived: Boolean(raw.archived ?? raw.archived_at),
    sealed: Boolean(raw.sealed),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceAccounts(): Promise<FinanceAccount[]> {
  if (isDemoMode()) return loadDemo();
  const res = await api.get<{ accounts?: Record<string, unknown>[] }>(
    '/api/finances/accounts'
  );
  return (res.accounts ?? []).map(mapAccount);
}

export async function createFinanceAccount(payload: {
  type: FinanceAccountType;
  currency?: string;
  name: string;
  institution?: string;
  creditLimit?: number;
  billedTotal?: number;
  billingDate?: string;
}): Promise<FinanceAccount> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const acc: FinanceAccount = {
      id: `demo-fa-${Date.now().toString(36)}`,
      type: payload.type,
      currency: payload.currency ?? 'EUR',
      name: payload.name,
      institution: payload.institution ?? '',
      creditLimit: payload.creditLimit ?? 0,
      billedTotal: payload.billedTotal ?? 0,
      billingDate: payload.billingDate ?? '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveDemo([acc, ...loadDemo()]);
    return acc;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/accounts',
    payload
  );
  return mapAccount(res);
}

export async function updateFinanceAccount(
  id: string,
  payload: {
    type?: FinanceAccountType;
    currency?: string;
    name?: string;
    institution?: string;
    creditLimit?: number;
    billedTotal?: number;
    billingDate?: string;
    archived?: boolean;
  }
): Promise<FinanceAccount> {
  if (isDemoMode()) {
    const all = loadDemo();
    const idx = all.findIndex(a => a.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = { ...all[idx], ...payload, updatedAt: new Date().toISOString() };
    all[idx] = next;
    saveDemo(all);
    return next;
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/accounts/${encodeURIComponent(id)}`,
    payload
  );
  return mapAccount(res);
}

export async function deleteFinanceAccount(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(a => a.id !== id));
    return;
  }
  await api.del(`/api/finances/accounts/${encodeURIComponent(id)}`);
}
