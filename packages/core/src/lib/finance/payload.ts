import type { FinanceCertainty } from '../../types';
import { normalizeCurrencyCode } from '../currencies';
import type {
  FinanceAccountPayload,
  FinanceAccountType,
  FinanceMovementFlow,
  FinanceMovementPayload,
  FinanceMovementStatus,
  FinanceMovementTag,
} from './types';

export const FINANCE_RANGE_MAX_DAYS = 93;

export function normalizeFinanceFlow(raw: unknown): FinanceMovementFlow {
  if (raw === 'income' || raw === 'investment') return raw;
  return 'expense';
}

export function normalizeFinanceStatus(raw: unknown): FinanceMovementStatus {
  if (raw === 'confirmed' || raw === 'skipped') return raw;
  return 'planned';
}

export function normalizeMovementCertainty(raw: unknown): FinanceCertainty {
  return raw === 'potential' ? 'potential' : 'fixed';
}

export function normalizeFinanceTag(raw: unknown): FinanceMovementTag | null {
  if (raw === 'card_payment' || raw === 'goal_contribution') return raw;
  return null;
}

export function normalizeAccountType(raw: unknown): FinanceAccountType {
  if (
    raw === 'cash' ||
    raw === 'debit' ||
    raw === 'credit' ||
    raw === 'brokerage'
  ) {
    return raw;
  }
  return 'other';
}

export function parseFinancePayload(raw: unknown): FinanceMovementPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const amount = Number(o.amount);
  return {
    title: typeof o.title === 'string' ? o.title.trim().slice(0, 160) : '',
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 2000) : '',
    certainty: normalizeMovementCertainty(o.certainty),
    tag: normalizeFinanceTag(o.tag),
    originalAmount: Number.isFinite(Number(o.originalAmount))
      ? Number(o.originalAmount)
      : null,
    originalCurrency:
      typeof o.originalCurrency === 'string'
        ? o.originalCurrency.trim().toUpperCase().slice(0, 8)
        : null,
    exchangeRate:
      Number.isFinite(Number(o.exchangeRate)) && Number(o.exchangeRate) > 0
        ? Number(o.exchangeRate)
        : null,
    fxPending: o.fxPending === true,
    reportingCurrency:
      typeof o.reportingCurrency === 'string'
        ? o.reportingCurrency.trim().toUpperCase().slice(0, 8)
        : null,
  };
}

export function buildFinancePayload(input: {
  title?: string;
  amount?: number;
  notes?: string;
  certainty?: FinanceCertainty;
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
  existing?: FinanceMovementPayload;
}): FinanceMovementPayload {
  const existing = input.existing;
  return parseFinancePayload({
    title: input.title ?? existing?.title ?? '',
    amount: input.amount ?? existing?.amount ?? 0,
    notes: input.notes ?? existing?.notes ?? '',
    certainty: input.certainty ?? existing?.certainty ?? 'fixed',
    tag: input.tag !== undefined ? input.tag : existing?.tag,
    originalAmount:
      input.originalAmount !== undefined
        ? input.originalAmount
        : existing?.originalAmount,
    originalCurrency:
      input.originalCurrency !== undefined
        ? input.originalCurrency
        : existing?.originalCurrency,
    exchangeRate:
      input.exchangeRate !== undefined ? input.exchangeRate : existing?.exchangeRate,
    fxPending:
      input.fxPending !== undefined ? input.fxPending : existing?.fxPending,
    reportingCurrency:
      input.reportingCurrency !== undefined
        ? input.reportingCurrency
        : existing?.reportingCurrency,
  });
}

export function parseGoalPayload(raw: unknown): import('./types').FinanceGoalPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const target = Number(o.targetAmount);
  return {
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '',
    targetAmount: Number.isFinite(target) && target >= 0 ? target : 0,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 2000) : '',
  };
}

export function parseAccountPayload(raw: unknown): FinanceAccountPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const limit = Number(o.creditLimit);
  return {
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '',
    institution:
      typeof o.institution === 'string' ? o.institution.trim().slice(0, 80) : '',
    creditLimit: Number.isFinite(limit) && limit >= 0 ? limit : 0,
  };
}

export function inclusiveDaySpan(fromDayId: string, toDayId: string): number {
  const a = Date.parse(`${fromDayId}T00:00:00`);
  const b = Date.parse(`${toDayId}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return -1;
  return Math.round((b - a) / 86400000) + 1;
}

export function normalizeMovementCurrency(code: string | null | undefined): string {
  return normalizeCurrencyCode(code, 'EUR');
}
