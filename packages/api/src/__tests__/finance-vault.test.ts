import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createFinanceVault,
  decryptFinancePayload,
  encryptFinancePayload,
  financePayloadAad,
  generateRecoveryPhrase,
  parseFinancePayload,
  unlockFinanceVault,
} from '@daily-tracker/core';
import { inferVaultScheme } from '../lib/financeEnvelope.js';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let vaultRow: Record<string, unknown> | null = null;
let lastMovementInsert: Record<string, unknown> | null = null;

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_vault') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {
            eq: vi.fn(() => c),
            maybeSingle: vi.fn(async () => ({ data: vaultRow, error: null })),
          };
          return c;
        }),
        upsert: vi.fn(async (row: Record<string, unknown>) => {
          vaultRow = { ...(vaultRow ?? {}), ...row };
          return { data: null, error: null };
        }),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.not = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    if (table === 'finance_movements') {
      return {
        insert: vi.fn(async (row: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(row) ? row : [row];
          lastMovementInsert = list[0] ?? null;
          return { data: null, error: null };
        }),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.not = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    if (table === 'finance_rules') {
      return {
        insert: vi.fn(async () => ({ data: null, error: null })),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.not = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    const c: Record<string, unknown> = {};
    c.eq = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    return { select: vi.fn(() => c) };
  });
}

beforeEach(() => {
  vaultRow = null;
  lastMovementInsert = null;
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'test-uid', email: 'test@example.com', app_metadata: {} },
        },
        error: null,
      })),
    },
    from: buildFromMock(),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});

describe('finance vault crypto', () => {
  it('cifra y descifra un payload con la frase', async () => {
    const uid = 'test-uid';
    const recovery = generateRecoveryPhrase();
    const { meta, dek } = await createFinanceVault(uid, 'frase-secreta-larga', recovery);
    const aad = financePayloadAad(uid, 'finance_movements', 'mov-1');
    const blob = await encryptFinancePayload(
      dek,
      { title: 'Café', amount: 2800, notes: '', certainty: 'fixed' },
      aad
    );
    const opened = await unlockFinanceVault(uid, meta, 'frase-secreta-larga', 'passphrase');
    const plain = await decryptFinancePayload<{ title: string; amount: number }>(
      opened,
      blob,
      aad
    );
    expect(plain.title).toBe('Café');
    expect(plain.amount).toBe(2800);
    expect(blob.includes('2800')).toBe(false);
  });

  it('recupera la DEK con las 12 palabras', async () => {
    const uid = 'test-uid';
    const recovery = generateRecoveryPhrase();
    const { meta } = await createFinanceVault(uid, 'frase-a', recovery);
    const dek = await unlockFinanceVault(uid, meta, recovery, 'recovery');
    expect(dek.type).toBe('secret');
  });
});

describe('API vault + movements ciegos', () => {
  it('GET vault vacío → enabled false', async () => {
    const res = await request(app)
      .get('/api/finances/vault')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.scheme).toBe('none');
  });

  it('POST en claro sin bóveda privada cifra en servidor (sobre de cuenta)', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Café',
        amount: 2800,
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Café');
    expect(res.body.amount).toBe(2800);
    expect(res.body.sealed).toBe(false);
    expect(lastMovementInsert?.payload).toEqual({});
    expect(String(lastMovementInsert?.payload_enc ?? '')).not.toContain('2800');
    expect(lastMovementInsert?.enc_v).toBe('2');
  });

  it('POST /vault/reset deja scheme account', async () => {
    vaultRow = {
      user_id: 'test-uid',
      scheme: 'private',
      wrapped_dek: 'd3JhcHBlZC1kZWstdmFsaWRvLTEyMzQ1Ng==',
    };
    const res = await request(app)
      .post('/api/finances/vault/reset')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.scheme).toBe('account');
    expect(res.body.wiped).toBe(true);
    expect(vaultRow?.scheme).toBe('account');
    expect(vaultRow?.wrapped_dek).toBeNull();
  });

  it('fila private residual no bloquea: GET y POST pasan a account', async () => {
    vaultRow = {
      user_id: 'test-uid',
      scheme: 'private',
      kdf_salt: 'YWFhYWFhYWFhYWFhYWFhYQ==',
      wrapped_dek: 'd3JhcHBlZC1kZWstdmFsaWRvLTEyMzQ1Ng==',
    };
    const get = await request(app)
      .get('/api/finances/vault')
      .set('Authorization', 'Bearer valid-token');
    expect(get.status).toBe(200);
    expect(get.body.enabled).toBe(false);
    expect(get.body.scheme).toBe('account');
    expect(vaultRow?.scheme).toBe('account');
    expect(vaultRow?.wrapped_dek).toBeNull();

    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Café',
        amount: 2800,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Café');
  });

  it('wrapped_dek vacío no es bóveda privada', () => {
    expect(inferVaultScheme({ scheme: null, wrapped_dek: '' })).toBe('none');
    expect(
      inferVaultScheme({ scheme: 'account', account_wrapped_dek: 'abc' })
    ).toBe('account');
    expect(
      inferVaultScheme({
        scheme: 'private',
        wrapped_dek: 'd3JhcHBlZC1kZWstdmFsaWRvLTEyMzQ1Ng==',
      })
    ).toBe('private');
  });

  it('POST vaulted con payloadEnc guarda blob y payload vacío', async () => {
    vaultRow = { user_id: 'test-uid' };
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        id: 'client-mov-001',
        dayId: '2026-08-17',
        flow: 'expense',
        payloadEnc: 'ZW5jcnlwdGVkLXBheWxvYWQtZmFrZS0xMjM0NTY=',
      });
    expect(res.status).toBe(201);
    expect(lastMovementInsert?.payload).toEqual({});
    expect(lastMovementInsert?.payload_enc).toBeTruthy();
    expect(res.body.sealed).toBe(true);
    expect(res.body.title).toBe('');
  });
});

describe('parseFinancePayload no filtra blobs', () => {
  it('objeto vacío es payload vacío', () => {
    expect(parseFinancePayload({}).title).toBe('');
    expect(parseFinancePayload({}).amount).toBe(0);
  });
});
