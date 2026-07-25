/**
 * Hashtags (#) y menciones (@) reutilizables.
 * #Ragnar / @Ana → tags normalizados sin prefijo.
 */

const HASHTAG_RE = /#([\p{L}\p{N}_-]{1,40})/gu;
const MENTION_RE = /@([\p{L}\p{N}_-]{1,40})/gu;

/** Extrae #tags del texto (sin el #, capitalización original). */
export function extractHashtags(text: string | null | undefined): string[] {
  return extractPrefixedTokens(text, HASHTAG_RE);
}

/** Extrae @menciones del texto (sin el @). */
export function extractMentions(text: string | null | undefined): string[] {
  return extractPrefixedTokens(text, MENTION_RE);
}

function extractPrefixedTokens(
  text: string | null | undefined,
  pattern: RegExp
): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((m = re.exec(text)) !== null) {
    const tag = m[1].trim();
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Normaliza etiqueta: quita # / @ inicial y espacios. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^[#@]+/, '').trim();
}

/**
 * Handles de un contacto del Círculo (tags + fallback del nombre).
 * Sin @; listos para mergeTags o autocompletar @Nombre.
 */
export function contactHandles(contact: {
  name: string;
  tags: string[] | null | undefined;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    const key = t.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  for (const t of contact.tags ?? []) push(t);
  if (out.length === 0) {
    // Primera palabra del nombre o nombre compacto
    const parts = contact.name.trim().split(/\s+/).filter(Boolean);
    if (parts[0]) push(parts[0]);
    else push(contact.name.replace(/\s+/g, ''));
  }
  return out;
}

/**
 * ¿La tarea está etiquetada / mencionada con algún handle del contacto?
 * Mira tags[], @menciones en título/notas y subject de recetario.
 */
export function taskMatchesContact(
  task: {
    title?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    rx?: { subject?: string | null } | null;
  },
  contact: { name: string; tags: string[] | null | undefined }
): boolean {
  const handles = contactHandles(contact);
  if (handles.length === 0) return false;
  const keys = new Set(handles.map(h => h.toLocaleLowerCase()));

  for (const tag of task.tags ?? []) {
    const n = normalizeTag(tag).toLocaleLowerCase();
    if (n && keys.has(n)) return true;
  }

  const haystack = `${task.title ?? ''}\n${task.notes ?? ''}`.toLocaleLowerCase();
  for (const h of handles) {
    if (haystack.includes(`@${h.toLocaleLowerCase()}`)) return true;
  }

  const subject = task.rx?.subject ? normalizeTag(task.rx.subject).toLocaleLowerCase() : '';
  if (subject && keys.has(subject)) return true;

  return false;
}

/**
 * Une tags existentes + hashtags del título + etiqueta extra (p. ej. nombre de mascota).
 * Deduplica case-insensitive preservando la primera forma vista.
 */
export function mergeTags(
  existing: string[] | null | undefined,
  ...sources: Array<string | string[] | null | undefined>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  };
  for (const t of existing ?? []) push(t);
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const t of src) push(t);
    } else {
      push(src);
    }
  }
  return out;
}
