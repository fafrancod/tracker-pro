import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { countNoteImages, MAX_NOTE_IMAGES } from '@core/lib/notes';
import { compressImageToDataUrl } from '@/lib/imageCompress';
import { isImageFile } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';
import {
  NOTE_IMAGE_DUPLICATE_OFFSET,
  isFreeImage,
  pageAlignX,
  parseCoord,
  type NoteImageAlign,
  type NoteImageBox,
} from './noteImageLayout';

type Translate = (key: TKey) => string;
type ToastFn = (msg: string, kind: 'error' | 'success' | 'info') => void;

const MIN_FALLBACK = 160;

export function contentWidthOfEditor(editor: Editor): number {
  const el = editor.view.dom as HTMLElement;
  const style = window.getComputedStyle(el);
  const pad =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(MIN_FALLBACK, el.clientWidth - pad);
}

export function remainingNoteImageSlots(editor: Editor): number {
  return Math.max(0, MAX_NOTE_IMAGES - countNoteImages(editor.getJSON()));
}

export function nextImageZ(editor: Editor): number {
  let max = 1;
  editor.state.doc.descendants(node => {
    if (node.type.name !== 'image') return;
    const z = Number(node.attrs.z) || 1;
    if (z > max) max = z;
  });
  return max + 1;
}

export function editorOriginRect(editor: Editor): DOMRect {
  return (editor.view.dom as HTMLElement).getBoundingClientRect();
}

export function boxFromDom(el: HTMLElement, origin: DOMRect): NoteImageBox {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - origin.left,
    y: r.top - origin.top,
    width: r.width,
    height: r.height,
  };
}

export function collectOtherImageBoxes(editor: Editor, selfPos: number): NoteImageBox[] {
  const origin = editorOriginRect(editor);
  const out: NoteImageBox[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image' || pos === selfPos) return;
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;
    out.push(boxFromDom(dom, origin));
  });
  return out;
}

export function coordsForNewImage(
  editor: Editor,
  indexInBatch = 0
): { x: number; y: number; z: number } {
  const origin = editorOriginRect(editor);
  let x = 16;
  let y = 24;
  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    x = Math.max(0, Math.round(coords.left - origin.left));
    y = Math.max(0, Math.round(coords.top - origin.top));
  } catch {
    /* cursor fuera de rango */
  }
  return {
    x: x + indexInBatch * NOTE_IMAGE_DUPLICATE_OFFSET,
    y: y + indexInBatch * NOTE_IMAGE_DUPLICATE_OFFSET,
    z: nextImageZ(editor) + indexInBatch,
  };
}

export async function insertImageFiles(
  editor: Editor,
  files: File[],
  t: Translate,
  showToast: ToastFn
): Promise<void> {
  const images = files.filter(isImageFile);
  if (images.length === 0) {
    showToast(t('notes_image_not_image'), 'error');
    return;
  }
  const remaining = remainingNoteImageSlots(editor);
  if (remaining <= 0) {
    showToast(t('notes_image_limit').replace('{n}', String(MAX_NOTE_IMAGES)), 'error');
    return;
  }
  const toAdd = images.slice(0, remaining);
  if (images.length > remaining) {
    showToast(t('notes_image_limit').replace('{n}', String(MAX_NOTE_IMAGES)), 'error');
  }
  let lastPos: number | null = null;
  for (let i = 0; i < toAdd.length; i += 1) {
    const file = toAdd[i];
    try {
      const dataUrl = await compressImageToDataUrl(file, {
        maxEdge: 960,
        quality: 0.72,
        maxDataUrlLength: 220_000,
      });
      const place = coordsForNewImage(editor, i);
      const editorW = contentWidthOfEditor(editor);
      const defaultW = Math.round(Math.min(360, editorW * 0.42));
      const ok = editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: {
            src: dataUrl,
            alt: file.name || t('notes_image'),
            layout: 'free',
            width: defaultW,
            x: place.x,
            y: place.y,
            z: place.z,
          },
        })
        .run();
      if (ok) {
        const pos = findSelectedOrLastImagePos(editor);
        if (pos != null) lastPos = pos;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('notes_image_error');
      showToast(msg, 'error');
    }
  }
  if (lastPos != null) {
    selectImageAt(editor, lastPos);
  }
}

export function duplicateImageAt(
  editor: Editor,
  pos: number,
  t?: Translate,
  showToast?: ToastFn
): boolean {
  if (remainingNoteImageSlots(editor) <= 0) {
    const msg = t?.('notes_image_limit').replace('{n}', String(MAX_NOTE_IMAGES));
    if (msg) showToast?.(msg, 'error');
    return false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return false;
  const origin = editorOriginRect(editor);
  const dom = editor.view.nodeDOM(pos);
  let x = parseCoord(node.attrs.x) ?? 24;
  let y = parseCoord(node.attrs.y) ?? 24;
  if (dom instanceof HTMLElement) {
    const box = boxFromDom(dom, origin);
    x = box.x;
    y = box.y;
  }
  const insertAt = pos + node.nodeSize;
  const ok = editor
    .chain()
    .insertContentAt(insertAt, {
      type: 'image',
      attrs: {
        ...node.attrs,
        layout: 'free',
        x: x + NOTE_IMAGE_DUPLICATE_OFFSET,
        y: y + NOTE_IMAGE_DUPLICATE_OFFSET,
        z: nextImageZ(editor),
      },
    })
    .run();
  if (ok) selectImageAt(editor, insertAt);
  return ok;
}

export function alignImageOnPage(
  editor: Editor,
  pos: number,
  align: NoteImageAlign
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return false;
  const origin = editorOriginRect(editor);
  const dom = editor.view.nodeDOM(pos);
  const width =
    dom instanceof HTMLElement ? dom.getBoundingClientRect().width : Number(node.attrs.width) || 240;
  let y = parseCoord(node.attrs.y) ?? 24;
  if (dom instanceof HTMLElement) {
    y = boxFromDom(dom, origin).y;
  }
  const x = pageAlignX(align, width, origin.width);
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        layout: 'free',
        x,
        y,
        z: isFreeImage(node.attrs) ? node.attrs.z : nextImageZ(editor),
      });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      dispatch?.(tr);
      return true;
    })
    .run();
}

export function updateCanvasExtent(view: { dom: Element }): void {
  const pm = view.dom as HTMLElement;
  let max = pm.clientHeight;
  pm.querySelectorAll('.note-image-node[data-layout="free"]').forEach(node => {
    const el = node as HTMLElement;
    max = Math.max(max, el.offsetTop + el.offsetHeight + 48);
  });
  pm.style.minHeight = `${max}px`;
}

export function selectImageAt(editor: Editor, pos: number): void {
  try {
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return;
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
    editor.view.dispatch(tr);
    editor.view.focus();
  } catch {
    /* nodo ya no está */
  }
}

function findSelectedOrLastImagePos(editor: Editor): number | null {
  const { selection, doc } = editor.state;
  const at = doc.nodeAt(selection.from);
  if (at?.type.name === 'image') return selection.from;
  const before = doc.nodeAt(selection.from - 1);
  if (before?.type.name === 'image') return selection.from - before.nodeSize;
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name === 'image') found = pos;
  });
  return found;
}
