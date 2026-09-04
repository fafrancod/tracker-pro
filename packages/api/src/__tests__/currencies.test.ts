import { describe, expect, it } from 'vitest';
import {
  defaultCurrencyFromTimezone,
  groupCurrenciesForPicker,
  leftoverImplicitEurReplacement,
  resolveDefaultCurrency,
  toggleFavoriteCurrency,
} from '@daily-tracker/core';

describe('defaultCurrencyFromTimezone', () => {
  it('infiere CLP en Chile', () => {
    expect(defaultCurrencyFromTimezone('America/Santiago')).toBe('CLP');
    expect(defaultCurrencyFromTimezone('America/Punta_Arenas')).toBe('CLP');
  });

  it('infiere EUR en la eurozona y GBP en Londres', () => {
    expect(defaultCurrencyFromTimezone('Europe/Madrid')).toBe('EUR');
    expect(defaultCurrencyFromTimezone('Europe/Paris')).toBe('EUR');
    expect(defaultCurrencyFromTimezone('Europe/London')).toBe('GBP');
  });

  it('no inventa moneda para UTC', () => {
    expect(defaultCurrencyFromTimezone('UTC')).toBeNull();
    expect(defaultCurrencyFromTimezone('')).toBeNull();
    expect(defaultCurrencyFromTimezone(null)).toBeNull();
  });
});

describe('resolveDefaultCurrency', () => {
  it('respeta la moneda guardada si es válida', () => {
    expect(
      resolveDefaultCurrency({
        stored: 'USD',
        timezone: 'America/Santiago',
        locale: 'es-CL',
      })
    ).toBe('USD');
  });

  it('usa la zona horaria cuando no hay preferencia', () => {
    expect(
      resolveDefaultCurrency({
        stored: null,
        timezone: 'America/Santiago',
        locale: 'es',
      })
    ).toBe('CLP');
  });

  it('cae a locale y por último a EUR', () => {
    expect(
      resolveDefaultCurrency({ stored: null, timezone: 'UTC', locale: 'es-CL' })
    ).toBe('CLP');
    expect(
      resolveDefaultCurrency({ stored: null, timezone: 'UTC', locale: 'es' })
    ).toBe('EUR');
  });
});

describe('leftoverImplicitEurReplacement', () => {
  it('reemplaza el EUR implícito de bootstrap si la zona no es euro', () => {
    expect(
      leftoverImplicitEurReplacement('EUR', 'America/Santiago')
    ).toBe('CLP');
    expect(
      leftoverImplicitEurReplacement(undefined, 'America/Santiago')
    ).toBe('CLP');
  });

  it('no toca una moneda elegida ni el EUR real de Europa', () => {
    expect(leftoverImplicitEurReplacement('USD', 'America/Santiago')).toBeNull();
    expect(leftoverImplicitEurReplacement('CLP', 'America/Santiago')).toBeNull();
    expect(leftoverImplicitEurReplacement('EUR', 'Europe/Madrid')).toBeNull();
  });
});

describe('favorite currencies', () => {
  it('alterna y normaliza favoritas', () => {
    expect(toggleFavoriteCurrency([], 'usd')).toEqual(['USD']);
    expect(toggleFavoriteCurrency(['USD'], 'USD')).toEqual([]);
    expect(toggleFavoriteCurrency(['USD'], 'EUR')).toEqual(['USD', 'EUR']);
    expect(toggleFavoriteCurrency(['USD', 'NOPE'], 'CLP')).toEqual([
      'USD',
      'CLP',
    ]);
  });

  it('pone la principal primero y las favoritas debajo, sin duplicar', () => {
    const groups = groupCurrenciesForPicker({
      preferred: 'CLP',
      favorites: ['USD', 'CLP', 'EUR'],
    });
    expect(groups.primary.code).toBe('CLP');
    expect(groups.favorites.map(c => c.code)).toEqual(['USD', 'EUR']);
    expect(groups.others.map(c => c.code)).not.toContain('CLP');
    expect(groups.others.map(c => c.code)).not.toContain('USD');
    expect(groups.others[0]?.code).toBeDefined();
  });
});
