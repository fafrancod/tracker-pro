import type { FinanceMovement } from './types';

/** Convierte el importe a la moneda de reporte. null = pendiente de tipo. */
export function reportingAmountOf(
  mov: Pick<
    FinanceMovement,
    'amount' | 'currency' | 'exchangeRate' | 'fxPending' | 'originalCurrency'
  >,
  reportingCurrency: string
): number | null {
  const amount = Number(mov.amount);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const from = (mov.originalCurrency || mov.currency || '').toUpperCase();
  const to = reportingCurrency.toUpperCase();
  if (!from || from === to) return amount;
  if (mov.fxPending) return null;
  const rate = mov.exchangeRate;
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    return amount * rate;
  }
  return null;
}
