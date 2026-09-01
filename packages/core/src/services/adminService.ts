import { api } from '../lib/api';
import type {
  AdminErrorsResponse,
  AdminHealthResponse,
  AdminOverviewResponse,
  AdminPlan,
  AdminUsersResponse,
} from '../lib/adminPortal';

export async function fetchAdminUsers(opts?: {
  search?: string;
  plan?: string;
}): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (opts?.search?.trim()) params.set('search', opts.search.trim());
  if (opts?.plan && opts.plan !== 'all') params.set('plan', opts.plan);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<AdminUsersResponse>(`/api/admin/users${suffix}`);
}

export async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
  return api.get<AdminOverviewResponse>('/api/admin/overview');
}

export async function fetchAdminErrors(opts?: {
  limit?: number;
  cursor?: string | null;
}): Promise<AdminErrorsResponse> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<AdminErrorsResponse>(`/api/admin/errors${suffix}`);
}

export async function fetchAdminHealth(): Promise<AdminHealthResponse> {
  return api.get<AdminHealthResponse>('/api/admin/health');
}

export async function setAdminUserPlan(
  userId: string,
  plan: AdminPlan
): Promise<{ userId: string; plan: AdminPlan }> {
  return api.patch<{ userId: string; plan: AdminPlan }>(
    `/api/admin/users/${encodeURIComponent(userId)}/plan`,
    { plan }
  );
}

export async function sendPresenceHeartbeat(payload: {
  path?: string;
  appVersion?: string;
  platform?: 'web' | 'native';
}): Promise<{ persisted: boolean }> {
  return api.post<{ persisted: boolean }>('/api/auth/presence', payload);
}
