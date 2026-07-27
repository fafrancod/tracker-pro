import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type {
  CreateFinanceEntryPayload,
  FinanceEntry,
  UpdateFinanceEntryPayload,
} from '../types';

const DEMO_KEY = 'daily-tracker:demo-finances';

function loadDemo(): FinanceEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(DEMO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinanceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemo(entries: FinanceEntry[]): void {
  try {
    globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

function mapEntry(raw: Record<string, unknown>): FinanceEntry {
  return {
    id: (raw.id as string) ?? '',
    title: (raw.title as string) ?? '',
    amount: Number(raw.amount ?? 0),
    currency: (raw.currency as string) ?? 'EUR',
    flow: (raw.flow as FinanceEntry['flow']) ?? 'expense',
    kind: (raw.kind as FinanceEntry['kind']) ?? 'specific',
    frequency: (raw.frequency as FinanceEntry['frequency']) ?? null,
    recurrenceDay:
      typeof raw.recurrenceDay === 'number'
        ? raw.recurrenceDay
        : typeof raw.recurrence_day === 'number'
          ? raw.recurrence_day
          : null,
    entryDate:
      (raw.entryDate as string | null | undefined) ??
      (raw.entry_date as string | null | undefined) ??
      null,
    notes: (raw.notes as string) ?? '',
    active: raw.active !== false,
    createdAt:
      (raw.createdAt as string) ??
      (raw.created_at as string) ??
      new Date(0).toISOString(),
    updatedAt:
      (raw.updatedAt as string) ??
      (raw.updated_at as string) ??
      new Date(0).toISOString(),
  };
}

export async function fetchFinanceEntries(): Promise<FinanceEntry[]> {
  if (isDemoMode()) return loadDemo();
  const res = await api.get<{ entries: Record<string, unknown>[] }>(
    '/api/finances'
  );
  return (res.entries ?? []).map(r => mapEntry(r));
}

export async function createFinanceEntry(
  payload: CreateFinanceEntryPayload
): Promise<FinanceEntry> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const entry: FinanceEntry = {
      id: `demo-fin-${Date.now().toString(36)}`,
      title: payload.title,
      amount: payload.amount,
      currency: payload.currency ?? 'EUR',
      flow: payload.flow,
      kind: payload.kind,
      frequency: payload.frequency ?? null,
      recurrenceDay: payload.recurrenceDay ?? null,
      entryDate: payload.entryDate ?? null,
      notes: payload.notes ?? '',
      active: payload.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    const all = loadDemo();
    all.unshift(entry);
    saveDemo(all);
    return entry;
  }
  const res = await api.post<Record<string, unknown>>('/api/finances', payload);
  return mapEntry(res);
}

export async function updateFinanceEntry(
  id: string,
  payload: UpdateFinanceEntryPayload
): Promise<void> {
  if (isDemoMode()) {
    const all = loadDemo();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Not found');
    all[idx] = {
      ...all[idx],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    saveDemo(all);
    return;
  }
  await api.patch<void>(`/api/finances/${encodeURIComponent(id)}`, payload);
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  if (isDemoMode()) {
    saveDemo(loadDemo().filter(e => e.id !== id));
    return;
  }
  await api.del<void>(`/api/finances/${encodeURIComponent(id)}`);
}
