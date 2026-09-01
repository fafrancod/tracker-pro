import {
  bytesToMb,
  emptyAdminCounts,
  isUserOnline,
  normalizeAdminPlatform,
  type AdminPlan,
  type AdminSummary,
  type AdminUserCounts,
  type AdminUserRow,
} from '@daily-tracker/core';

export interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  created_at: string | null;
  last_seen_at?: string | null;
  last_path?: string | null;
  last_app_version?: string | null;
  last_platform?: string | null;
}

export interface UserStatRow {
  user_id: string;
  tasks_count?: number | string | null;
  projects_count?: number | string | null;
  contacts_count?: number | string | null;
  finance_count?: number | string | null;
  notes_count?: number | string | null;
  total_bytes?: number | string | null;
}

function asInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function asPlan(value: string | null | undefined): AdminPlan {
  return value === 'pro' ? 'pro' : 'free';
}

export function mapAdminUser(
  profile: ProfileRow,
  stat: UserStatRow | undefined,
  nowMs: number
): AdminUserRow {
  const storageBytes = stat?.total_bytes == null ? null : asInt(stat.total_bytes);
  const lastSeenAt = profile.last_seen_at ?? null;
  return {
    userId: profile.id,
    email: profile.email ?? '',
    name: profile.name ?? '',
    plan: asPlan(profile.plan),
    createdAt: profile.created_at ?? null,
    lastSeenAt,
    lastPath: profile.last_path ?? null,
    lastAppVersion: profile.last_app_version ?? null,
    lastPlatform: normalizeAdminPlatform(profile.last_platform),
    online: isUserOnline(lastSeenAt, nowMs),
    storageBytes,
    storageMb: bytesToMb(storageBytes),
    counts: {
      tasks: asInt(stat?.tasks_count),
      projects: asInt(stat?.projects_count),
      contacts: asInt(stat?.contacts_count),
      finance: asInt(stat?.finance_count),
    },
  };
}

export function summarizeAdminUsers(
  rows: AdminUserRow[],
  storageFromSql: boolean
): AdminSummary {
  const planCounts: Record<AdminPlan, number> = { free: 0, pro: 0 };
  const platformCounts = { web: 0, native: 0, unknown: 0 };
  const totals = emptyAdminCounts();
  let online = 0;
  let totalStorageBytes = 0;
  let hasStorage = false;

  for (const row of rows) {
    planCounts[row.plan] += 1;
    platformCounts[row.lastPlatform] += 1;
    if (row.online) online += 1;
    totals.tasks += row.counts.tasks;
    totals.projects += row.counts.projects;
    totals.contacts += row.counts.contacts;
    totals.finance += row.counts.finance;
    if (row.storageBytes != null) {
      hasStorage = true;
      totalStorageBytes += row.storageBytes;
    }
  }

  return {
    registered: rows.length,
    online,
    planCounts,
    platformCounts,
    totalStorageBytes: storageFromSql && hasStorage ? totalStorageBytes : null,
    totalStorageMb: storageFromSql && hasStorage ? bytesToMb(totalStorageBytes) : null,
    totals,
  };
}

export function matchesAdminFilters(
  row: AdminUserRow,
  search: string,
  plan: string
): boolean {
  if (plan !== 'all' && row.plan !== plan) return false;
  if (!search) return true;
  const haystack = `${row.email} ${row.name} ${row.userId}`.toLowerCase();
  return haystack.includes(search);
}

export function emptyCounts(): AdminUserCounts {
  return emptyAdminCounts();
}
