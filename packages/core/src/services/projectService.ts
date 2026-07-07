import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../types';

function projectsCol(uid: string) {
  return collection(getDb(), 'users', uid, 'projects');
}

// Lecturas: owner reads permitidas por rules.
export async function fetchProjects(uid: string): Promise<Project[]> {
  const q = query(projectsCol(uid), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => normalizeProject(d.id, d.data()));
}

export function subscribeProjects(uid: string, cb: (projects: Project[]) => void): Unsubscribe {
  if (isDemoMode()) return () => undefined;
  const q = query(projectsCol(uid), orderBy('order', 'asc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => normalizeProject(d.id, d.data())));
  });
}

// Escrituras: backend-only.

interface CreateProjectResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<CreateProjectResponse>('/api/projects', payload);
  return normalizeProject(res.id, res as unknown as Record<string, unknown>);
}

export async function updateProject(
  projectId: string,
  payload: UpdateProjectPayload
): Promise<void> {
  await api.patch<void>(`/api/projects/${encodeURIComponent(projectId)}`, payload);
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.del<void>(`/api/projects/${encodeURIComponent(projectId)}`);
}

// --- Helpers ----------------------------------------------------------------

function normalizeProject(id: string, raw: Record<string, unknown>): Project {
  return {
    id,
    name: (raw.name as string) ?? '',
    color: (raw.color as string) ?? '#7d8590',
    icon: (raw.icon as string) ?? '📁',
    order: typeof raw.order === 'number' ? raw.order : 0,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
  };
}

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}
