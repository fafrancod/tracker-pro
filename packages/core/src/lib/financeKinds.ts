import type { FinanceCertainty, FinanceMeta, TaskKind } from '../types';

export function isFinanceKind(
  kind: TaskKind | string | null | undefined
): boolean {
  return kind === 'finance_income' || kind === 'finance_expense';
}

export function isFinanceIncome(
  kind: TaskKind | string | null | undefined
): boolean {
  return kind === 'finance_income';
}

export function defaultFinanceColor(
  kind: TaskKind | string | null | undefined
): string {
  return kind === 'finance_income' ? '#3fb950' : '#f85149';
}

export function normalizeFinanceCertainty(
  raw: unknown
): FinanceCertainty {
  return raw === 'potential' ? 'potential' : 'fixed';
}

export function normalizeFinanceMeta(raw: unknown): FinanceMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency =
    typeof o.currency === 'string' && o.currency.trim()
      ? o.currency.trim().toUpperCase().slice(0, 8)
      : 'EUR';
  return {
    amount,
    currency,
    certainty: normalizeFinanceCertainty(o.certainty),
  };
}

export function buildFinanceMeta(opts: {
  amount?: number | null;
  currency?: string | null;
  certainty?: FinanceCertainty | null;
  existing?: FinanceMeta | null;
}): FinanceMeta {
  const amount =
    typeof opts.amount === 'number' && Number.isFinite(opts.amount)
      ? Math.max(0, opts.amount)
      : (opts.existing?.amount ?? 0);
  const currency =
    (opts.currency && opts.currency.trim()
      ? opts.currency.trim().toUpperCase().slice(0, 8)
      : null) ??
    opts.existing?.currency ??
    'EUR';
  const certainty =
    opts.certainty ?? opts.existing?.certainty ?? 'fixed';
  return { amount, currency, certainty };
}
