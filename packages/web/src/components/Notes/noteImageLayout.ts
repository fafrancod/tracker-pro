export const NOTE_IMAGE_ATTR = 'data-note-image';

export const NOTE_IMAGE_LAYOUTS = ['free', 'flow'] as const;
export type NoteImageLayout = (typeof NOTE_IMAGE_LAYOUTS)[number];

export const NOTE_IMAGE_ALIGNS = ['left', 'center', 'right'] as const;
export type NoteImageAlign = (typeof NOTE_IMAGE_ALIGNS)[number];

/** left/right = rodea un lado; center = texto a ambos lados; below = solo arriba y abajo */
export const NOTE_IMAGE_WRAPS = ['below', 'left', 'center', 'right'] as const;
export type NoteImageWrap = (typeof NOTE_IMAGE_WRAPS)[number];

export const PLACE_ZONE = 0.34;

export const MIN_NOTE_IMAGE_WIDTH = 64;
export const NOTE_IMAGE_GAP = 12;
export const NOTE_IMAGE_SNAP = 8;
export const NOTE_IMAGE_DUPLICATE_OFFSET = 28;

export type NoteImageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NoteImageGuide = {
  axis: 'x' | 'y';
  at: number;
};

export function isNoteImageLayout(value: unknown): value is NoteImageLayout {
  return value === 'free' || value === 'flow';
}

export function isNoteImageAlign(value: unknown): value is NoteImageAlign {
  return value === 'left' || value === 'center' || value === 'right';
}

export function isNoteImageWrap(value: unknown): value is NoteImageWrap {
  return value === 'below' || value === 'left' || value === 'center' || value === 'right';
}

export function normalizeWrap(value: unknown): NoteImageWrap {
  if (value === 'left' || value === 'right' || value === 'center') return value;
  if (value === 'below' || value === 'block') return 'below';
  return 'left';
}

export function wrapFromDropX(x: number, left: number, width: number): NoteImageWrap {
  if (width <= 0) return 'center';
  const t = (x - left) / width;
  if (t < PLACE_ZONE) return 'left';
  if (t > 1 - PLACE_ZONE) return 'right';
  return 'center';
}

export function wrapFromStoredX(
  x: number,
  imageWidth: number,
  editorWidth: number
): NoteImageWrap {
  return wrapFromDropX(x + imageWidth / 2, 0, editorWidth);
}

export function clampIndent(
  wrap: NoteImageWrap,
  indent: number,
  imageWidth: number,
  editorWidth: number
): number {
  if (wrap === 'below' || wrap === 'center') return 0;
  const max = Math.max(0, editorWidth - imageWidth - 8);
  return Math.round(Math.min(max, Math.max(0, indent)));
}

export function indentFromDrop(
  wrap: NoteImageWrap,
  imageLeft: number,
  imageWidth: number,
  editorLeft: number,
  editorWidth: number
): number {
  if (wrap === 'left') {
    return clampIndent(wrap, imageLeft - editorLeft, imageWidth, editorWidth);
  }
  if (wrap === 'right') {
    const imageRight = imageLeft + imageWidth;
    const editorRight = editorLeft + editorWidth;
    return clampIndent(wrap, editorRight - imageRight, imageWidth, editorWidth);
  }
  return 0;
}

export function clipboardHtmlHasNoteImage(html: string): boolean {
  return html.includes('data-note-image') || html.includes('note-image-node');
}

export function isFreeImage(attrs: {
  layout?: unknown;
  x?: unknown;
  y?: unknown;
}): boolean {
  if (attrs.layout === 'flow') return false;
  return typeof attrs.x === 'number' && typeof attrs.y === 'number';
}

export function clampImageWidth(width: number, editorWidth: number): number {
  const max = Math.max(MIN_NOTE_IMAGE_WIDTH, Math.floor(editorWidth));
  return Math.round(Math.min(max, Math.max(MIN_NOTE_IMAGE_WIDTH, width)));
}

export function snapImageWidth(width: number, editorWidth: number, threshold = 12): number {
  const clamped = clampImageWidth(width, editorWidth);
  if (editorWidth <= 0) return clamped;
  const snaps = [0.25, 0.5, 0.75, 1].map(ratio => Math.round(editorWidth * ratio));
  for (const snap of snaps) {
    if (Math.abs(clamped - snap) <= threshold) {
      return clampImageWidth(snap, editorWidth);
    }
  }
  return clamped;
}

export function parsePxAttr(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseCoord(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function clampFreeX(x: number, width: number, editorWidth: number): number {
  const max = Math.max(0, editorWidth - width);
  return Math.round(Math.min(max, Math.max(0, x)));
}

export function clampFreeY(y: number): number {
  return Math.round(Math.max(0, y));
}

function closest(
  value: number,
  candidates: { value: number; guide: number }[],
  threshold: number
): { value: number; guide: number } | null {
  let best: { value: number; guide: number } | null = null;
  let bestDist = threshold + 1;
  for (const candidate of candidates) {
    const dist = Math.abs(value - candidate.value);
    if (dist <= threshold && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Encaja x/y con márgenes de página y con otras imágenes (bordes, centros y hueco fijo).
 * Alt desactiva el snap en el llamador.
 */
export function snapFreePosition(
  x: number,
  y: number,
  w: number,
  h: number,
  others: NoteImageBox[],
  editorWidth: number,
  threshold = NOTE_IMAGE_SNAP
): { x: number; y: number; guides: NoteImageGuide[] } {
  const xCandidates: { value: number; guide: number }[] = [
    { value: 0, guide: 0 },
    { value: Math.round((editorWidth - w) / 2), guide: Math.round(editorWidth / 2) },
    { value: editorWidth - w, guide: editorWidth },
  ];
  const yCandidates: { value: number; guide: number }[] = [{ value: 0, guide: 0 }];

  for (const other of others) {
    const cx = other.x + other.width / 2;
    const cy = other.y + other.height / 2;
    xCandidates.push(
      { value: other.x, guide: other.x },
      { value: other.x + other.width - w, guide: other.x + other.width },
      { value: Math.round(cx - w / 2), guide: Math.round(cx) },
      { value: other.x + other.width + NOTE_IMAGE_GAP, guide: other.x + other.width },
      { value: other.x - w - NOTE_IMAGE_GAP, guide: other.x }
    );
    yCandidates.push(
      { value: other.y, guide: other.y },
      { value: other.y + other.height - h, guide: other.y + other.height },
      { value: Math.round(cy - h / 2), guide: Math.round(cy) },
      { value: other.y + other.height + NOTE_IMAGE_GAP, guide: other.y + other.height },
      { value: other.y - h - NOTE_IMAGE_GAP, guide: other.y }
    );
  }

  const hitX = closest(x, xCandidates, threshold);
  const hitY = closest(y, yCandidates, threshold);
  const nextX = clampFreeX(hitX ? hitX.value : x, w, editorWidth);
  const nextY = clampFreeY(hitY ? hitY.value : y);
  const guides: NoteImageGuide[] = [];
  if (hitX) guides.push({ axis: 'x', at: hitX.guide });
  if (hitY) guides.push({ axis: 'y', at: hitY.guide });
  return { x: nextX, y: nextY, guides };
}

export function pageAlignX(
  align: NoteImageAlign,
  width: number,
  editorWidth: number
): number {
  if (align === 'left') return 0;
  if (align === 'right') return clampFreeX(editorWidth - width, width, editorWidth);
  return clampFreeX(Math.round((editorWidth - width) / 2), width, editorWidth);
}
