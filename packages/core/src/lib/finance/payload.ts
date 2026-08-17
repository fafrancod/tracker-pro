import type { FinanceCertainty } from '../../types';
import { normalizeCurrencyCode } from '../currencies';
import type {
  FinanceMovementFlow,
  FinanceMovementPayload,
  FinanceMovementStatus,
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

export function parseFinancePayload(raw: unknown): FinanceMovementPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const amount = Number(o.amount);
  return {
    title: typeof o.title === 'string' ? o.title.trim().slice(0, 160) : '',
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 2000) : '',
    certainty: normalizeMovementCertainty(o.certainty),
  };
}

export function buildFinancePayload(input: {
  title?: string;
  amount?: number;
  notes?: string;
  certainty?: FinanceCertainty;
  existing?: FinanceMovementPayload;
}): FinanceMovementPayload {
  const existing = input.existing;
  return parseFinancePayload({
    title: input.title ?? existing?.title ?? '',
    amount: input.amount ?? existing?.amount ?? 0,
    notes: input.notes ?? existing?.notes ?? '',
    certainty: input.certainty ?? existing?.certainty ?? 'fixed',
  });
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
