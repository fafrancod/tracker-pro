/**
 * Hashtags y etiquetas reutilizables (p. ej. mascotas #Ragnar).
 */

const HASHTAG_RE = /#([\p{L}\p{N}_-]{1,40})/gu;

/** Extrae #tags del texto (sin el #, capitalización original). */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(HASHTAG_RE.source, HASHTAG_RE.flags);
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

/** Normaliza etiqueta: quita # inicial y espacios. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
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
