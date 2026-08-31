import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseMerchantPayload } from '../lib/finance/payload';
import type { FinanceMerchant } from '../lib/finance/types';

const DEMO_KEY = 'daily-tracker:demo-finance-merchants';

type Ls = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function ls(): Ls | undefined {
  return (globalThis as { localStorage?: Ls }).localStorage;
}

function loadDemo(): FinanceMerchant[] {
  try {
    const raw = ls()?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceMerchant[];
    return Array.isArray(parsed) ? parsed.filter(m => !m.archived) : [];
  } catch {
    return [];
  }
}

function saveDemo(value: FinanceMerchant[]): void {
  try {
    ls()?.setItem(DEMO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapMerchant(raw: Record<string, unknown>): FinanceMerchant {
  const payload = parseMerchantPayload(raw.payload ?? raw);
  return {
    id: String(raw.id ?? ''),
    color: typeof raw.color === 'string' && raw.color ? raw.color : '#0ea5e9',
    name: typeof raw.name === 'string' ? raw.name : payload.name,
    notes: typeof raw.notes === 'string' ? raw.notes : payload.notes,
    archived: Boolean(raw.archived ?? raw.archived_at),
    sealed: Boolean(raw.sealed),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export async function fetchFinanceMerchants(): Promise<FinanceMerchant[]> {
  if (isDemoMode()) return loadDemo();
  const res = await api.get<{ merchants?: Record<string, unknown>[] }>(
    '/api/finances/merchants'
  );
  return (res.merchants ?? []).map(mapMerchant);
}

export async function createFinanceMerchant(payload: {
  name: string;
  notes?: string;
  color?: string;
}): Promise<FinanceMerchant> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const merchant: FinanceMerchant = {
      id: `demo-mer-${Date.now().toString(36)}`,
      color: payload.color || '#0ea5e9',
      name: payload.name,
      notes: payload.notes ?? '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveDemo([merchant, ...loadDemo()]);
    return merchant;
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/merchants',
    payload
  );
  return mapMerchant(res);
}

export async function updateFinanceMerchant(
  id: string,
  payload: {
    name?: string;
    notes?: string;
    color?: string;
    archived?: boolean;
  }
): Promise<FinanceMerchant> {
  if (isDemoMode()) {
    const all = loadDemo();
    const idx = all.findIndex(m => m.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = { ...all[idx], ...payload, updatedAt: new Date().toISOString() };
    all[idx] = next;
    saveDemo(all);
    return next;
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/merchants/${encodeURIComponent(id)}`,
    payload
  );
  return mapMerchant(res);
}

export async function deleteFinanceMerchant(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(m => m.id !== id));
    return;
  }
  await api.del(`/api/finances/merchants/${encodeURIComponent(id)}`);
}
