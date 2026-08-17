import { Router } from 'express';
import { z } from 'zod';
import type { TickerQuote, TickerSearchHit } from '@daily-tracker/core';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const financeInvestmentsRouter = Router();

financeInvestmentsRouter.use(requireAuth);
financeInvestmentsRouter.use(rateLimit({ windowMs: 60_000, max: 40 }));

export const INVESTMENT_QUOTE_FIXTURES: Record<string, TickerQuote> = {
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc',
    price: 190.5,
    currency: 'USD',
    changePercent: 0.4,
  },
  SPY: {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    price: 520,
    currency: 'USD',
    changePercent: 0.1,
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corp',
    price: 420,
    currency: 'USD',
    changePercent: -0.2,
  },
};

const quoteCache = new Map<string, { at: number; quotes: TickerQuote[] }>();
const CACHE_MS = 15 * 60 * 1000;

function normalizeSymbols(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ''))
    .filter(Boolean)
    .slice(0, 20);
}

export function searchInvestmentFixtures(query: string): TickerSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.values(INVESTMENT_QUOTE_FIXTURES)
    .filter(
      row =>
        row.symbol.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q)
    )
    .map(row => ({
      symbol: row.symbol,
      name: row.name,
      exchange: 'NASDAQ',
      type: 'Common Stock',
    }));
}

export async function lookupInvestmentQuotes(
  symbols: string[],
  fetchImpl?: typeof fetch
): Promise<TickerQuote[]> {
  const list = [...new Set(normalizeSymbols(symbols.join(',')))];
  if (list.length === 0) return [];

  const useFixtures = process.env.NODE_ENV === 'test' || !process.env.TWELVE_DATA_API_KEY;
  if (useFixtures && !fetchImpl) {
    return list
      .map(symbol => INVESTMENT_QUOTE_FIXTURES[symbol])
      .filter((row): row is TickerQuote => Boolean(row));
  }

  const key = list.slice().sort().join(',');
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.quotes;

  const apiKey = process.env.TWELVE_DATA_API_KEY ?? '';
  if (!apiKey && !fetchImpl) return [];

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(key)}${
    apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : ''
  }`;
  const doFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await doFetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as
      | Record<string, unknown>
      | { status?: string; symbol?: string; name?: string; close?: string; currency?: string; percent_change?: string };
    if (json && (json as { status?: string }).status === 'error') return [];
    const rows: Record<string, unknown>[] =
      list.length === 1
        ? [json as Record<string, unknown>]
        : Object.values(json as Record<string, Record<string, unknown>>);
    const quotes: TickerQuote[] = rows
      .filter(row => row && typeof row.symbol === 'string')
      .map(row => ({
        symbol: String(row.symbol).toUpperCase(),
        name: typeof row.name === 'string' ? row.name : String(row.symbol),
        price:
          row.close != null && row.close !== '' && Number.isFinite(Number(row.close))
            ? Number(row.close)
            : null,
        currency: typeof row.currency === 'string' ? row.currency : null,
        changePercent:
          row.percent_change != null && Number.isFinite(Number(row.percent_change))
            ? Number(row.percent_change)
            : null,
      }));
    quoteCache.set(key, { at: Date.now(), quotes });
    return quotes;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const searchSchema = z.object({
  q: z.string().max(40).optional(),
});

const quoteSchema = z.object({
  symbols: z.string().max(200).optional(),
});

financeInvestmentsRouter.get('/investments/search', async (req, res, next) => {
  try {
    const parsed = searchSchema.safeParse({ q: req.query.q });
    const q = parsed.success ? (parsed.data.q ?? '').trim() : '';
    if (q.length < 1) {
      res.json({ results: [] });
      return;
    }
    if (process.env.NODE_ENV === 'test' || !process.env.TWELVE_DATA_API_KEY) {
      res.json({ results: searchInvestmentFixtures(q) });
      return;
    }
    try {
      const apiKey = process.env.TWELVE_DATA_API_KEY ?? '';
      const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=10&apikey=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const upstream = await fetch(url, { signal: controller.signal });
        if (!upstream.ok) {
          res.json({ results: searchInvestmentFixtures(q) });
          return;
        }
        const json = (await upstream.json()) as { data?: Array<Record<string, unknown>> };
        const rows = Array.isArray(json.data) ? json.data : [];
        res.json({
          results: rows.map(row => ({
            symbol: String(row.symbol ?? ''),
            name: String(row.instrument_name ?? row.symbol ?? ''),
            exchange: String(row.exchange ?? row.mic_code ?? ''),
            type: String(row.instrument_type ?? ''),
          })),
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      res.json({ results: searchInvestmentFixtures(q) });
    }
  } catch (err) {
    next(err);
  }
});

financeInvestmentsRouter.get('/investments/quote', async (req, res, next) => {
  try {
    const parsed = quoteSchema.safeParse({ symbols: req.query.symbols });
    const symbols = parsed.success ? parsed.data.symbols ?? '' : '';
    const quotes = await lookupInvestmentQuotes(normalizeSymbols(symbols));
    res.json({ quotes });
  } catch (err) {
    next(err);
  }
});
