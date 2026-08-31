import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import {
  reportingAmountOf,
  summarizeCurrencyBreakdown,
  netCurrencyBreakdown,
  summarizeMovementsByCurrency,
} from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { lookupExchangeRate } from '../routes/financeFx.js';

const app = buildApp();

describe('lookupExchangeRate', () => {
  it('misma moneda → 1', async () => {
    const q = await lookupExchangeRate('CLP', 'clp');
    expect(q.rate).toBe(1);
  });

  it('usa el JSON del proveedor (sin red real)', async () => {
    const fake = vi.fn(async (input: string | URL) => {
      void input;
      return new Response(JSON.stringify({ date: '2026-08-10', rates: { CLP: 950 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const q = await lookupExchangeRate(
      'USD',
      'CLP',
      '2026-08-10',
      fake as unknown as typeof fetch
    );
    expect(q.rate).toBe(950);
    expect(q.date).toBe('2026-08-10');
    expect(String(fake.mock.calls[0]?.[0])).toContain('frankfurter');
  });
});

describe('GET /api/finances/fx', () => {
  it('exige from y to', async () => {
    const res = await request(app)
      .get('/api/finances/fx')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(400);
  });

  it('misma moneda responde 1', async () => {
    const res = await request(app)
      .get('/api/finances/fx?from=USD&to=USD')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.rate).toBe(1);
  });

  it('moneda inválida → 400', async () => {
    const res = await request(app)
      .get('/api/finances/fx?from=XXX&to=CLP')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(400);
  });
});

describe('resumen en moneda de reporte', () => {
  const usd = {
    id: 'm1',
    dayId: '2026-08-10',
    flow: 'expense' as const,
    status: 'confirmed' as const,
    currency: 'USD',
    title: 'Hotel',
    amount: 10,
    notes: '',
    certainty: 'fixed' as const,
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: null,
    originalAmount: 10,
    originalCurrency: 'USD',
    exchangeRate: 900,
    fxPending: false,
    reportingCurrency: 'CLP',
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
  };
  const clp = {
    ...usd,
    id: 'm2',
    dayId: '2026-08-11',
    currency: 'CLP',
    title: 'Café',
    amount: 1000,
    originalAmount: 1000,
    originalCurrency: 'CLP',
    exchangeRate: null,
    reportingCurrency: 'CLP',
  };
  const pending = {
    ...usd,
    id: 'm3',
    title: 'Taxi',
    amount: 20,
    originalAmount: 20,
    exchangeRate: null,
    fxPending: true,
  };

  it('USD + CLP cuadran en CLP', () => {
    expect(reportingAmountOf(usd, 'CLP')).toBe(9000);
    const sum = summarizeMovementsByCurrency([usd, clp], '2026-08', 'CLP');
    expect(sum.CLP.confirmedExpense).toBe(10_000);
    expect(Object.keys(sum)).toEqual(['CLP']);
  });

  it('pendiente de FX no entra al KPI (el movimiento no se pierde)', () => {
    expect(reportingAmountOf(pending, 'CLP')).toBeNull();
    const sum = summarizeMovementsByCurrency([usd, clp, pending], '2026-08', 'CLP');
    expect(sum.CLP.confirmedExpense).toBe(10_000);
  });
});

describe('desglose KPI por divisa original', () => {
  const usd = {
    amount: 10,
    currency: 'USD',
    originalAmount: 10,
    originalCurrency: 'USD',
    exchangeRate: 900,
    fxPending: false,
  };
  const clp = {
    amount: 1000,
    currency: 'CLP',
    originalAmount: 1000,
    originalCurrency: 'CLP',
    exchangeRate: null,
    fxPending: false,
  };
  const pending = {
    amount: 20,
    currency: 'USD',
    originalAmount: 20,
    originalCurrency: 'USD',
    exchangeRate: null,
    fxPending: true,
  };

  it('total de reporte = preferida + otras al tipo de cada transacción', () => {
    const breakdown = summarizeCurrencyBreakdown([usd, clp], 'CLP');
    expect(breakdown.reportingCurrency).toBe('CLP');
    expect(breakdown.reportingTotal).toBe(10_000);
    expect(breakdown.lines.map(l => l.currency)).toEqual(['CLP', 'USD']);
    expect(breakdown.lines[0]).toMatchObject({
      currency: 'CLP',
      nativeTotal: 1000,
      reportingTotal: 1000,
      isPreferred: true,
    });
    expect(breakdown.lines[1]).toMatchObject({
      currency: 'USD',
      nativeTotal: 10,
      reportingTotal: 9000,
      isPreferred: false,
    });
  });

  it('no usa un tipo en vivo: cada movimiento conserva su tipo del día', () => {
    const laterUsd = { ...usd, exchangeRate: 950 };
    const breakdown = summarizeCurrencyBreakdown([usd, laterUsd], 'CLP');
    expect(breakdown.reportingTotal).toBe(10 * 900 + 10 * 950);
    expect(breakdown.lines).toHaveLength(1);
    expect(breakdown.lines[0].nativeTotal).toBe(20);
  });

  it('FX pendiente queda en el detalle nativo y no infla el total preferido', () => {
    const breakdown = summarizeCurrencyBreakdown([usd, clp, pending], 'CLP');
    expect(breakdown.reportingTotal).toBe(10_000);
    expect(breakdown.pendingCount).toBe(1);
    const usdLine = breakdown.lines.find(l => l.currency === 'USD');
    expect(usdLine).toMatchObject({
      nativeTotal: 30,
      reportingTotal: 9000,
      pendingNativeTotal: 20,
      pendingCount: 1,
    });
  });

  it('el neto resta gastos en cada divisa y en el total preferido', () => {
    const income = summarizeCurrencyBreakdown([clp], 'CLP');
    const expense = summarizeCurrencyBreakdown([usd], 'CLP');
    const net = netCurrencyBreakdown(
      [
        { breakdown: income, sign: 1 },
        { breakdown: expense, sign: -1 },
      ],
      'CLP'
    );
    expect(net.reportingTotal).toBe(1000 - 9000);
    expect(net.lines[0]).toMatchObject({
      currency: 'CLP',
      nativeTotal: 1000,
      reportingTotal: 1000,
    });
    expect(net.lines[1]).toMatchObject({
      currency: 'USD',
      nativeTotal: -10,
      reportingTotal: -9000,
    });
  });
});
