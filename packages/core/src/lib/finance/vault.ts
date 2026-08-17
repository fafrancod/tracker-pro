/** Core no tiene lib DOM: tipamos WebCrypto a mano. */
export type FinanceDek = { readonly type: string };

type SubtleLike = {
  importKey(
    format: string,
    keyData: ArrayBuffer,
    algorithm: unknown,
    extractable: boolean,
    usages: string[]
  ): Promise<FinanceDek>;
  deriveKey(
    algorithm: unknown,
    baseKey: FinanceDek,
    derived: unknown,
    extractable: boolean,
    usages: string[]
  ): Promise<FinanceDek>;
  encrypt(algorithm: unknown, key: FinanceDek, data: ArrayBuffer): Promise<ArrayBuffer>;
  decrypt(algorithm: unknown, key: FinanceDek, data: ArrayBuffer): Promise<ArrayBuffer>;
  exportKey(format: string, key: FinanceDek): Promise<ArrayBuffer>;
};

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BYTES = 32;
const PBKDF2_ITERATIONS = 210_000;
const ENC_V = '1';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export const FINANCE_VAULT_ENC_V = ENC_V;
export const FINANCE_VAULT_ITERATIONS = PBKDF2_ITERATIONS;

export interface FinanceVaultMeta {
  kdfSalt: string;
  kdfParams: { algo: 'PBKDF2'; iterations: number; hash: 'SHA-256' };
  wrappedDek: string;
  recoveryWrappedDek: string;
  encV: string;
}

export interface FinanceVaultEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  iv: string;
  ct: string;
}

export class FinanceVaultError extends Error {
  constructor(
    message: string,
    public code:
      | 'no_crypto'
      | 'bad_phrase'
      | 'bad_envelope'
      | 'empty_phrase' = 'bad_phrase'
  ) {
    super(message);
    this.name = 'FinanceVaultError';
  }
}

function subtle(): SubtleLike {
  const s = (globalThis.crypto as { subtle?: SubtleLike } | undefined)?.subtle;
  if (!s) {
    throw new FinanceVaultError(
      'Web Crypto no está disponible en este entorno.',
      'no_crypto'
    );
  }
  return s;
}

function randomBytes(size: number): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new FinanceVaultError('getRandomValues no disponible.', 'no_crypto');
  }
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  }
  const Buf = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(e: string): string } } })
    .Buffer;
  if (Buf) return Buf.from(bytes).toString('base64');
  throw new FinanceVaultError('Sin Base64.', 'no_crypto');
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const Buf = (globalThis as { Buffer?: { from(v: string, e: string): Uint8Array } }).Buffer;
  if (Buf) return new Uint8Array(Buf.from(value, 'base64'));
  throw new FinanceVaultError('Sin Base64.', 'no_crypto');
}

async function deriveKek(
  secret: string,
  saltB64: string,
  iterations = PBKDF2_ITERATIONS
): Promise<FinanceDek> {
  if (!secret.trim()) {
    throw new FinanceVaultError('La frase no puede estar vacía.', 'empty_phrase');
  }
  const salt = base64ToBytes(saltB64);
  if (salt.byteLength < SALT_BYTES) {
    throw new FinanceVaultError('Salt inválido.', 'bad_envelope');
  }
  const material = await subtle().importKey(
    'raw',
    asBuffer(TEXT_ENCODER.encode(secret)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptBytes(
  key: FinanceDek,
  plain: Uint8Array,
  aad: string
): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt(
    {
      name: 'AES-GCM',
      iv: asBuffer(iv),
      additionalData: asBuffer(TEXT_ENCODER.encode(aad)),
    },
    key,
    asBuffer(plain)
  );
  const envelope: FinanceVaultEnvelope = {
    v: 1,
    alg: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
  };
  return bytesToBase64(TEXT_ENCODER.encode(JSON.stringify(envelope)));
}

async function decryptBytes(
  key: FinanceDek,
  blob: string,
  aad: string
): Promise<Uint8Array> {
  try {
    const parsed = JSON.parse(
      TEXT_DECODER.decode(base64ToBytes(blob))
    ) as FinanceVaultEnvelope;
    if (parsed.v !== 1 || !parsed.iv || !parsed.ct) {
      throw new Error('envelope');
    }
    const plain = await subtle().decrypt(
      {
        name: 'AES-GCM',
        iv: asBuffer(base64ToBytes(parsed.iv)),
        additionalData: asBuffer(TEXT_ENCODER.encode(aad)),
      },
      key,
      asBuffer(base64ToBytes(parsed.ct))
    );
    return new Uint8Array(plain);
  } catch (err) {
    if (err instanceof FinanceVaultError) throw err;
    throw new FinanceVaultError(
      'No se pudo descifrar. Frase incorrecta o dato alterado.',
      'bad_phrase'
    );
  }
}

export function financePayloadAad(
  uid: string,
  table: 'finance_movements' | 'finance_rules',
  id: string
): string {
  return `${uid}|${table}|${id}|${ENC_V}`;
}

export async function generateDek(): Promise<FinanceDek> {
  return subtle().importKey(
    'raw',
    asBuffer(randomBytes(DEK_BYTES)),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function wrapDek(dek: FinanceDek, kek: FinanceDek, uid: string): Promise<string> {
  const raw = new Uint8Array(await subtle().exportKey('raw', dek));
  return encryptBytes(kek, raw, `dek|${uid}|${ENC_V}`);
}

export async function unwrapDek(
  wrapped: string,
  kek: FinanceDek,
  uid: string
): Promise<FinanceDek> {
  const raw = await decryptBytes(kek, wrapped, `dek|${uid}|${ENC_V}`);
  return subtle().importKey('raw', asBuffer(raw), { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptFinancePayload(
  dek: FinanceDek,
  payload: unknown,
  aad: string
): Promise<string> {
  return encryptBytes(dek, TEXT_ENCODER.encode(JSON.stringify(payload)), aad);
}

export async function decryptFinancePayload<T>(
  dek: FinanceDek,
  blob: string,
  aad: string
): Promise<T> {
  const bytes = await decryptBytes(dek, blob, aad);
  return JSON.parse(TEXT_DECODER.decode(bytes)) as T;
}

export async function createFinanceVault(
  uid: string,
  passphrase: string,
  recoverySecret: string
): Promise<{ meta: FinanceVaultMeta; dek: FinanceDek }> {
  const salt = bytesToBase64(randomBytes(SALT_BYTES));
  const dek = await generateDek();
  const kek = await deriveKek(passphrase, salt);
  const recoveryKek = await deriveKek(`recovery:${recoverySecret}`, salt);
  const meta: FinanceVaultMeta = {
    kdfSalt: salt,
    kdfParams: {
      algo: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    wrappedDek: await wrapDek(dek, kek, uid),
    recoveryWrappedDek: await wrapDek(dek, recoveryKek, uid),
    encV: ENC_V,
  };
  return { meta, dek };
}

export async function unlockFinanceVault(
  uid: string,
  meta: FinanceVaultMeta,
  secret: string,
  mode: 'passphrase' | 'recovery'
): Promise<FinanceDek> {
  const iterations = meta.kdfParams?.iterations ?? PBKDF2_ITERATIONS;
  const material =
    mode === 'recovery' ? `recovery:${secret.trim()}` : secret;
  const kek = await deriveKek(material, meta.kdfSalt, iterations);
  const wrapped =
    mode === 'recovery' ? meta.recoveryWrappedDek : meta.wrappedDek;
  return unwrapDek(wrapped, kek, uid);
}

export async function rewrapFinanceVault(
  uid: string,
  meta: FinanceVaultMeta,
  dek: FinanceDek,
  newPassphrase: string
): Promise<FinanceVaultMeta> {
  const kek = await deriveKek(newPassphrase, meta.kdfSalt, meta.kdfParams.iterations);
  return {
    ...meta,
    wrappedDek: await wrapDek(dek, kek, uid),
  };
}
