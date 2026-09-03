export const NOTE_IMAGE_ATTR = 'data-note-image';

export const NOTE_IMAGE_WRAPS = ['block', 'left', 'right'] as const;
export type NoteImageWrap = (typeof NOTE_IMAGE_WRAPS)[number];

export const NOTE_IMAGE_ALIGNS = ['left', 'center', 'right'] as const;
export type NoteImageAlign = (typeof NOTE_IMAGE_ALIGNS)[number];

export const MIN_NOTE_IMAGE_WIDTH = 64;
export const PLACE_ZONE = 0.34;

export function isNoteImageWrap(value: unknown): value is NoteImageWrap {
  return value === 'block' || value === 'left' || value === 'right';
}

export function isNoteImageAlign(value: unknown): value is NoteImageAlign {
  return value === 'left' || value === 'center' || value === 'right';
}

export function clipboardHtmlHasNoteImage(html: string): boolean {
  return html.includes('data-note-image') || html.includes('note-image-node');
}

export function wrapFromDropX(x: number, left: number, width: number): NoteImageWrap {
  if (width <= 0) return 'block';
  const t = (x - left) / width;
  if (t < PLACE_ZONE) return 'left';
  if (t > 1 - PLACE_ZONE) return 'right';
  return 'block';
}

export function alignFromDropX(x: number, left: number, width: number): NoteImageAlign {
  if (width <= 0) return 'center';
  const t = (x - left) / width;
  if (t < PLACE_ZONE) return 'left';
  if (t > 1 - PLACE_ZONE) return 'right';
  return 'center';
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

export function clampIndent(
  wrap: NoteImageWrap,
  indent: number,
  imageWidth: number,
  editorWidth: number
): number {
  if (wrap === 'block') return 0;
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

export function parsePxAttr(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
