/** Dueño del producto — único admin por email, igual que Atenas en finanzas-pro. */
export const PRIMARY_OWNER_EMAIL = 'fafrancod@gmail.com';

/** Ventana de presencia: last_seen dentro de este intervalo = online. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export type AdminPlan = 'free' | 'pro';
export type AdminPlatform = 'web' | 'native' | 'unknown';

export interface AdminUserCounts {
  tasks: number;
  projects: number;
  contacts: number;
  finance: number;
}

export interface AdminUserRow {
  userId: string;
  email: string;
  name: string;
  plan: AdminPlan;
  createdAt: string | null;
  lastSeenAt: string | null;
  lastPath: string | null;
  lastAppVersion: string | null;
  lastPlatform: AdminPlatform;
  online: boolean;
  storageBytes: number | null;
  storageMb: number | null;
  counts: AdminUserCounts;
}

export interface AdminSummary {
  registered: number;
  online: number;
  planCounts: Record<AdminPlan, number>;
  platformCounts: Record<AdminPlatform, number>;
  totalStorageBytes: number | null;
  totalStorageMb: number | null;
  totals: AdminUserCounts;
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  matched: number;
  summary: AdminSummary;
  generatedAt: string;
  onlineWindowSeconds: number;
  storageFromSql: boolean;
}

export interface AdminOverviewResponse {
  registered: number;
  online: number;
  onlineWindowSeconds: number;
  planCounts: Record<AdminPlan, number>;
  platformCounts: Record<AdminPlatform, number>;
  totalStorageMb: number | null;
  totals: AdminUserCounts;
  generatedAt: string;
  storageFromSql: boolean;
}

export function isPrimaryOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PRIMARY_OWNER_EMAIL;
}

export function isAdminUser(input: {
  email?: string | null;
  appMetadata?: { admin?: unknown } | null;
}): boolean {
  if (input.appMetadata?.admin === true) return true;
  return isPrimaryOwnerEmail(input.email);
}

export function isUserOnline(
  lastSeenAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastSeenAt) return false;
  const t = Date.parse(lastSeenAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t <= ONLINE_WINDOW_MS;
}

export function bytesToMb(bytes: number | null | undefined): number | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function normalizeAdminPlatform(value: string | null | undefined): AdminPlatform {
  if (value === 'web' || value === 'native') return value;
  return 'unknown';
}

export function emptyAdminCounts(): AdminUserCounts {
  return { tasks: 0, projects: 0, contacts: 0, finance: 0 };
}
