import { getFirebaseAuth } from '../firebase';
import { isDemoMode } from './demoMode';

// Cliente API compartido. Configurable desde la capa de cada plataforma
// (web lee `import.meta.env.VITE_API_BASE_URL`; mobile leeria `EXPO_PUBLIC_*`).
//
// Mantener este modulo libre de APIs DOM ni Vite para preservar compatibilidad
// con React Native.

interface ApiConfig {
  baseUrl: string;
  appCheckTokenGetter: () => Promise<string | null>;
}

let config: ApiConfig = {
  baseUrl: 'http://localhost:4000',
  appCheckTokenGetter: async () => null,
};

export function configureApi(opts: Partial<ApiConfig>): void {
  if (opts.baseUrl) {
    config = { ...config, baseUrl: opts.baseUrl.replace(/\/$/, '') };
  }
  if (opts.appCheckTokenGetter) {
    config = { ...config, appCheckTokenGetter: opts.appCheckTokenGetter };
  }
}

export function getApiBaseUrl(): string {
  return config.baseUrl;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

interface AuthFetchOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  withAuth?: boolean;
}

async function getIdToken(): Promise<string | null> {
  if (isDemoMode()) return 'demo-token';
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function nowIso(): string {
  return new Date().toISOString();
}

// Mock para demo mode: nunca toca la red. Resuelve segun el path/method.
async function demoFetch<T>(path: string, method: string, body: unknown): Promise<T> {
  const json = body as Record<string, unknown> | undefined;

  if (method === 'GET' && path.startsWith('/api/version')) {
    return {
      service: 'daily-tracker-api',
      version: '0.0.0-demo',
      channel: 'demo',
      buildId: nowIso(),
      nodeEnv: 'demo',
      enforceAppCheck: false,
    } as T;
  }

  if (method === 'POST' && path === '/api/auth/bootstrap') {
    return {
      uid: 'demo-user',
      created: false,
      profile: {
        name: (json?.name as string) ?? 'Demo',
        email: 'demo@local',
        plan: 'free',
        createdAt: nowIso(),
        settings: {
          autoRollIncomplete: false,
          defaultProjectId: null,
          weekStartsOnMonday: true,
        },
      },
    } as T;
  }

  if (method === 'POST' && path === '/api/tasks') {
    return {
      id: randomId(),
      weekId: json?.weekId,
      dayId: json?.dayId,
      title: json?.title,
      completed: false,
      completedAt: null,
      projectId: json?.projectId ?? null,
      priority: json?.priority ?? 'medium',
      notes: json?.notes ?? '',
      order: 0,
      tags: json?.tags ?? [],
      movedFrom: null,
    } as T;
  }

  if (method === 'POST' && path === '/api/projects') {
    return {
      id: randomId(),
      name: json?.name,
      color: json?.color,
      icon: json?.icon,
      order: 0,
    } as T;
  }

  // PATCH / DELETE / move → 204 equivalente (devolvemos undefined).
  return undefined as T;
}

export async function authFetch<T = unknown>(
  path: string,
  opts: AuthFetchOptions = {}
): Promise<T> {
  const { json, withAuth = true, headers, ...rest } = opts;

  if (isDemoMode()) {
    return demoFetch<T>(path, (rest as { method?: string }).method ?? 'GET', json);
  }

  const finalHeaders = new Headers(headers);
  if (json !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (withAuth) {
    const token = await getIdToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }
  const appCheck = await config.appCheckTokenGetter();
  if (appCheck) finalHeaders.set('X-Firebase-AppCheck', appCheck);

  const url = path.startsWith('http') ? path : `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const body = (typeof data === 'object' && data !== null ? data : {}) as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'unknown_error',
      body.error?.message ?? `HTTP ${response.status}`,
      body.error?.details
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => authFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, json?: unknown) => authFetch<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json?: unknown) => authFetch<T>(path, { method: 'PATCH', json }),
  del: <T>(path: string) => authFetch<T>(path, { method: 'DELETE' }),
  publicGet: <T>(path: string) => authFetch<T>(path, { method: 'GET', withAuth: false }),
};
