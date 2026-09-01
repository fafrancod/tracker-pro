import { describe, expect, it } from 'vitest';
import { redactPii } from '../lib/redactPii.js';

describe('redactPii', () => {
  it('redacta amount, password, token y anonKey anidados', () => {
    expect(
      redactPii({
        amount: 12.5,
        nested: { password: 'x', token: 't', anonKey: 'k', keep: 1 },
        ok: 'visible',
      })
    ).toEqual({
      amount: '[redacted]',
      nested: { password: '[redacted]', token: '[redacted]', anonKey: '[redacted]', keep: 1 },
      ok: 'visible',
    });
  });

  it('es case-insensitive y recorre arrays', () => {
    expect(
      redactPii({
        Amount: 1,
        items: [{ PASSWORD: 'p', field: 'ok' }],
      })
    ).toEqual({
      Amount: '[redacted]',
      items: [{ PASSWORD: '[redacted]', field: 'ok' }],
    });
  });

  it('no muta el original', () => {
    const input = { amount: 9, ok: true };
    const out = redactPii(input);
    expect(out).not.toBe(input);
    expect(input.amount).toBe(9);
    expect(out).toEqual({ amount: '[redacted]', ok: true });
  });

  it('deja primitivos y null intactos', () => {
    expect(redactPii(null)).toBeNull();
    expect(redactPii('token')).toBe('token');
    expect(redactPii(3)).toBe(3);
  });
});
