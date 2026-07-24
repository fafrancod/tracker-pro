import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../types';

export type ProjectsUnsubscribe = () => void;

export async function fetchProjects(uid: string): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select('*')
    .eq('user_id', uid)
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapProject(row.id as string, row));
}

export function subscribeProjects(uid: string, cb: (projects: Project[]) => void): ProjectsUnsubscribe {
  if (isDemoMode()) return () => undefined;

  void fetchProjects(uid).then(cb);

  return subscribeTable({
    topic: `projects:${uid}`,
    table: 'projects',
    filter: `user_id=eq.${uid}`,
    onChange: () => {
      void fetchProjects(uid).then(cb);
    },
  });
}

interface CreateProjectResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<CreateProjectResponse>('/api/projects', payload);
  return mapProject(res.id, res as unknown as Record<string, unknown>);
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

function mapProject(id: string, raw: Record<string, unknown>): Project {
  return {
    id,
    name: (raw.name as string) ?? '',
    color: (raw.color as string) ?? '#7d8590',
    icon: (raw.icon as string) ?? '📁',
    order: typeof raw.order === 'number' ? raw.order : 0,
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
  };
}