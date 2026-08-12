import type { Project, ProjectCategory } from '../types';

export const MAX_PROJECT_CATEGORIES = 20;

export function newProjectCategoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normaliza subcategorías de un proyecto (máx. 20, nombres únicos no vacíos). */
export function normalizeProjectCategories(raw: unknown): ProjectCategory[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectCategory[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
    if (!name) continue;
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    let id =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim().slice(0, 80)
        : newProjectCategoryId();
    if (seenIds.has(id)) id = newProjectCategoryId();
    seenIds.add(id);
    out.push({
      id,
      name,
      order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : out.length,
    });
    if (out.length >= MAX_PROJECT_CATEGORIES) break;
  }
  return out
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((c, i) => ({ ...c, order: i }));
}

export function projectHasCategories(project: Project | null | undefined): boolean {
  return (project?.categories?.length ?? 0) > 0;
}

export function findProjectCategory(
  project: Project | null | undefined,
  categoryId: string | null | undefined
): ProjectCategory | null {
  if (!project || !categoryId) return null;
  return project.categories?.find(c => c.id === categoryId) ?? null;
}

/**
 * Si la categoría no pertenece al proyecto (o no hay proyecto), devuelve null.
 */
export function resolveProjectCategoryId(
  project: Project | null | undefined,
  categoryId: string | null | undefined
): string | null {
  if (!project || !categoryId) return null;
  return project.categories?.some(c => c.id === categoryId) ? categoryId : null;
}
