import type { FinanceMovement, FinanceMovementMonthSummary } from './types';
import { reportingAmountOf } from './fx';

export function monthIdFromDayId(dayId: string): string {
  return dayId.slice(0, 7);
}

export type FinanceFxFields = Pick<
  FinanceMovement,
  | 'amount'
  | 'currency'
  | 'originalAmount'
  | 'originalCurrency'
  | 'exchangeRate'
  | 'fxPending'
>;

export interface FinanceCurrencyLine {
  currency: string;
  nativeTotal: number;
  reportingTotal: number;
  pendingNativeTotal: number;
  pendingCount: number;
  isPreferred: boolean;
}

export interface FinanceCurrencyBreakdown {
  reportingCurrency: string;
  reportingTotal: number;
  pendingCount: number;
  lines: FinanceCurrencyLine[];
}

export function movementSourceCurrency(mov: FinanceFxFields): string {
  return (mov.originalCurrency || mov.currency || 'EUR').toUpperCase();
}

export function movementNativeAmount(mov: FinanceFxFields): number {
  const raw =
    mov.originalAmount != null && Number.isFinite(Number(mov.originalAmount))
      ? Number(mov.originalAmount)
      : Number(mov.amount);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function emptyCurrencyLine(
  currency: string,
  reportingCurrency: string
): FinanceCurrencyLine {
  return {
    currency,
    nativeTotal: 0,
    reportingTotal: 0,
    pendingNativeTotal: 0,
    pendingCount: 0,
    isPreferred: currency === reportingCurrency,
  };
}

function sortCurrencyLines(lines: FinanceCurrencyLine[]): FinanceCurrencyLine[] {
  return [...lines].sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return a.currency.localeCompare(b.currency);
  });
}

/**
 * Desglose por divisa original. El total de reporte usa el tipo guardado
 * en cada movimiento (el del día de la transacción), no un tipo en vivo.
 */
export function summarizeCurrencyBreakdown(
  movements: FinanceFxFields[],
  reportingCurrency: string
): FinanceCurrencyBreakdown {
  const reporting = reportingCurrency.toUpperCase();
  const buckets = new Map<string, FinanceCurrencyLine>();

  for (const mov of movements) {
    const currency = movementSourceCurrency(mov);
    const native = movementNativeAmount(mov);
    const converted = reportingAmountOf(mov, reporting);
    const line = buckets.get(currency) ?? emptyCurrencyLine(currency, reporting);
    line.nativeTotal += native;
    if (converted == null) {
      line.pendingNativeTotal += native;
      line.pendingCount += 1;
    } else {
      line.reportingTotal += converted;
    }
    buckets.set(currency, line);
  }

  const lines = sortCurrencyLines([...buckets.values()]);
  return {
    reportingCurrency: reporting,
    reportingTotal: lines.reduce((sum, line) => sum + line.reportingTotal, 0),
    pendingCount: lines.reduce((sum, line) => sum + line.pendingCount, 0),
    lines,
  };
}

/** Combina desgloses (ingresos +, gastos −) en la misma moneda de reporte. */
export function netCurrencyBreakdown(
  parts: Array<{ breakdown: FinanceCurrencyBreakdown; sign: 1 | -1 }>,
  reportingCurrency: string
): FinanceCurrencyBreakdown {
  const reporting = reportingCurrency.toUpperCase();
  const buckets = new Map<string, FinanceCurrencyLine>();

  for (const part of parts) {
    for (const src of part.breakdown.lines) {
      const line =
        buckets.get(src.currency) ?? emptyCurrencyLine(src.currency, reporting);
      line.nativeTotal += part.sign * src.nativeTotal;
      line.reportingTotal += part.sign * src.reportingTotal;
      line.pendingNativeTotal += src.pendingNativeTotal;
      line.pendingCount += src.pendingCount;
      buckets.set(src.currency, line);
    }
  }

  const lines = sortCurrencyLines([...buckets.values()]).filter(
    line =>
      line.nativeTotal !== 0 ||
      line.reportingTotal !== 0 ||
      line.pendingCount > 0
  );
  return {
    reportingCurrency: reporting,
    reportingTotal: lines.reduce((sum, line) => sum + line.reportingTotal, 0),
    pendingCount: lines.reduce((sum, line) => sum + line.pendingCount, 0),
    lines,
  };
}

export function summarizeMovementsByCurrency(
  movements: FinanceMovement[],
  monthId: string,
  reportingCurrency?: string
): Record<string, FinanceMovementMonthSummary> {
  const out: Record<string, FinanceMovementMonthSummary> = {};
  for (const mov of movements) {
    if (!mov.dayId.startsWith(monthId)) continue;
    if (mov.flow === 'investment') continue;
    if (mov.status === 'skipped') continue;
    if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') continue;
    const converted = reportingCurrency
      ? reportingAmountOf(mov, reportingCurrency)
      : mov.amount;
    if (converted == null) continue;
    const currency = reportingCurrency || mov.currency || 'EUR';
    const bucket = out[currency] ?? {
      monthId,
      currency,
      confirmedIncome: 0,
      confirmedExpense: 0,
      plannedIncome: 0,
      plannedExpense: 0,
      balance: 0,
    };
    const amount = converted;
    if (mov.status === 'confirmed') {
      if (mov.flow === 'income') bucket.confirmedIncome += amount;
      else bucket.confirmedExpense += amount;
    } else {
      if (mov.flow === 'income') bucket.plannedIncome += amount;
      else bucket.plannedExpense += amount;
    }
    bucket.balance = bucket.confirmedIncome - bucket.confirmedExpense;
    out[currency] = bucket;
  }
  return out;
}
