import type { FinanceMovement } from './types';

export type FinanceFxRequest = {
  amount: number;
  currency: string;
  reportingCurrency: string;
  dayId: string;
};

export type FinanceFxResolution = {
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number | null;
  fxPending: boolean;
  reportingCurrency: string;
};

export type FinanceFxRateLookup = (
  from: string,
  to: string,
  dayId: string
) => Promise<number>;

type FinanceFxQuote = {
  key: string;
  from: string;
  to: string;
  dayId: string;
};

function fxQuoteKey(from: string, to: string, dayId: string): string {
  return `${from.toUpperCase()}|${to.toUpperCase()}|${dayId}`;
}

/**
 * Resuelve cotizaciones de movimientos sin repetir la misma moneda/fecha y sin
 * inundar el API. Los errores quedan explícitamente pendientes para conservar
 * el movimiento y permitir un reintento posterior.
 */
export async function resolveFinanceFxRequests(
  requests: FinanceFxRequest[],
  lookupRate: FinanceFxRateLookup,
  maxConcurrent = 4
): Promise<FinanceFxResolution[]> {
  const quotes = new Map<string, FinanceFxQuote>();
  for (const request of requests) {
    const from = request.currency.toUpperCase();
    const to = request.reportingCurrency.toUpperCase();
    if (!from || !to || from === to) continue;
    const key = fxQuoteKey(from, to, request.dayId);
    if (!quotes.has(key)) quotes.set(key, { key, from, to, dayId: request.dayId });
  }

  const quoteList = [...quotes.values()];
  const rates = new Map<string, number | null>();
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, Math.floor(maxConcurrent)), quoteList.length) },
    async () => {
      while (nextIndex < quoteList.length) {
        const quote = quoteList[nextIndex++];
        try {
          rates.set(quote.key, await lookupRate(quote.from, quote.to, quote.dayId));
        } catch {
          rates.set(quote.key, null);
        }
      }
    }
  );
  await Promise.all(workers);

  return requests.map(request => {
    const originalAmount = request.amount;
    const originalCurrency = request.currency;
    const reportingCurrency = request.reportingCurrency;
    const from = originalCurrency.toUpperCase();
    const to = reportingCurrency.toUpperCase();
    if (from === to) {
      return {
        originalAmount,
        originalCurrency,
        exchangeRate: 1,
        fxPending: false,
        reportingCurrency,
      };
    }
    const rate = rates.get(fxQuoteKey(from, to, request.dayId)) ?? null;
    return {
      originalAmount,
      originalCurrency,
      exchangeRate: rate,
      fxPending: rate === null,
      reportingCurrency,
    };
  });
}

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
