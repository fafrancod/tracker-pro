import { vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.ALLOWED_ORIGINS = 'http://localhost:3005';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

function chainable(result: unknown = { data: null, error: null, count: 0 }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.upsert = vi.fn(async () => ({ data: null, error: null }));
  chain.order = vi.fn(self);
  chain.get = vi.fn(async () => result);
  return chain;
}

vi.mock('../supabaseAdmin', () => {
  const profileChain = chainable({ data: null, error: null });
  const insertChain = chainable({
    data: {
      id: 'test-uid',
      name: 'Test User',
      email: 'test@example.com',
      plan: 'free',
      settings: {
        autoRollIncomplete: false,
        defaultProjectId: null,
        weekStartsOnMonday: true,
        language: 'es',
        defaultBoardView: 'continuous',
        skinId: 'dark-github',
        dayStartHour: 7,
        dayEndHour: 22,
        defaultScheduleLayout: 'list',
      },
      created_at: new Date().toISOString(),
    },
    error: null,
  });

  return {
    getSupabaseAdmin: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async (token: string) => {
          if (token === 'valid-token') {
            return {
              data: {
                user: {
                  id: 'test-uid',
                  email: 'test@example.com',
                  app_metadata: {},
                },
              },
              error: null,
            };
          }
          if (token === 'admin-token') {
            return {
              data: {
                user: {
                  id: 'admin-uid',
                  email: 'admin@example.com',
                  app_metadata: { admin: true },
                },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: new Error('invalid token') };
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            ...profileChain,
            insert: vi.fn(() => insertChain),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: profileChain.maybeSingle,
                single: insertChain.single,
              })),
            })),
          };
        }
        if (table === 'usage_counters') {
          return { upsert: vi.fn(async () => ({ data: null, error: null })) };
        }
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
                })),
              })),
            })),
          };
        }
        return chainable();
      }),
    })),
  };
});

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
}));

vi.mock('../errorLogs', () => ({
  logError: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});