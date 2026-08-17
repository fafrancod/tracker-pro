import { Router } from 'express';
import { z } from 'zod';
import { isSupportedCurrency, normalizeCurrencyCode } from '@daily-tracker/core';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';

export const financeFxRouter = Router();

financeFxRouter.use(requireAuth);
financeFxRouter.use(rateLimit({ windowMs: 60_000, max: 40 }));

const querySchema = z.object({
  from: z.string().min(3).max(8),
  to: z.string().min(3).max(8),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const cache = new Map<string, { at: number; rate: number; date: string }>();
const CACHE_MS = 60 * 60 * 1000;

function cacheKey(from: string, to: string, date: string): string {
  return `${from}_${to}_${date}`;
}

export async function lookupExchangeRate(
  from: string,
  to: string,
  date?: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ from: string; to: string; rate: number; date: string }> {
  const base = normalizeCurrencyCode(from, '');
  const quote = normalizeCurrencyCode(to, '');
  if (!isSupportedCurrency(base) || !isSupportedCurrency(quote)) {
    throw ApiError.badRequest('Moneda no soportada');
  }
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'latest';
  if (base === quote) {
    return {
      from: base,
      to: quote,
      rate: 1,
      date: day === 'latest' ? new Date().toISOString().slice(0, 10) : day,
    };
  }
  const key = cacheKey(base, quote, day);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { from: base, to: quote, rate: hit.rate, date: hit.date };
  }

  const frankfurter =
    day === 'latest'
      ? `https://api.frankfurter.app/latest?from=${base}&to=${quote}`
      : `https://api.frankfurter.app/${day}?from=${base}&to=${quote}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetchImpl(frankfurter, { signal: controller.signal });
    if (res.ok) {
      const json = (await res.json()) as {
        date?: string;
        rates?: Record<string, number>;
      };
      const rate = Number(json.rates?.[quote]);
      if (Number.isFinite(rate) && rate > 0) {
        const asOf = json.date || (day === 'latest' ? new Date().toISOString().slice(0, 10) : day);
        cache.set(key, { at: Date.now(), rate, date: asOf });
        return { from: base, to: quote, rate, date: asOf };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const fallbackCtl = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackCtl.abort(), 8000);
  try {
    const res = await fetchImpl(`https://open.er-api.com/v6/latest/${base}`, {
      signal: fallbackCtl.signal,
    });
    if (!res.ok) throw new Error('fx upstream');
    const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
    const rate = Number(json.rates?.[quote]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('fx rate');
    const asOf = new Date().toISOString().slice(0, 10);
    cache.set(key, { at: Date.now(), rate, date: asOf });
    return { from: base, to: quote, rate, date: asOf };
  } finally {
    clearTimeout(fallbackTimer);
  }
}

financeFxRouter.get('/fx', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse({
      from: req.query.from,
      to: req.query.to,
      date: req.query.date,
    });
    if (!parsed.success) {
      throw ApiError.badRequest('from y to son obligatorios (ISO 4217)');
    }
    try {
      const quote = await lookupExchangeRate(
        parsed.data.from,
        parsed.data.to,
        parsed.data.date
      );
      res.json(quote);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'No se pudo obtener el tipo de cambio', 'fx_unavailable');
    }
  } catch (err) {
    next(err);
  }
});
