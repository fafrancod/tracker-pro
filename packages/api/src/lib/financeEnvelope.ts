import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const DEK_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const LOCAL_VERSION = 1;

export type FinanceVaultScheme = 'none' | 'account' | 'private';

export function isFinanceSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: unknown; code?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    code === '42P01' ||
    /schema cache|does not exist|Could not find the/i.test(message)
  );
}

/** Acepta base64 de 32 bytes o hex de 64 chars. */
export function parseFinanceMasterKey(raw: string): Buffer {
  const value = raw.trim().replace(/^['"]|['"]$/g, '');
  const fromB64 = Buffer.from(value, 'base64');
  if (fromB64.length === DEK_BYTES) return fromB64;
  const hex = value.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  throw new Error(
    `FINANCE_MASTER_KEY debe ser 32 bytes en base64 (ahora decodifica a ${fromB64.length} bytes). Genera una con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  );
}

function masterKey(): Buffer {
  const raw =
    process.env.FINANCE_MASTER_KEY?.trim() ||
    process.env.ENCRYPTION_LOCAL_MASTER_KEY?.trim();
  if (raw) return parseFinanceMasterKey(raw);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta FINANCE_MASTER_KEY en producción');
  }
  // Solo dev/test: mismo contrato que Meteora (envelope local, restablecible).
  return Buffer.from('MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=', 'base64');
}

function dekAad(uid: string): Buffer {
  return Buffer.from(`uid:${uid}:finance-dek`, 'utf8');
}

function payloadAad(uid: string, kind: string, id: string): Buffer {
  return Buffer.from(`uid:${uid}:${kind}:${id}`, 'utf8');
}

function encryptWithKey(key: Buffer, aad: Buffer, plaintext: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([LOCAL_VERSION]), iv, tag, encrypted]).toString(
    'base64'
  );
}

function decryptWithKey(key: Buffer, aad: Buffer, packedB64: string): Buffer {
  const packed = Buffer.from(packedB64, 'base64');
  if (packed.length < 1 + IV_BYTES + TAG_BYTES || packed[0] !== LOCAL_VERSION) {
    throw new Error('Formato de sobre financiero no soportado');
  }
  const iv = packed.subarray(1, 1 + IV_BYTES);
  const tag = packed.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const encrypted = packed.subarray(1 + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function wrapAccountDek(uid: string, dek: Buffer): string {
  return encryptWithKey(masterKey(), dekAad(uid), dek);
}

export function unwrapAccountDek(uid: string, wrapped: string): Buffer {
  const dek = decryptWithKey(masterKey(), dekAad(uid), wrapped);
  if (dek.length !== DEK_BYTES) throw new Error('DEK de cuenta inválida');
  return dek;
}

export function newAccountDek(): Buffer {
  return randomBytes(DEK_BYTES);
}

export function encryptAccountPayload(
  uid: string,
  dek: Buffer,
  kind: string,
  id: string,
  value: unknown
): string {
  return encryptWithKey(
    dek,
    payloadAad(uid, kind, id),
    Buffer.from(JSON.stringify(value), 'utf8')
  );
}

export function decryptAccountPayload<T>(
  uid: string,
  dek: Buffer,
  kind: string,
  id: string,
  blob: string
): T {
  const raw = decryptWithKey(dek, payloadAad(uid, kind, id), blob);
  return JSON.parse(raw.toString('utf8')) as T;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function inferVaultScheme(row: Record<string, unknown> | null): FinanceVaultScheme {
  if (!row) return 'none';
  const scheme = typeof row.scheme === 'string' ? row.scheme : '';
  const hasAccountDek = nonEmptyString(row.account_wrapped_dek);
  const hasPrivateDek = nonEmptyString(row.wrapped_dek);
  if (scheme === 'account' || (hasAccountDek && scheme !== 'private')) {
    return 'account';
  }
  if (scheme === 'private' && hasPrivateDek) return 'private';
  if (hasAccountDek) return 'account';
  return 'none';
}
