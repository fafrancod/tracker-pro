import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { parseFinancePayload } from '../lib/finance/payload';
import { expandFinanceRules } from '../lib/finance/expandRules';
import {
  encryptFinancePayload,
  financePayloadAad,
} from '../lib/finance/vault';
import { unsealFinanceLedger } from '../lib/finance/unseal';
import type {
  CreateFinanceMovementPayload,
  FinanceMovement,
  FinanceRule,
  FinanceVaultCtx,
  UpdateFinanceMovementPayload,
} from '../lib/finance/types';

export type { FinanceVaultCtx };

function newFinanceId(prefix: string): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${rnd.replace(/-/g, '').slice(0, 20)}`;
}

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
    payloadEnc:
      typeof raw.payloadEnc === 'string'
        ? raw.payloadEnc
        : typeof raw.payload_enc === 'string'
          ? raw.payload_enc
          : null,
    sealed: Boolean(raw.sealed),
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
    payloadEnc:
      typeof raw.payloadEnc === 'string'
        ? raw.payloadEnc
        : typeof raw.payload_enc === 'string'
          ? raw.payload_enc
          : null,
    sealed: Boolean(raw.sealed),
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
  toDayId: string,
  vault?: FinanceVaultCtx
): Promise<FinanceMovement[]> {
  const raw = await fetchFinanceMovements(fromDayId, toDayId);
  const { movements, rules } = vault
    ? await unsealFinanceLedger(vault.uid, vault.dek, raw.movements, raw.rules)
    : raw;
  const virtuals = expandFinanceRules(rules, movements, fromDayId, toDayId);
  return [...movements, ...virtuals].sort((a, b) => {
    if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId);
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

export async function createFinanceMovement(
  payload: CreateFinanceMovementPayload,
  vault?: FinanceVaultCtx
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
        title: payload.title ?? '',
        amount: payload.amount ?? 0,
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
      title: payload.title ?? '',
      amount: payload.amount ?? 0,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
      ruleId,
      sourceTaskId: payload.sourceTaskId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const all = loadJson<FinanceMovement>(DEMO_MOV_KEY);
    all.unshift(mov);
    saveJson(DEMO_MOV_KEY, all);
    return mov;
  }
  let body: CreateFinanceMovementPayload = payload;
  if (vault) {
    const id = payload.id ?? newFinanceId('fm');
    const aad = financePayloadAad(vault.uid, 'finance_movements', id);
    const inner = {
      title: payload.title ?? '',
      amount: payload.amount ?? 0,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
    };
    const payloadEnc = await encryptFinancePayload(vault.dek, inner, aad);
    let ruleId: string | undefined;
    let rulePayloadEnc: string | undefined;
    if (payload.recurrence) {
      ruleId = newFinanceId('fr');
      rulePayloadEnc = await encryptFinancePayload(
        vault.dek,
        inner,
        financePayloadAad(vault.uid, 'finance_rules', ruleId)
      );
    }
    body = {
      id,
      dayId: payload.dayId,
      flow: payload.flow,
      status: payload.status,
      currency: payload.currency,
      clientMutationId: payload.clientMutationId,
      recurrence: payload.recurrence,
      payloadEnc,
      ruleId,
      rulePayloadEnc,
      sourceTaskId: payload.sourceTaskId ?? null,
    };
  }
  const res = await api.post<Record<string, unknown>>(
    '/api/finances/movements',
    body
  );
  const mapped = mapMovement(res);
  if (vault && mapped.sealed) {
    return {
      ...mapped,
      title: payload.title ?? '',
      amount: payload.amount ?? 0,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
      sealed: false,
    };
  }
  return mapped;
}

export async function fetchFinanceMovement(
  id: string
): Promise<FinanceMovement> {
  if (isDemoMode()) {
    const found = loadJson<FinanceMovement>(DEMO_MOV_KEY).find(m => m.id === id);
    if (!found) throw new Error('Not found');
    return found;
  }
  const res = await api.get<Record<string, unknown>>(
    `/api/finances/movements/${encodeURIComponent(id)}`
  );
  return mapMovement(res);
}

export async function updateFinanceMovement(
  id: string,
  payload: UpdateFinanceMovementPayload,
  vault?: FinanceVaultCtx
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
  let body: UpdateFinanceMovementPayload = payload;
  if (vault && (payload.title !== undefined || payload.amount !== undefined)) {
    const payloadEnc = await encryptFinancePayload(
      vault.dek,
      {
        title: payload.title ?? '',
        amount: payload.amount ?? 0,
        notes: payload.notes ?? '',
        certainty: payload.certainty ?? 'fixed',
      },
      financePayloadAad(vault.uid, 'finance_movements', id)
    );
    body = {
      dayId: payload.dayId,
      flow: payload.flow,
      status: payload.status,
      currency: payload.currency,
      updatedAt: payload.updatedAt,
      payloadEnc,
    };
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/movements/${encodeURIComponent(id)}`,
    body
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

export type FinanceVaultScheme = 'none' | 'account' | 'private';

export interface FinanceVaultRemote {
  enabled: boolean;
  scheme?: FinanceVaultScheme;
  kdfSalt?: string;
  kdfParams?: { algo: 'PBKDF2'; iterations: number; hash: 'SHA-256' };
  wrappedDek?: string;
  recoveryWrappedDek?: string;
  encV?: string;
  wiped?: boolean;
  adopted?: number;
}

export async function fetchFinanceVault(): Promise<FinanceVaultRemote> {
  if (isDemoMode()) return { enabled: false, scheme: 'none' };
  return api.get<FinanceVaultRemote>('/api/finances/vault');
}

export async function resetFinanceVault(): Promise<FinanceVaultRemote> {
  if (isDemoMode()) return { enabled: false, scheme: 'account', wiped: true };
  return api.post<FinanceVaultRemote>('/api/finances/vault/reset', {});
}

export async function adoptAccountVault(body: {
  movements: Array<{
    id: string;
    title: string;
    amount: number;
    notes?: string;
    certainty?: 'fixed' | 'potential';
  }>;
  rules?: Array<{
    id: string;
    title: string;
    amount: number;
    notes?: string;
    certainty?: 'fixed' | 'potential';
  }>;
}): Promise<FinanceVaultRemote> {
  if (isDemoMode()) {
    return { enabled: false, scheme: 'account', adopted: body.movements.length };
  }
  return api.post<FinanceVaultRemote>('/api/finances/vault/adopt-account', body);
}

export async function putFinanceVault(meta: {
  kdfSalt: string;
  kdfParams: { algo: 'PBKDF2'; iterations: number; hash: 'SHA-256' };
  wrappedDek: string;
  recoveryWrappedDek: string;
  encV: string;
}): Promise<void> {
  if (isDemoMode()) return;
  await api.put('/api/finances/vault', meta);
}

export async function fetchFinanceLedger(): Promise<{
  movements: FinanceMovement[];
  rules: FinanceRule[];
}> {
  if (isDemoMode()) {
    return {
      movements: loadJson<FinanceMovement>(DEMO_MOV_KEY),
      rules: loadJson<FinanceRule>(DEMO_RULE_KEY),
    };
  }
  const res = await api.get<{
    movements?: Record<string, unknown>[];
    rules?: Record<string, unknown>[];
  }>('/api/finances/ledger');
  return {
    movements: (res.movements ?? []).map(mapMovement),
    rules: (res.rules ?? []).map(mapRule),
  };
}

export async function sealFinanceRule(
  ruleId: string,
  payloadEnc: string
): Promise<void> {
  if (isDemoMode()) return;
  await api.patch(`/api/finances/rules/${encodeURIComponent(ruleId)}`, {
    payloadEnc,
  });
}
