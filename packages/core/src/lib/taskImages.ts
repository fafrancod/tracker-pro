/** Máximo de imágenes adjuntas por tarea. */
export const MAX_TASK_IMAGES = 4;

/** Tope por data URL (~200KB de string; JPEG comprimido en cliente). */
export const MAX_TASK_IMAGE_DATA_URL_LENGTH = 200_000;

const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;

/**
 * Normaliza adjuntos de imagen de una tarea (data URLs JPEG/PNG/WebP).
 * Descarta entradas inválidas o demasiado grandes.
 */
export function normalizeTaskImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s || !DATA_URL_RE.test(s)) continue;
    if (s.length > MAX_TASK_IMAGE_DATA_URL_LENGTH) continue;
    // Evitar duplicados exactos (mismo data URL).
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_TASK_IMAGES) break;
  }
  return out;
}

export function imagesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
