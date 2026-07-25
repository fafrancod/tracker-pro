import { getSupabase } from '../supabase';
import { isDemoMode } from './demoMode';

interface ApiConfig {
  baseUrl: string;
}

let config: ApiConfig = {
  baseUrl: 'http://localhost:4000',
};

export function configureApi(opts: Partial<ApiConfig>): void {
  // Nota: '' es un valor válido y significa "same-origin" (SPA servida desde
  // la propia API). Hay que distinguir undefined (no tocar) de '' (aplicar),
  // por eso NO se puede usar `if (opts.baseUrl)`: dejaría el default localhost.
  if (opts.baseUrl !== undefined) {
    config = { ...config, baseUrl: opts.baseUrl.replace(/\/$/, '') };
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

/** Cache JWT para no llamar getSession en cada mutación (roadmap §0.5). */
let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAtMs = 0;

async function getAccessToken(): Promise<string | null> {
  if (isDemoMode()) return 'demo-token';
  const now = Date.now();
  // Renovar 60s antes de expirar.
  if (
    cachedAccessToken &&
    cachedAccessTokenExpiresAtMs > now + 60_000
  ) {
    return cachedAccessToken;
  }
  const { data } = await getSupabase().auth.getSession();
  const session = data.session;
  if (!session?.access_token) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAtMs = 0;
    return null;
  }
  cachedAccessToken = session.access_token;
  // expires_at en segundos unix (Supabase).
  const expSec = session.expires_at;
  cachedAccessTokenExpiresAtMs =
    typeof expSec === 'number' && Number.isFinite(expSec)
      ? expSec * 1000
      : now + 55 * 60_000;
  return cachedAccessToken;
}

/** Invalida cache de token (p. ej. tras sign-out). */
export function clearAccessTokenCache(): void {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAtMs = 0;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function demoFetch<T>(path: string, method: string, body: unknown): Promise<T> {
  const json = body as Record<string, unknown> | undefined;

  if (method === 'GET' && path.startsWith('/api/version')) {
    return {
      service: 'daily-tracker-api',
      version: '0.0.0-demo',
      channel: 'demo',
      buildId: nowIso(),
      nodeEnv: 'demo',
      database: 'supabase',
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
          language: 'es',
          defaultBoardView: 'continuous',
          skinId: 'dark-github',
          dayStartHour: 7,
          dayEndHour: 22,
          defaultScheduleLayout: 'list',
        },
      },
    } as T;
  }

  if (method === 'POST' && path === '/api/tasks') {
    const frequency = (json?.recurrenceFrequency as string) ?? 'none';
    const interval = typeof json?.recurrenceInterval === 'number' ? json.recurrenceInterval : 1;
    const kind = (json?.kind as string) ?? 'task';
    const isHabit = kind === 'habit_good' || kind === 'habit_quit';
    const id = randomId();
    // Hábitos lazy: seed único con seriesId = id (espejo del API).
    const seriesId = isHabit || frequency !== 'none' ? id : null;
    return {
      id,
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
      seriesId,
      recurrence: {
        frequency: isHabit && frequency === 'none' ? 'daily' : frequency,
        interval,
      },
      startTime: json?.startTime ?? null,
      endTime: json?.endTime ?? null,
      endDayId: isHabit ? json?.dayId : (json?.endDayId ?? json?.dayId),
      kind,
      color: json?.color ?? null,
      urgency: json?.urgency ?? null,
      importance: json?.importance ?? null,
      createdCount: 1,
      instances: [
        {
          id,
          weekId: json?.weekId,
          dayId: json?.dayId,
          endDayId: isHabit ? json?.dayId : (json?.endDayId ?? json?.dayId),
          seriesId,
        },
      ],
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

  // Círculo (contactos) — solo en memoria en demo
  if (method === 'POST' && path === '/api/contacts') {
    return {
      id: randomId(),
      kind: json?.kind ?? 'person',
      name: json?.name ?? '',
      tags: Array.isArray(json?.tags) ? json.tags : [],
      relationship: json?.relationship ?? null,
      relationPulse: json?.relationPulse ?? null,
      order: 0,
      created_at: nowIso(),
    } as T;
  }
  if (method === 'PATCH' && path.startsWith('/api/contacts/')) {
    return { id: path.split('/').pop(), ...(json ?? {}) } as T;
  }
  if (method === 'DELETE' && path.startsWith('/api/contacts/')) {
    return undefined as T;
  }

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
    const token = await getAccessToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

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