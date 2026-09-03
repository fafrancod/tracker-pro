import type { Note, NoteContent, NoteLink, NoteLinkType, TaskKind } from '../types';

const LINK_TYPES: NoteLinkType[] = ['project', 'subproject', 'task', 'event'];
const MAX_LINKS = 40;
const MAX_TITLE = 200;
const MAX_EXCERPT = 280;

/** Imágenes inline (data URL) por idea. */
export const MAX_NOTE_IMAGES = 8;

/** Tope del JSON TipTap (incluye data URLs). Alineado con adjuntos de tarea. */
export const MAX_NOTE_CONTENT_CHARS = 3_500_000;

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

export function walkNoteNodes(
  content: unknown,
  visit: (node: Record<string, unknown>) => void
): void {
  if (!content || typeof content !== 'object') return;
  const node = content as Record<string, unknown>;
  visit(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkNoteNodes(child, visit);
  }
}

export function countNoteImages(content: unknown): number {
  let n = 0;
  walkNoteNodes(content, node => {
    if (node.type === 'image') n += 1;
  });
  return n;
}

export function noteContentSize(content: unknown): number {
  try {
    return JSON.stringify(content ?? {}).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isNoteContentTooLarge(content: unknown): boolean {
  return noteContentSize(content) > MAX_NOTE_CONTENT_CHARS;
}

export function noteLinksToTask(note: Note, taskId: string): boolean {
  return note.links.some(
    l => (l.type === 'task' || l.type === 'event') && l.id === taskId
  );
}

export function notesLinkedToTask(notes: Note[], taskId: string): Note[] {
  return notes.filter(n => noteLinksToTask(n, taskId));
}

export function noteLinkTypeForKind(kind: TaskKind): 'task' | 'event' {
  return kind === 'event' || kind === 'possible_event' ? 'event' : 'task';
}

export function noteLinkForTask(task: {
  id: string;
  title: string;
  kind: TaskKind;
  projectId?: string | null;
}): NoteLink {
  return {
    type: noteLinkTypeForKind(task.kind),
    id: task.id,
    projectId: task.projectId ?? null,
    label: task.title.trim().slice(0, 80) || null,
  };
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
