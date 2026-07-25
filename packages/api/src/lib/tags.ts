const HASHTAG_RE = /#([\p{L}\p{N}_-]{1,40})/gu;

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

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

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

/** Recetario: hashtags del título + mascota como tag; sin proyecto. */
export function mergeTagsForRx(
  title: string,
  tags: string[] | null | undefined,
  kind: string,
  rxSubject: string | null
): string[] {
  const fromTitle = extractHashtags(title);
  const pet =
    kind === 'rx_pet' && rxSubject?.trim() ? normalizeTag(rxSubject) : null;
  return mergeTags(tags, fromTitle, pet);
}
