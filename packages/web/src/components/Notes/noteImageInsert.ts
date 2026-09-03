import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { countNoteImages, MAX_NOTE_IMAGES } from '@core/lib/notes';
import { compressImageToDataUrl } from '@/lib/imageCompress';
import { isImageFile } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';
import type { NoteImageAlign, NoteImageWrap } from './noteImageLayout';

type Translate = (key: TKey) => string;
type ToastFn = (msg: string, kind: 'error' | 'success' | 'info') => void;

export function contentWidthOfEditor(editor: Editor): number {
  const el = editor.view.dom as HTMLElement;
  const style = window.getComputedStyle(el);
  const pad =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(MIN_FALLBACK, el.clientWidth - pad);
}

const MIN_FALLBACK = 160;

export function remainingNoteImageSlots(editor: Editor): number {
  return Math.max(0, MAX_NOTE_IMAGES - countNoteImages(editor.getJSON()));
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
  for (const file of toAdd) {
    try {
      const dataUrl = await compressImageToDataUrl(file, {
        maxEdge: 960,
        quality: 0.72,
        maxDataUrlLength: 220_000,
      });
      const ok = editor
        .chain()
        .focus()
        .setImage({ src: dataUrl, alt: file.name || t('notes_image') })
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
  const insertAt = pos + node.nodeSize;
  const ok = editor
    .chain()
    .insertContentAt(insertAt, { type: 'image', attrs: { ...node.attrs } })
    .run();
  if (ok) selectImageAt(editor, insertAt);
  return ok;
}

export function moveImageNode(
  editor: Editor,
  from: number,
  dropPos: number,
  preferAfter: boolean,
  next: {
    wrap: NoteImageWrap;
    align: NoteImageAlign;
    indent: number;
  }
): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(from);
  if (!node || node.type.name !== 'image') return false;

  const maxPos = state.doc.content.size;
  const safeDrop = Math.max(0, Math.min(dropPos, maxPos));
  const $drop = state.doc.resolve(safeDrop);
  let insertPos =
    $drop.depth === 0 ? $drop.pos : preferAfter ? $drop.after(1) : $drop.before(1);
  insertPos = Math.max(0, Math.min(insertPos, maxPos));

  const fromEnd = from + node.nodeSize;
  if (insertPos >= from && insertPos <= fromEnd) {
    return editor
      .chain()
      .command(({ tr, dispatch }) => {
        tr.setNodeMarkup(from, undefined, { ...node.attrs, ...next });
        tr.setSelection(NodeSelection.create(tr.doc, from));
        dispatch?.(tr);
        return true;
      })
      .run();
  }

  const created = node.type.create({ ...node.attrs, ...next }, node.content, node.marks);
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      tr.delete(from, fromEnd);
      const mapped = tr.mapping.map(insertPos);
      const pos = Math.max(0, Math.min(mapped, tr.doc.content.size));
      try {
        tr.insert(pos, created);
      } catch {
        return false;
      }
      const sel = Math.min(pos, tr.doc.content.size - created.nodeSize);
      if (sel >= 0) {
        try {
          tr.setSelection(NodeSelection.create(tr.doc, sel));
        } catch {
          /* ignore */
        }
      }
      dispatch?.(tr);
      return true;
    })
    .run();
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
