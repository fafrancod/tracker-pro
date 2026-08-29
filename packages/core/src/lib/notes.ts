import type { Note, NoteContent, NoteLink, NoteLinkType } from '../types';

const LINK_TYPES: NoteLinkType[] = ['project', 'subproject', 'task', 'event'];
const MAX_LINKS = 40;
const MAX_TITLE = 200;
const MAX_EXCERPT = 280;

const EMPTY_DOC: NoteContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function emptyNoteDoc(): NoteContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

export function isNoteLinkType(value: unknown): value is NoteLinkType {
  return typeof value === 'string' && (LINK_TYPES as string[]).includes(value);
}

export function normalizeNoteLinks(raw: unknown): NoteLink[] {
  if (!Array.isArray(raw)) return [];
  const out: NoteLink[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (!isNoteLinkType(o.type)) continue;
    const id = typeof o.id === 'string' ? o.id.trim().slice(0, 80) : '';
    if (!id) continue;
    const key = `${o.type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const projectId =
      typeof o.projectId === 'string' && o.projectId.trim()
        ? o.projectId.trim().slice(0, 80)
        : null;
    const label =
      typeof o.label === 'string' && o.label.trim()
        ? o.label.trim().slice(0, 80)
        : null;
    out.push({
      type: o.type,
      id,
      projectId: o.type === 'subproject' ? projectId : projectId,
      label,
    });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

export function excerptFromNoteContent(content: unknown): string {
  const texts: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === 'string' && n.text) texts.push(n.text);
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(content);
  return texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT);
}

export function normalizeNoteTitle(raw: unknown, excerpt = ''): string {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().slice(0, MAX_TITLE);
  }
  if (excerpt) return excerpt.slice(0, 80);
  return '';
}

export function normalizeNoteContent(raw: unknown): NoteContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyNoteDoc();
  }
  const o = raw as Record<string, unknown>;
  if (o.type !== 'doc') {
    return { ...EMPTY_DOC };
  }
  return o as NoteContent;
}

export function mapNote(id: string, raw: Record<string, unknown>): Note {
  const content = normalizeNoteContent(raw.content);
  const excerpt =
    typeof raw.excerpt === 'string' && raw.excerpt
      ? raw.excerpt
      : excerptFromNoteContent(content);
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content,
    excerpt,
    links: normalizeNoteLinks(raw.links),
    createdAt:
      (raw.created_at as string) ??
      (raw.createdAt as string) ??
      new Date(0).toISOString(),
    updatedAt:
      (raw.updated_at as string) ??
      (raw.updatedAt as string) ??
      new Date(0).toISOString(),
  };
}

export { MAX_LINKS, MAX_TITLE };
