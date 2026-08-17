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
          vaultRow = row;
          return { data: null, error: null };
        }),
      };
    }
    if (table === 'finance_movements') {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastMovementInsert = row;
          return { data: null, error: null };
        }),
      };
    }
    if (table === 'finance_rules') {
      return {
        insert: vi.fn(async () => ({ data: null, error: null })),
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
  });

  it('PUT vault y luego POST en claro → 400', async () => {
    const put = await request(app)
      .put('/api/finances/vault')
      .set('Authorization', 'Bearer valid-token')
      .send({
        kdfSalt: 'YWFhYWFhYWFhYWFhYWFhYQ==',
        kdfParams: { algo: 'PBKDF2', iterations: 210000, hash: 'SHA-256' },
        wrappedDek: 'd3JhcHBlZC1kZWstdmFsaWRvLTEyMzQ1Ng==',
        recoveryWrappedDek: 'cmVjb3ZlcnktZGVrLXZhbGlkby0xMjM0NTY=',
        encV: '1',
      });
    expect(put.status).toBe(201);

    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Café',
        amount: 2800,
      });
    expect(res.status).toBe(400);
    expect(lastMovementInsert).toBeNull();
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
