import { vi, beforeEach } from 'vitest';

// Setear NODE_ENV antes de cargar `./app` para que el logger HTTP se desactive.
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.ALLOWED_ORIGINS = 'http://localhost:3005';
process.env.ENFORCE_APP_CHECK = 'false';

/**
 * Mock global de `firebase-admin`. Los tests sobrescriben metodos puntuales
 * via `vi.mocked(...).mockResolvedValue(...)` cuando lo necesitan.
 */
vi.mock('../firebaseAdmin', () => {
  const fakeDoc = {
    get: vi.fn(async () => ({ exists: false, data: () => ({}), get: () => undefined })),
    set: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const fakeCol = {
    doc: vi.fn(() => fakeDoc),
    add: vi.fn(async () => ({ id: 'generated' })),
    count: vi.fn(() => ({ get: vi.fn(async () => ({ data: () => ({ count: 0 }) })) })),
  };
  const db = {
    doc: vi.fn(() => fakeDoc),
    collection: vi.fn(() => fakeCol),
    runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: fakeDoc.get,
        set: fakeDoc.set,
        update: fakeDoc.update,
        delete: fakeDoc.delete,
      })
    ),
  };

  return {
    adminAuth: {
      verifyIdToken: vi.fn(async (token: string) => {
        if (token === 'valid-token') {
          return { uid: 'test-uid', email: 'test@example.com', admin: false };
        }
        if (token === 'admin-token') {
          return { uid: 'admin-uid', email: 'admin@example.com', admin: true };
        }
        throw new Error('invalid token');
      }),
    },
    adminAppCheck: {
      verifyToken: vi.fn(async () => ({ token: 'ok' })),
    },
    db,
    FieldValue: {
      serverTimestamp: () => 'SERVER_TS',
      increment: (n: number) => ({ __increment: n }),
    },
    Timestamp: {},
  };
});

// Silenciar pino para que los tests no impriman ruido.
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
}));

// Stub de errorLogs.logError para no acumular Firestore calls.
vi.mock('../errorLogs', () => ({
  logError: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
