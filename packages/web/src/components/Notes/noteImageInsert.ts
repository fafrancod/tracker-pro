import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { countNoteImages, MAX_NOTE_IMAGES } from '@core/lib/notes';
import { compressImageToDataUrl } from '@/lib/imageCompress';
import { isImageFile } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';
import {
  normalizeWrap,
  type NoteImageAlign,
  type NoteImageBox,
  type NoteImageWrap,
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
            layout: 'flow',
            wrap: i % 2 === 0 ? 'left' : 'right',
            width: defaultW,
            indent: 0,
            x: null,
            y: null,
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
  const insertAt = pos + node.nodeSize;
  const ok = editor
    .chain()
    .insertContentAt(insertAt, {
      type: 'image',
      attrs: {
        ...node.attrs,
        layout: 'flow',
        wrap: normalizeWrap(node.attrs.wrap) === 'left' ? 'right' : 'left',
        indent: 0,
        x: null,
        y: null,
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
  const wrap: NoteImageWrap =
    align === 'left' ? 'left' : align === 'right' ? 'right' : 'below';
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        layout: 'flow',
        wrap,
        align: wrap === 'below' ? align : 'center',
        indent: 0,
        x: null,
        y: null,
      });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      dispatch?.(tr);
      return true;
    })
    .run();
}

export function moveImageNode(
  editor: Editor,
  from: number,
  dropPos: number,
  preferAfter: boolean,
  next: {
    wrap: NoteImageWrap;
    indent: number;
    align?: NoteImageAlign;
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
  const attrs = {
    ...node.attrs,
    layout: 'flow',
    wrap: next.wrap,
    indent: next.indent,
    align: next.align ?? (next.wrap === 'below' ? 'center' : node.attrs.align),
    x: null,
    y: null,
  };
  if (insertPos >= from && insertPos <= fromEnd) {
    return editor
      .chain()
      .command(({ tr, dispatch }) => {
        tr.setNodeMarkup(from, undefined, attrs);
        tr.setSelection(NodeSelection.create(tr.doc, from));
        dispatch?.(tr);
        return true;
      })
      .run();
  }

  const created = node.type.create(attrs, node.content, node.marks);
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

export function updateCanvasExtent(view: { dom: Element }): void {
  const pm = view.dom as HTMLElement;
  pm.style.minHeight = '';
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
