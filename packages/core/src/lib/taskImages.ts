/** Máximo de adjuntos (imágenes o PDF) por tarea. */
export const MAX_TASK_IMAGES = 4;

/** Tope por data URL de imagen (~200KB de string; JPEG comprimido en cliente). */
export const MAX_TASK_IMAGE_DATA_URL_LENGTH = 200_000;

/** Tope por data URL de PDF (~1.6MB de string; archivo ~1.2MB). */
export const MAX_TASK_PDF_DATA_URL_LENGTH = 1_800_000;

/** Tope combinado de todos los adjuntos de una tarea. */
export const MAX_TASK_ATTACHMENTS_TOTAL_LENGTH = 3_500_000;

/** Tope del archivo PDF en crudo (antes de base64). */
export const MAX_TASK_PDF_FILE_BYTES = 1_200_000;

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type TaskAttachmentKind = 'image' | 'pdf';

export interface TaskAttachmentMeta {
  kind: TaskAttachmentKind;
  name: string;
  mimeType: string;
  dataUrl: string;
}

function isImageMime(mime: string): boolean {
  return IMAGE_MIME.has(mime.toLowerCase());
}

function isPdfMime(mime: string): boolean {
  return mime.toLowerCase() === 'application/pdf';
}

export function sanitizeAttachmentName(
  name: string,
  kind: TaskAttachmentKind
): string {
  const fallback = kind === 'pdf' ? 'documento.pdf' : 'imagen.jpg';
  const trimmed = name.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  const cut = (trimmed || fallback).slice(0, 120);
  if (kind === 'pdf' && !/\.pdf$/i.test(cut)) return `${cut}.pdf`;
  return cut;
}

/**
 * Interpreta un data URL de imagen o PDF.
 * Acepta el parámetro opcional `name` / `filename` (RFC 2397).
 */
export function parseTaskAttachment(raw: string): TaskAttachmentMeta | null {
  const s = raw.trim();
  if (!s.toLowerCase().startsWith('data:')) return null;
  const comma = s.indexOf(',');
  if (comma < 5) return null;
  const header = s.slice(5, comma);
  const parts = header.split(';');
  const mime = (parts[0] ?? '').trim().toLowerCase();
  const isImage = isImageMime(mime);
  const isPdf = isPdfMime(mime);
  if (!isImage && !isPdf) return null;
  const kind: TaskAttachmentKind = isPdf ? 'pdf' : 'image';
  const max =
    kind === 'pdf' ? MAX_TASK_PDF_DATA_URL_LENGTH : MAX_TASK_IMAGE_DATA_URL_LENGTH;
  if (s.length > max) return null;

  let name = '';
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim();
    if (key === 'name' || key === 'filename') {
      try {
        name = decodeURIComponent(val);
      } catch {
        name = val;
      }
    }
  }
  if (!name) name = kind === 'pdf' ? 'documento.pdf' : 'imagen.jpg';
  name = sanitizeAttachmentName(name, kind);
  return { kind, name, mimeType: mime, dataUrl: s };
}

/** Inserta o reemplaza `;name=` en el data URL sin tocar el payload. */
export function withAttachmentName(dataUrl: string, fileName: string): string {
  const parsed = parseTaskAttachment(dataUrl);
  if (!parsed) return dataUrl;
  const encoded = encodeURIComponent(
    sanitizeAttachmentName(fileName, parsed.kind)
  );
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl;
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma);
  const parts = header.split(';').filter(p => {
    const key = p.split('=')[0]?.trim().toLowerCase();
    return key !== 'name' && key !== 'filename';
  });
  const mime = parts[0] ?? parsed.mimeType;
  const rest = parts.slice(1);
  return `data:${[mime, `name=${encoded}`, ...rest].join(';')}${payload}`;
}

function coerceAttachmentItem(item: unknown): string | null {
  if (typeof item === 'string') return item.trim() || null;
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const dataUrl =
    typeof o.dataUrl === 'string'
      ? o.dataUrl
      : typeof o.data_url === 'string'
        ? o.data_url
        : null;
  if (!dataUrl) return null;
  const name = typeof o.name === 'string' ? o.name : '';
  return name ? withAttachmentName(dataUrl, name) : dataUrl;
}

/**
 * Normaliza adjuntos de una tarea (imágenes JPEG/PNG/WebP/GIF o PDF).
 * Acepta data URLs (legacy) u objetos `{ name, dataUrl }`.
 * Descarta entradas inválidas o demasiado grandes.
 */
export function normalizeTaskImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const item of raw) {
    const s = coerceAttachmentItem(item);
    if (!s) continue;
    const parsed = parseTaskAttachment(s);
    if (!parsed) continue;
    const canonical = parsed.dataUrl;
    if (seen.has(canonical)) continue;
    if (total + canonical.length > MAX_TASK_ATTACHMENTS_TOTAL_LENGTH) continue;
    seen.add(canonical);
    out.push(canonical);
    total += canonical.length;
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

export function attachmentKind(dataUrl: string): TaskAttachmentKind | null {
  return parseTaskAttachment(dataUrl)?.kind ?? null;
}

export function attachmentName(dataUrl: string): string {
  return parseTaskAttachment(dataUrl)?.name ?? 'archivo';
}

export function isPdfAttachment(dataUrl: string): boolean {
  return parseTaskAttachment(dataUrl)?.kind === 'pdf';
}

export function isImageAttachment(dataUrl: string): boolean {
  return parseTaskAttachment(dataUrl)?.kind === 'image';
}
