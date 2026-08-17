import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseCategoryPayload } from '../lib/finance/payload';
import {
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_SEEDS,
} from '../lib/finance/categoryBudget';
import type { FinanceCategory, FinanceUserCategory } from '../lib/finance/types';

const DEMO_KEY = 'daily-tracker:demo-finance-categories';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadDemo(): FinanceUserCategory[] {
  try {
    const raw = ls()?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceUserCategory[];
    return Array.isArray(parsed) ? parsed.filter(c => !c.archived) : [];
  } catch {
    return [];
  }
}

function saveDemo(value: FinanceUserCategory[]): void {
  try {
    ls()?.setItem(DEMO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapCategory(raw: Record<string, unknown>): FinanceUserCategory {
  const payload = parseCategoryPayload(raw.payload ?? raw);
  const group = raw.groupKey ?? raw.group_key;
  return {
    id: String(raw.id ?? ''),
    groupKey:
      group === 'housing' ||
      group === 'food' ||
      group === 'transport' ||
      group === 'health' ||
      group === 'leisure' ||
      group === 'debt' ||
      group === 'invest'
        ? group
        : 'other',
    color: typeof raw.color === 'string' && raw.color ? raw.color : '#94a3b8',
    currency: String(raw.currency ?? 'EUR'),
    name: typeof raw.name === 'string' ? raw.name : payload.name,
    monthlyBudget:
      typeof raw.monthlyBudget === 'number'
        ? raw.monthlyBudget
        : payload.monthlyBudget,
    necessary:
      typeof raw.necessary === 'boolean' ? raw.necessary : payload.necessary,
    archived: Boolean(raw.archived ?? raw.archived_at),
    sealed: Boolean(raw.sealed),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceCategories(): Promise<FinanceUserCategory[]> {
  if (isDemoMode()) {
    const existing = loadDemo();
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    const seeded = DEFAULT_CATEGORY_SEEDS.map((seed, i) => ({
      id: `demo-cat-${seed.groupKey}`,
      groupKey: seed.groupKey,
      color: DEFAULT_CATEGORY_COLORS[seed.groupKey] ?? '#94a3b8',
      currency: 'CLP',
      name: seed.name,
      monthlyBudget: 0,
      necessary: seed.necessary,
      archived: false,
      createdAt: now,
      updatedAt: now,
      _i: i,
    }));
    saveDemo(seeded);
    return seeded;
  }
  const res = await api.get<{ categories?: Record<string, unknown>[] }>(
    '/api/finances/categories'
  );
  return (res.categories ?? []).map(mapCategory);
}

export async function createFinanceCategory(payload: {
  name: string;
  groupKey?: FinanceCategory;
  color?: string;
  currency?: string;
  monthlyBudget?: number;
  necessary?: boolean;
}): Promise<FinanceUserCategory> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const groupKey = payload.groupKey ?? 'other';
    const cat: FinanceUserCategory = {
      id: `demo-cat-${Date.now().toString(36)}`,
      groupKey,
      color: payload.color || DEFAULT_CATEGORY_COLORS[groupKey] || '#94a3b8',
      currency: payload.currency ?? 'CLP',
      name: payload.name,
      monthlyBudget: payload.monthlyBudget ?? 0,
      necessary: payload.necessary ?? groupKey !== 'leisure',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveDemo([cat, ...loadDemo()]);
    return cat;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/categories',
    payload
  );
  return mapCategory(res);
}

export async function updateFinanceCategory(
  id: string,
  payload: {
    name?: string;
    groupKey?: FinanceCategory;
    color?: string;
    currency?: string;
    monthlyBudget?: number;
    necessary?: boolean;
    archived?: boolean;
  }
): Promise<FinanceUserCategory> {
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
    `/api/finances/categories/${encodeURIComponent(id)}`,
    payload
  );
  return mapCategory(res);
}

export async function deleteFinanceCategory(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(c => c.id !== id));
    return;
  }
  await api.del(`/api/finances/categories/${encodeURIComponent(id)}`);
}
