import { useEffect, useMemo, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { ApiClientError } from '@core/lib/api';
import {
  createFinanceMovement,
  fetchInvestmentQuotes,
  searchInvestmentTickers,
  updateFinanceMovement,
} from '@core/services/financeMovementService';
import {
  buildLotSale,
  groupOpenLots,
  type TickerQuote,
  type TickerSearchHit,
} from '@core/lib/finance';
import type { FinanceAccount, FinanceMovement } from '@core/lib/finance';
import { SUPPORTED_CURRENCIES } from '@core/lib/currencies';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function InvestmentsPanel({
  movements,
  accounts,
  todayDayId,
  defaultCurrency,
  onChanged,
}: {
  movements: FinanceMovement[];
  accounts: FinanceAccount[];
  todayDayId: string;
  defaultCurrency: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const holdings = useMemo(() => groupOpenLots(movements), [movements]);
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});
  const [quotesError, setQuotesError] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<TickerSearchHit[]>([]);
  const [sellLot, setSellLot] = useState<FinanceMovement | null>(null);
  const [proceeds, setProceeds] = useState(0);
  const [sellDayId, setSellDayId] = useState(todayDayId);
  const [form, setForm] = useState({
    dayId: todayDayId,
    ticker: '',
    assetName: '',
    quantity: 1,
    investedAmount: 0,
    currency: defaultCurrency,
    accountId: '',
  });

  const tickerKey = holdings.map(h => h.ticker).join(',');
  useEffect(() => {
    if (!tickerKey) {
      setQuotes({});
      setQuotesError(false);
      return;
    }
    let cancelled = false;
    fetchInvestmentQuotes(holdings.map(h => h.ticker))
      .then(list => {
        if (cancelled) return;
        const map: Record<string, TickerQuote> = {};
        for (const q of list) map[q.symbol.toUpperCase()] = q;
        setQuotes(map);
        setQuotesError(list.length === 0);
      })
      .catch(() => {
        if (!cancelled) {
          setQuotes({});
          setQuotesError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tickerKey]);

  async function onTickerChange(value: string) {
    const ticker = value.toUpperCase();
    setForm(f => ({ ...f, ticker }));
    if (ticker.trim().length < 1) {
      setHits([]);
      return;
    }
    const next = await searchInvestmentTickers(ticker.trim());
    setHits(next);
  }

  function pickHit(hit: TickerSearchHit) {
    setForm(f => ({
      ...f,
      ticker: hit.symbol,
      assetName: hit.name,
    }));
    setHits([]);
  }

  function openBuy() {
    setForm({
      dayId: todayDayId,
      ticker: '',
      assetName: '',
      quantity: 1,
      investedAmount: 0,
      currency: defaultCurrency,
      accountId: '',
    });
    setHits([]);
    setBuyOpen(true);
  }

  async function handleBuy() {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) {
      showToast(t('fin_invest_ticker_required'), 'error');
      return;
    }
    if (!(form.investedAmount > 0) || !(form.quantity > 0)) {
      showToast(t('fin_amount_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      await createFinanceMovement({
        dayId: form.dayId,
        flow: 'investment',
        status: 'confirmed',
        currency: form.currency,
        title: form.assetName.trim() || ticker,
        amount: form.investedAmount,
        accountId: form.accountId || null,
        investmentSide: 'buy',
        ticker,
        assetName: form.assetName.trim() || ticker,
        quantity: form.quantity,
        investedAmount: form.investedAmount,
        investmentStatus: 'open',
        category: 'invest',
      });
      showToast(t('fin_created'), 'success');
      setBuyOpen(false);
      await onChanged();
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST|finance_/i.test(err.message)
          ? t('fin_sql_needed')
          : t('fin_save_error');
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSell() {
    if (!sellLot) return;
    if (!(proceeds >= 0)) {
      showToast(t('fin_amount_required'), 'error');
      return;
    }
    setBusy(true);
    try {
      const { closePatch, sale } = buildLotSale({
        lot: sellLot,
        dayId: sellDayId,
        proceeds,
      });
      await updateFinanceMovement(sellLot.id, closePatch);
      try {
        await createFinanceMovement(sale);
      } catch (err) {
        await updateFinanceMovement(sellLot.id, {
          ...closePatch,
          investmentStatus: 'open',
        });
        throw err;
      }
      showToast(t('fin_invest_sold'), 'success');
      setSellLot(null);
      await onChanged();
    } catch {
      showToast(t('fin_save_error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openBuy}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('fin_invest_add')}
        </Button>
      </div>
      {holdings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <TrendingUp className="h-5 w-5 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {t('fin_invest_empty')}
          </p>
          <p className="max-w-sm text-xs text-text-muted">
            {t('fin_invest_empty_hint')}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {holdings.map(holding => {
            const quote = quotes[holding.ticker];
            const market =
              quote?.price != null ? quote.price * holding.quantity : null;
            const gain =
              market != null ? market - holding.investedAmount : null;
            return (
              <li
                key={holding.ticker}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {holding.ticker}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {holding.name}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {t('fin_invest_lots').replace(
                      '{n}',
                      String(holding.lots.length)
                    )}
                  </span>
                </div>
                <p className="text-xs tabular-nums text-text-primary">
                  {holding.quantity} · {money(holding.investedAmount, holding.currency)}
                </p>
                {market != null ? (
                  <p className="text-[11px] tabular-nums text-text-muted">
                    {t('fin_invest_value')}: {money(market, quote?.currency || holding.currency)}
                    {gain != null
                      ? ` · ${gain >= 0 ? '+' : ''}${money(gain, holding.currency)}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-[11px] text-text-muted">
                    {quotesError || !quote
                      ? t('fin_invest_no_quote')
                      : t('fin_invest_no_quote')}
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {holding.lots.map(lot => (
                    <li
                      key={lot.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-background px-2 py-1"
                    >
                      <span className="text-[11px] text-text-muted">
                        {lot.dayId} · {lotQuantityLabel(lot)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setSellLot(lot);
                          setSellDayId(todayDayId);
                          setProceeds(lotCostSafe(lot));
                        }}
                      >
                        {t('fin_invest_sell')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('fin_invest_add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_invest_ticker')}</span>
              <Input
                value={form.ticker}
                onChange={e => void onTickerChange(e.target.value)}
                className="h-9 text-sm uppercase"
                placeholder="AAPL"
              />
              {hits.length > 0 && (
                <ul className="max-h-32 overflow-auto rounded-md border border-border bg-background">
                  {hits.map(hit => (
                    <li key={`${hit.symbol}-${hit.exchange}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs"
                        onClick={() => pickHit(hit)}
                      >
                        <span className="font-medium text-text-primary">
                          {hit.symbol}
                        </span>
                        <span className="truncate pl-2 text-text-muted">
                          {hit.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_invest_name')}</span>
              <Input
                value={form.assetName}
                onChange={e => setForm(f => ({ ...f, assetName: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_invest_qty')}</span>
                <DecimalInput
                  value={form.quantity}
                  onChange={v => setForm(f => ({ ...f, quantity: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_invest_cost')}</span>
                <DecimalInput
                  value={form.investedAmount}
                  onChange={v => setForm(f => ({ ...f, investedAmount: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_date')}</span>
                <Input
                  type="date"
                  value={form.dayId}
                  onChange={e => setForm(f => ({ ...f, dayId: e.target.value }))}
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_currency')}</span>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {accounts.length > 0 && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_account')}</span>
                <select
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">{t('fin_account_all')}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.type}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBuyOpen(false)}
              >
                {t('action_cancel')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleBuy()}>
                {t('action_save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sellLot)} onOpenChange={open => !open && setSellLot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('fin_invest_sell_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-primary">
              {sellLot?.ticker} · {sellLot ? lotQuantityLabel(sellLot) : ''}
            </p>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_invest_proceeds')}</span>
              <DecimalInput
                value={proceeds}
                onChange={setProceeds}
                min={0}
                max={1_000_000_000}
                className="h-9 text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_date')}</span>
              <Input
                type="date"
                value={sellDayId}
                onChange={e => setSellDayId(e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setSellLot(null)}>
                {t('action_cancel')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleSell()}>
                {t('fin_invest_sell')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function lotQuantityLabel(lot: FinanceMovement): string {
  const qty = Number(lot.quantity);
  return Number.isFinite(qty) && qty > 0 ? String(qty) : '—';
}

function lotCostSafe(lot: FinanceMovement): number {
  const invested = Number(lot.investedAmount);
  if (Number.isFinite(invested) && invested > 0) return invested;
  return Number(lot.amount) || 0;
}
