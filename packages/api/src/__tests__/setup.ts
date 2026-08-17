import { vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.ALLOWED_ORIGINS = 'http://localhost:3005';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.FINANCE_MASTER_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

export const MOCK_PROFILES = [
  {
    id: 'admin-uid',
    name: 'Franco',
    email: 'fafrancod@gmail.com',
    plan: 'pro',
    created_at: '2026-01-01T00:00:00.000Z',
    last_seen_at: new Date().toISOString(),
    last_path: '/board',
    last_app_version: '2.17.2',
    last_platform: 'web',
  },
  {
    id: 'other-uid',
    name: 'Lilian',
    email: 'liliandiaza@gmail.com',
    plan: 'free',
    created_at: '2026-02-01T00:00:00.000Z',
    last_seen_at: null,
    last_path: null,
    last_app_version: null,
    last_platform: null,
  },
];

export const MOCK_USER_STATS = [
  {
    user_id: 'admin-uid',
    tasks_count: 12,
    projects_count: 3,
    contacts_count: 2,
    finance_count: 1,
    total_bytes: 2 * 1024 * 1024,
  },
  {
    user_id: 'other-uid',
    tasks_count: 4,
    projects_count: 1,
    contacts_count: 0,
    finance_count: 0,
    total_bytes: 256 * 1024,
  },
];

function chainable(result: unknown = { data: null, error: null, count: 0 }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.upsert = vi.fn(async () => ({ data: null, error: null }));
  chain.order = vi.fn(self);
  chain.get = vi.fn(async () => result);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
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
        onboardingTourCompleted: false,
      },
      created_at: new Date().toISOString(),
    },
    error: null,
  });

  const planPatch = { id: 'other-uid', plan: 'pro' };
  const updateChain = chainable({ data: planPatch, error: null });
  updateChain.eq = vi.fn(() => {
    const eqChain = chainable({ data: planPatch, error: null });
    eqChain.select = vi.fn(() => {
      const sel = chainable({ data: planPatch, error: null });
      sel.maybeSingle = vi.fn(async () => ({ data: planPatch, error: null }));
      return sel;
    });
    return eqChain;
  });

  const listChain = chainable({ data: MOCK_PROFILES, error: null });
  listChain.eq = vi.fn(() => ({
    maybeSingle: profileChain.maybeSingle,
    single: insertChain.single,
    select: vi.fn(() => {
      const sel = chainable({ data: planPatch, error: null });
      sel.maybeSingle = vi.fn(async () => ({ data: planPatch, error: null }));
      return sel;
    }),
  }));
  listChain.insert = vi.fn(() => insertChain);
  listChain.update = vi.fn(() => updateChain);

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
          if (token === 'owner-token') {
            return {
              data: {
                user: {
                  id: 'owner-uid',
                  email: 'fafrancod@gmail.com',
                  app_metadata: {},
                },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: new Error('invalid token') };
        }),
      },
      rpc: vi.fn(async (name: string) => {
        if (name === 'admin_user_stats') {
          return { data: MOCK_USER_STATS, error: null };
        }
        return { data: null, error: new Error(`unknown rpc ${name}`) };
      }),
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return listChain;
        }
        if (table === 'usage_counters') {
          return { upsert: vi.fn(async () => ({ data: null, error: null })) };
        }
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
              then: (resolve: (value: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(resolve),
            })),
          };
        }
        return chainable({ data: [], error: null });
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
