import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { buildFinancePayload, parseFinancePayload } from '../lib/finance/payload';
import type { TickerQuote, TickerSearchHit } from '../lib/finance/portfolio';
import {
  dedupeFinanceCalendarMovements,
  expandFinanceRules,
} from '../lib/finance/expandRules';
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
    purchaseDayId: payload.purchaseDayId ?? null,
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
    accountId:
      (raw.accountId as string | null) ??
      (raw.account_id as string | null) ??
      null,
    cardAccountId:
      (raw.cardAccountId as string | null) ??
      (raw.card_account_id as string | null) ??
      null,
    goalId:
      (raw.goalId as string | null) ?? (raw.goal_id as string | null) ?? null,
    creditId:
      (raw.creditId as string | null) ?? (raw.credit_id as string | null) ?? null,
    installmentGroupId:
      (raw.installmentGroupId as string | null) ??
      (raw.installment_group_id as string | null) ??
      null,
    installmentIndex:
      typeof raw.installmentIndex === 'number'
        ? raw.installmentIndex
        : typeof raw.installment_index === 'number'
          ? raw.installment_index
          : null,
    installmentTotal:
      typeof raw.installmentTotal === 'number'
        ? raw.installmentTotal
        : typeof raw.installment_total === 'number'
          ? raw.installment_total
          : null,
    tag: payload.tag ?? null,
    originalAmount: payload.originalAmount ?? null,
    originalCurrency: payload.originalCurrency ?? null,
    exchangeRate: payload.exchangeRate ?? null,
    fxPending: Boolean(payload.fxPending),
    reportingCurrency: payload.reportingCurrency ?? null,
    investmentSide: payload.investmentSide ?? null,
    ticker: payload.ticker ?? null,
    assetName: payload.assetName ?? null,
    quantity: payload.quantity ?? null,
    investedAmount: payload.investedAmount ?? null,
    investmentStatus: payload.investmentStatus ?? null,
    closesLotId: payload.closesLotId ?? null,
    category: payload.category ?? null,
    categoryId: payload.categoryId ?? null,
    images: payload.images ?? [],
    categorySplits: payload.categorySplits ?? [],
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
  return dedupeFinanceCalendarMovements(
    [...movements, ...virtuals],
    rules
  ).sort((a, b) => {
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
    let ruleId: string | null = payload.ruleId ?? null;
    if (payload.recurrence) {
      ruleId = payload.ruleId ?? `demo-fr-${Date.now().toString(36)}`;
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
      purchaseDayId: payload.purchaseDayId ?? payload.dayId,
      flow: payload.flow,
      status: payload.status ?? 'confirmed',
      currency: payload.currency ?? 'EUR',
      title: payload.title ?? '',
      amount: payload.amount ?? 0,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
      accountId: payload.accountId ?? null,
      cardAccountId: payload.cardAccountId ?? null,
      goalId: payload.goalId ?? null,
      creditId: payload.creditId ?? null,
      installmentGroupId: payload.installmentGroupId ?? null,
      installmentIndex: payload.installmentIndex ?? null,
      installmentTotal: payload.installmentTotal ?? null,
      tag: payload.tag ?? null,
      originalAmount: payload.originalAmount ?? payload.amount ?? 0,
      originalCurrency: payload.originalCurrency ?? payload.currency ?? 'EUR',
      exchangeRate: payload.exchangeRate ?? null,
      fxPending: Boolean(payload.fxPending),
      reportingCurrency: payload.reportingCurrency ?? null,
      investmentSide: payload.investmentSide ?? null,
      ticker: payload.ticker ?? null,
      assetName: payload.assetName ?? null,
      quantity: payload.quantity ?? null,
      investedAmount: payload.investedAmount ?? payload.amount ?? 0,
      investmentStatus: payload.investmentStatus ?? (payload.flow === 'investment' ? 'open' : null),
      closesLotId: payload.closesLotId ?? null,
      category: payload.category ?? (payload.flow === 'investment' ? 'invest' : null),
      categoryId: payload.categoryId ?? null,
      images: payload.images ?? [],
      categorySplits: payload.categorySplits ?? [],
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
    const inner = buildFinancePayload({
      title: payload.title ?? '',
      amount: payload.amount ?? 0,
      notes: payload.notes ?? '',
      certainty: payload.certainty ?? 'fixed',
      purchaseDayId: payload.purchaseDayId ?? payload.dayId,
      tag: payload.tag ?? null,
      originalAmount: payload.originalAmount ?? payload.amount ?? 0,
      originalCurrency: payload.originalCurrency ?? payload.currency ?? null,
      exchangeRate: payload.exchangeRate ?? null,
      fxPending: Boolean(payload.fxPending),
      reportingCurrency: payload.reportingCurrency ?? null,
      investmentSide: payload.investmentSide,
      ticker: payload.ticker,
      assetName: payload.assetName,
      quantity: payload.quantity,
      investedAmount: payload.investedAmount,
      investmentStatus: payload.investmentStatus,
      closesLotId: payload.closesLotId,
      category: payload.category,
      categoryId: payload.categoryId,
      images: payload.images,
      categorySplits: payload.categorySplits,
    });
    const payloadEnc = await encryptFinancePayload(vault.dek, inner, aad);
    let ruleId: string | undefined = payload.ruleId ?? undefined;
    let rulePayloadEnc: string | undefined;
    if (payload.recurrence) {
      ruleId = payload.ruleId ?? newFinanceId('fr');
      rulePayloadEnc = await encryptFinancePayload(
        vault.dek,
        inner,
        financePayloadAad(vault.uid, 'finance_rules', ruleId)
      );
    }
    body = {
      id,
      replaceMovementId: payload.replaceMovementId,
      dayId: payload.dayId,
      purchaseDayId: payload.purchaseDayId,
      flow: payload.flow,
      status: payload.status,
      currency: payload.currency,
      clientMutationId: payload.clientMutationId,
      recurrence: payload.recurrence,
      payloadEnc,
      ruleId,
      rulePayloadEnc,
      sourceTaskId: payload.sourceTaskId ?? null,
      accountId: payload.accountId ?? null,
      cardAccountId: payload.cardAccountId ?? null,
      goalId: payload.goalId ?? null,
      tag: payload.tag ?? null,
      originalAmount: payload.originalAmount,
      originalCurrency: payload.originalCurrency,
      exchangeRate: payload.exchangeRate,
      fxPending: payload.fxPending,
      reportingCurrency: payload.reportingCurrency,
      investmentSide: payload.investmentSide,
      ticker: payload.ticker,
      assetName: payload.assetName,
      quantity: payload.quantity,
      investedAmount: payload.investedAmount,
      investmentStatus: payload.investmentStatus,
      closesLotId: payload.closesLotId,
      category: payload.category,
      categoryId: payload.categoryId,
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
      buildFinancePayload({
        title: payload.title ?? '',
        amount: payload.amount ?? 0,
        notes: payload.notes ?? '',
        certainty: payload.certainty ?? 'fixed',
        purchaseDayId: payload.purchaseDayId,
        tag: payload.tag ?? null,
        originalAmount: payload.originalAmount,
        originalCurrency: payload.originalCurrency,
        exchangeRate: payload.exchangeRate,
        fxPending: payload.fxPending,
        reportingCurrency: payload.reportingCurrency,
        investmentSide: payload.investmentSide,
        ticker: payload.ticker,
        assetName: payload.assetName,
        quantity: payload.quantity,
        investedAmount: payload.investedAmount,
        investmentStatus: payload.investmentStatus,
        closesLotId: payload.closesLotId,
        category: payload.category,
        categoryId: payload.categoryId,
        images: payload.images,
        categorySplits: payload.categorySplits,
      }),
      financePayloadAad(vault.uid, 'finance_movements', id)
    );
    body = {
      dayId: payload.dayId,
      flow: payload.flow,
      status: payload.status,
      currency: payload.currency,
      updatedAt: payload.updatedAt,
      purchaseDayId: payload.purchaseDayId,
      payloadEnc,
      accountId: payload.accountId,
      cardAccountId: payload.cardAccountId,
      goalId: payload.goalId,
      tag: payload.tag,
    };
  }
  const res = await api.patch<Record<string, unknown>>(
    `/api/finances/movements/${encodeURIComponent(id)}`,
    body
  );
  return mapMovement(res);
}

export async function fetchFinanceRate(
  from: string,
  to: string,
  date?: string
): Promise<{ from: string; to: string; rate: number; date: string }> {
  if (from.toUpperCase() === to.toUpperCase()) {
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: 1,
      date: date ?? new Date().toISOString().slice(0, 10),
    };
  }
  if (isDemoMode()) {
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: 900,
      date: date ?? new Date().toISOString().slice(0, 10),
    };
  }
  const qs = new URLSearchParams({ from, to });
  if (date) qs.set('date', date);
  return api.get(`/api/finances/fx?${qs.toString()}`);
}

export async function resolveFinanceFx(opts: {
  amount: number;
  currency: string;
  reportingCurrency: string;
  dayId: string;
}): Promise<{
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number | null;
  fxPending: boolean;
  reportingCurrency: string;
}> {
  const originalAmount = opts.amount;
  const originalCurrency = opts.currency;
  const reportingCurrency = opts.reportingCurrency;
  if (originalCurrency.toUpperCase() === reportingCurrency.toUpperCase()) {
    return {
      originalAmount,
      originalCurrency,
      exchangeRate: 1,
      fxPending: false,
      reportingCurrency,
    };
  }
  try {
    const quote = await fetchFinanceRate(
      originalCurrency,
      reportingCurrency,
      opts.dayId
    );
    return {
      originalAmount,
      originalCurrency,
      exchangeRate: quote.rate,
      fxPending: false,
      reportingCurrency,
    };
  } catch {
    return {
      originalAmount,
      originalCurrency,
      exchangeRate: null,
      fxPending: true,
      reportingCurrency,
    };
  }
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

export async function searchInvestmentTickers(
  query: string
): Promise<TickerSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  if (isDemoMode()) {
    const demo: TickerSearchHit[] = [
      { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', type: 'Common Stock' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'ARCA', type: 'ETF' },
    ];
    const needle = q.toLowerCase();
    return demo.filter(
      row =>
        row.symbol.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle)
    );
  }
  try {
    const res = await api.get<{ results?: TickerSearchHit[] }>(
      `/api/finances/investments/search?q=${encodeURIComponent(q)}`
    );
    return res.results ?? [];
  } catch {
    return [];
  }
}

export async function fetchInvestmentQuotes(
  symbols: string[]
): Promise<TickerQuote[]> {
  const list = [...new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean))];
  if (list.length === 0) return [];
  if (isDemoMode()) {
    return list.map(symbol => ({
      symbol,
      name: symbol,
      price: null,
      currency: null,
      changePercent: null,
    }));
  }
  try {
    const res = await api.get<{ quotes?: TickerQuote[] }>(
      `/api/finances/investments/quote?symbols=${encodeURIComponent(list.join(','))}`
    );
    return res.quotes ?? [];
  } catch {
    return [];
  }
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

export async function updateFinanceRule(
  ruleId: string,
  patch: { frequency?: 'monthly' | 'weekly'; recurrenceDay?: number }
): Promise<{ id: string; frequency: 'monthly' | 'weekly'; recurrenceDay: number }> {
  if (isDemoMode()) {
    const rules = loadJson<FinanceRule>(DEMO_RULE_KEY);
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx >= 0) {
      rules[idx] = {
        ...rules[idx],
        frequency: patch.frequency ?? rules[idx].frequency,
        recurrenceDay: patch.recurrenceDay ?? rules[idx].recurrenceDay,
        updatedAt: new Date().toISOString(),
      };
      saveJson(DEMO_RULE_KEY, rules);
      return {
        id: ruleId,
        frequency: rules[idx].frequency,
        recurrenceDay: rules[idx].recurrenceDay,
      };
    }
  }
  return api.patch(`/api/finances/rules/${encodeURIComponent(ruleId)}`, patch);
}
