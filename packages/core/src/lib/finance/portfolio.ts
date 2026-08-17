import type {
  CreateFinanceMovementPayload,
  FinanceMovement,
  UpdateFinanceMovementPayload,
} from './types';

export interface InvestmentHolding {
  ticker: string;
  name: string;
  quantity: number;
  investedAmount: number;
  currency: string;
  lots: FinanceMovement[];
}

export function isOpenInvestmentLot(mov: FinanceMovement): boolean {
  if (mov.flow !== 'investment') return false;
  if (mov.status === 'skipped') return false;
  if (mov.investmentSide === 'sell') return false;
  if (mov.investmentStatus === 'sold') return false;
  return true;
}

export function lotCost(mov: FinanceMovement): number {
  const invested = Number(mov.investedAmount);
  if (Number.isFinite(invested) && invested > 0) return invested;
  const amount = Number(mov.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function lotQuantity(mov: FinanceMovement): number {
  const qty = Number(mov.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

/** Agrupa compras abiertas por ticker. 2 lots del mismo símbolo = 1 holding. */
export function groupOpenLots(movements: FinanceMovement[]): InvestmentHolding[] {
  const byTicker = new Map<string, InvestmentHolding>();
  for (const mov of movements) {
    if (!isOpenInvestmentLot(mov)) continue;
    const ticker = (mov.ticker || '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = lotQuantity(mov);
    const cost = lotCost(mov);
    const existing = byTicker.get(ticker);
    if (existing) {
      existing.quantity += qty;
      existing.investedAmount += cost;
      existing.lots.push(mov);
    } else {
      byTicker.set(ticker, {
        ticker,
        name: (mov.assetName || mov.title || ticker).trim() || ticker,
        quantity: qty,
        investedAmount: cost,
        currency: mov.currency || 'EUR',
        lots: [mov],
      });
    }
  }
  return [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function buildLotSale(opts: {
  lot: FinanceMovement;
  dayId: string;
  proceeds: number;
  currency?: string;
}): {
  closePatch: UpdateFinanceMovementPayload;
  sale: CreateFinanceMovementPayload;
} {
  const ticker = (opts.lot.ticker || '').trim().toUpperCase();
  const proceeds = Number.isFinite(opts.proceeds) && opts.proceeds >= 0 ? opts.proceeds : 0;
  const currency = opts.currency || opts.lot.currency;
  const title = ticker ? `Venta ${ticker}` : opts.lot.title || 'Venta';
  return {
    closePatch: {
      title: opts.lot.title,
      amount: opts.lot.amount,
      notes: opts.lot.notes,
      certainty: opts.lot.certainty,
      investmentSide: opts.lot.investmentSide ?? 'buy',
      ticker: opts.lot.ticker,
      assetName: opts.lot.assetName,
      quantity: opts.lot.quantity,
      investedAmount: opts.lot.investedAmount ?? opts.lot.amount,
      investmentStatus: 'sold',
      closesLotId: opts.lot.closesLotId,
    },
    sale: {
      dayId: opts.dayId,
      flow: 'investment',
      status: 'confirmed',
      currency,
      title,
      amount: proceeds,
      notes: '',
      accountId: opts.lot.accountId,
      investmentSide: 'sell',
      ticker: opts.lot.ticker,
      assetName: opts.lot.assetName,
      quantity: opts.lot.quantity,
      investedAmount: proceeds,
      investmentStatus: 'sold',
      closesLotId: opts.lot.id,
    },
  };
}

export interface TickerQuote {
  symbol: string;
  name: string;
  price: number | null;
  currency: string | null;
  changePercent: number | null;
}

export interface TickerSearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}
