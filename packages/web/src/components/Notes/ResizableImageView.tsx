import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Move,
  RotateCcw,
  Rows3,
  Scissors,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { imageFilesFromDataTransfer } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';
import {
  clampFreeX,
  clampFreeY,
  clampImageWidth,
  isFreeImage,
  snapFreePosition,
  snapImageWidth,
  type NoteImageGuide,
} from './noteImageLayout';
import {
  alignImageOnPage,
  boxFromDom,
  collectOtherImageBoxes,
  contentWidthOfEditor,
  duplicateImageAt,
  editorOriginRect,
  insertImageFiles,
  nextImageZ,
  selectImageAt,
  updateCanvasExtent,
} from './noteImageInsert';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD = 5;

type Translate = (key: TKey) => string;

async function writeImageClipboard(html: string, src: string): Promise<void> {
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const plain = new Blob([''], { type: 'text/plain' });
  if (src.startsWith('data:') && typeof ClipboardItem !== 'undefined') {
    try {
      const imgBlob = await (await fetch(src)).blob();
      if (imgBlob.type) {
        await navigator.clipboard.write([
          new ClipboardItem({ [imgBlob.type]: imgBlob, 'text/html': htmlBlob }),
        ]);
        return;
      }
    } catch {
      /* HTML basta para pegar en el editor */
    }
  }
  await navigator.clipboard.write([
    new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plain }),
  ]);
}

function outerNodeOf(frame: HTMLElement | null): HTMLElement | null {
  return frame?.closest('.note-image-node') as HTMLElement | null;
}

export function ResizableImageView({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const { t } = useT();
  const { showToast } = useToast();
  const editable = editor.isEditable;
  const free = isFreeImage(node.attrs);
  const storedWidth = typeof node.attrs.width === 'number' ? node.attrs.width : null;

  const frameRef = useRef<HTMLSpanElement>(null);
  const aspectRef = useRef(1);
  const draftRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const placeRef = useRef<{ x: number; y: number } | null>(null);

  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [guides, setGuides] = useState<NoteImageGuide[]>([]);
  const [sizeTip, setSizeTip] = useState<string | null>(null);

  const displayWidth = draftWidth ?? storedWidth;

  const clearLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const posOfNode = useCallback((): number | null => {
    const pos = getPos();
    return typeof pos === 'number' ? pos : null;
  }, [getPos]);

  const selectSelf = useCallback(() => {
    const pos = posOfNode();
    if (pos == null) return;
    selectImageAt(editor, pos);
  }, [editor, posOfNode]);

  useEffect(() => {
    if (!menu) return;
    function close(e: PointerEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-image-menu]')) return;
      setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const copyNode = useCallback(async () => {
    const pos = posOfNode();
    if (pos == null) return false;
    const current = editor.state.doc.nodeAt(pos);
    if (!current) return false;
    selectImageAt(editor, pos);
    const wrapEl = document.createElement('div');
    wrapEl.appendChild(DOMSerializer.fromSchema(editor.schema).serializeNode(current));
    try {
      await writeImageClipboard(wrapEl.innerHTML, String(current.attrs.src ?? ''));
      return true;
    } catch {
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
  }, [editor, posOfNode]);

  const duplicate = useCallback(() => {
    const pos = posOfNode();
    if (pos == null) return;
    duplicateImageAt(editor, pos, t, showToast);
    setMenu(null);
  }, [editor, posOfNode, showToast, t]);

  const cutNode = useCallback(async () => {
    const ok = await copyNode();
    if (ok) deleteNode();
    setMenu(null);
  }, [copyNode, deleteNode]);

  const pasteClipboard = useCallback(async () => {
    setMenu(null);
    editor.commands.focus();
    try {
      const items = await navigator.clipboard.read();
      const dt = new DataTransfer();
      let html = '';
      for (const item of items) {
        if (item.types.includes('text/html')) {
          html = await (await item.getType('text/html')).text();
        }
        const imgType = item.types.find(type => type.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          dt.items.add(new File([blob], 'clipboard.png', { type: blob.type || 'image/png' }));
        }
      }
      if (html && /<img/i.test(html) && dt.files.length === 0) {
        editor.chain().focus().insertContent(html).run();
        return;
      }
      const files = imageFilesFromDataTransfer(dt);
      if (files.length) {
        await insertImageFiles(editor, files, t, showToast);
      }
    } catch {
      showToast(t('notes_image_paste_blocked'), 'info');
    }
  }, [editor, showToast, t]);

  const resetSize = useCallback(() => {
    updateAttributes({ width: null });
    setDraftWidth(null);
    setMenu(null);
  }, [updateAttributes]);

  const setLayout = useCallback(
    (layout: 'free' | 'flow') => {
      if (layout === 'flow') {
        updateAttributes({ layout: 'flow', x: null, y: null });
        const outer = outerNodeOf(frameRef.current);
        if (outer) {
          outer.style.left = '';
          outer.style.top = '';
          outer.style.zIndex = '';
          outer.style.position = '';
        }
        setMenu(null);
        return;
      }
      const outer = outerNodeOf(frameRef.current);
      const origin = editorOriginRect(editor);
      const box = outer
        ? boxFromDom(outer, origin)
        : { x: 16, y: 24, width: 240, height: 160 };
      updateAttributes({
        layout: 'free',
        x: Math.round(box.x),
        y: Math.round(box.y),
        z: nextImageZ(editor),
      });
      setMenu(null);
    },
    [editor, updateAttributes]
  );

  const onHandleDown = (event: ReactPointerEvent, handle: Handle) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
    selectSelf();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = frameRef.current?.offsetWidth ?? storedWidth ?? 240;
    const aspect = aspectRef.current || 1;
    const editorW = contentWidthOfEditor(editor);
    const maxW = editorW;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let next = startW;
      if (handle === 'e' || handle === 'ne' || handle === 'se') next = startW + dx;
      else if (handle === 'w' || handle === 'nw' || handle === 'sw') next = startW - dx;
      else {
        const startH = startW / aspect;
        const nextH = handle === 'n' ? startH - dy : startH + dy;
        next = nextH * aspect;
      }
      if (ev.shiftKey) next = snapImageWidth(next, maxW, 18);
      else next = snapImageWidth(next, maxW);
      const clamped = clampImageWidth(next, maxW);
      draftRef.current = clamped;
      setDraftWidth(clamped);
      setSizeTip(`${clamped} × ${Math.round(clamped / aspect)}`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const committed = draftRef.current;
      draftRef.current = null;
      if (committed != null) updateAttributes({ width: committed });
      setDraftWidth(null);
      setSizeTip(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onFramePointerDown = (event: ReactPointerEvent) => {
    if (!editable) return;
    if ((event.target as HTMLElement).closest('[data-resize-handle],[data-image-toolbar]')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectSelf();
    if (event.button === 2) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const frame = frameRef.current;
    const outer = outerNodeOf(frame);
    if (!frame || !outer) return;
    const origin = editorOriginRect(editor);
    const startBox = boxFromDom(outer, origin);
    const selfPos = posOfNode();
    const others = selfPos == null ? [] : collectOtherImageBoxes(editor, selfPos);
    let started = false;

    clearLongPress();
    longPressRef.current = window.setTimeout(() => {
      setMenu({ x: event.clientX, y: event.clientY });
    }, LONG_PRESS_MS);

    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!started && dist < MOVE_THRESHOLD) return;
      started = true;
      clearLongPress();
      setPlacing(true);
      const liveOrigin = editorOriginRect(editor);
      let x = startBox.x + (ev.clientX - startX);
      let y = startBox.y + (ev.clientY - startY);
      let nextGuides: NoteImageGuide[] = [];
      if (!ev.altKey) {
        const snapped = snapFreePosition(
          x,
          y,
          startBox.width,
          startBox.height,
          others,
          liveOrigin.width
        );
        x = snapped.x;
        y = snapped.y;
        nextGuides = snapped.guides;
      } else {
        x = clampFreeX(x, startBox.width, liveOrigin.width);
        y = clampFreeY(y);
      }
      placeRef.current = { x, y };
      outer.style.position = 'absolute';
      outer.style.left = `${x}px`;
      outer.style.top = `${y}px`;
      outer.style.zIndex = '80';
      outer.dataset.layout = 'free';
      setGuides(nextGuides);
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      clearLongPress();
      setPlacing(false);
      setGuides([]);
      if (!started) return;
      const placed = placeRef.current;
      placeRef.current = null;
      if (!placed) return;
      updateAttributes({
        layout: 'free',
        x: placed.x,
        y: placed.y,
        z: nextImageZ(editor),
      });
      updateCanvasExtent(editor.view);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onContextMenu = (event: ReactMouseEvent) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    selectSelf();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const onDoubleClick = (event: ReactMouseEvent) => {
    if (!editable) return;
    event.preventDefault();
    resetSize();
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!editable || !selected) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteNode();
    }
  };

  useEffect(() => {
    if (!selected || !editable) return;
    function onKey(e: KeyboardEvent) {
      if (!editor.isActive('image')) return;
      const sel = editor.state.selection;
      if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const origin = editorOriginRect(editor);
      const outer = outerNodeOf(frameRef.current);
      const box = outer
        ? boxFromDom(outer, origin)
        : { x: 0, y: 0, width: 240, height: 160 };
      let x = box.x;
      let y = box.y;
      if (e.key === 'ArrowLeft') x -= step;
      else if (e.key === 'ArrowRight') x += step;
      else if (e.key === 'ArrowUp') y -= step;
      else if (e.key === 'ArrowDown') y += step;
      else return;
      e.preventDefault();
      updateAttributes({
        layout: 'free',
        x: clampFreeX(x, box.width, origin.width),
        y: clampFreeY(y),
        z: Number(node.attrs.z) || 1,
      });
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteNode, editable, editor, node.attrs.z, selected, updateAttributes]);

  const origin = placing ? editorOriginRect(editor) : null;

  return (
    <NodeViewWrapper as="div" className="note-image-shell" onKeyDown={onKeyDown}>
      <span
        ref={frameRef}
        className={cn(
          'note-image-frame',
          selected && editable && 'is-selected',
          placing && 'is-placing'
        )}
        style={displayWidth ? { width: displayWidth, maxWidth: '100%' } : { maxWidth: '100%' }}
        onPointerDown={onFramePointerDown}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
      >
        <img
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string) || t('notes_image')}
          title={node.attrs.title as string | undefined}
          draggable={false}
          className="note-editor-image"
          onLoad={event => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              aspectRef.current = img.naturalWidth / img.naturalHeight;
            }
          }}
        />
        {selected && editable ? (
          <>
            {HANDLES.map(handle => (
              <button
                key={handle}
                type="button"
                data-image-ui=""
                data-resize-handle={handle}
                aria-label={t('notes_image_resize')}
                className={cn('note-image-handle', `is-${handle}`)}
                onPointerDown={event => onHandleDown(event, handle)}
              />
            ))}
            <div className="note-image-toolbar" data-image-ui="" data-image-toolbar="">
              <div className="note-image-toolbar-group" role="group" aria-label={t('notes_image_layout')}>
                <button
                  type="button"
                  title={t('notes_image_layout_free')}
                  className={cn('note-image-tool', free && 'is-active')}
                  onClick={() => setLayout('free')}
                >
                  <Move className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('notes_image_layout_flow')}
                  className={cn('note-image-tool', !free && 'is-active')}
                  onClick={() => setLayout('flow')}
                >
                  <Rows3 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="note-image-toolbar-group">
                {(
                  [
                    ['left', AlignLeft, t('notes_image_align_left')],
                    ['center', AlignCenter, t('notes_image_align_center')],
                    ['right', AlignRight, t('notes_image_align_right')],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    className="note-image-tool"
                    onClick={() => {
                      const pos = posOfNode();
                      if (pos == null) return;
                      alignImageOnPage(editor, pos, value);
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <div className="note-image-toolbar-group">
                <button
                  type="button"
                  title={t('notes_image_copy')}
                  className="note-image-tool"
                  onClick={() => void copyNode()}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('notes_image_duplicate')}
                  className="note-image-tool"
                  onClick={duplicate}
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('notes_image_delete')}
                  className="note-image-tool is-danger"
                  onClick={() => deleteNode()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {sizeTip ? <span className="note-image-size">{sizeTip}</span> : null}
          </>
        ) : null}
      </span>
      {placing && origin && guides.length > 0
        ? createPortal(
            <SnapGuides origin={origin} guides={guides} />,
            document.body
          )
        : null}
      {menu && editable
        ? createPortal(
            <ImageContextMenu
              x={menu.x}
              y={menu.y}
              free={free}
              onLayout={setLayout}
              onAlign={value => {
                const pos = posOfNode();
                if (pos != null) alignImageOnPage(editor, pos, value);
                setMenu(null);
              }}
              onCopy={() => {
                void copyNode();
                setMenu(null);
              }}
              onCut={() => void cutNode()}
              onPaste={() => void pasteClipboard()}
              onDuplicate={duplicate}
              onReset={resetSize}
              onDelete={() => {
                deleteNode();
                setMenu(null);
              }}
              t={t}
            />,
            document.body
          )
        : null}
    </NodeViewWrapper>
  );
}

function SnapGuides({
  origin,
  guides,
}: {
  origin: DOMRect;
  guides: NoteImageGuide[];
}) {
  return (
    <div className="note-image-place-layer" data-image-ui="">
      {guides.map((guide, i) =>
        guide.axis === 'x' ? (
          <div
            key={`x-${i}-${guide.at}`}
            className="note-image-guide is-x"
            style={{ left: origin.left + guide.at, top: origin.top, height: origin.height }}
          />
        ) : (
          <div
            key={`y-${i}-${guide.at}`}
            className="note-image-guide is-y"
            style={{ top: origin.top + guide.at, left: origin.left, width: origin.width }}
          />
        )
      )}
    </div>
  );
}

function ImageContextMenu({
  x,
  y,
  free,
  onLayout,
  onAlign,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onReset,
  onDelete,
  t,
}: {
  x: number;
  y: number;
  free: boolean;
  onLayout: (layout: 'free' | 'flow') => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onDelete: () => void;
  t: Translate;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      data-image-ui=""
      data-image-menu=""
      className="note-image-menu"
      style={{ left: x, top: y }}
    >
      <button type="button" onClick={onCut}>
        <Scissors className="h-3.5 w-3.5" />
        {t('notes_image_cut')}
        <kbd>Ctrl+X</kbd>
      </button>
      <button type="button" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
        {t('notes_image_copy')}
        <kbd>Ctrl+C</kbd>
      </button>
      <button type="button" onClick={onPaste}>
        <ClipboardPaste className="h-3.5 w-3.5" />
        {t('notes_image_paste')}
        <kbd>Ctrl+V</kbd>
      </button>
      <button type="button" onClick={onDuplicate}>
        <CopyPlus className="h-3.5 w-3.5" />
        {t('notes_image_duplicate')}
        <kbd>Ctrl+D</kbd>
      </button>
      <div className="note-image-menu-sep" />
      <div className="note-image-menu-label">{t('notes_image_layout')}</div>
      <button type="button" className={cn(free && 'is-active')} onClick={() => onLayout('free')}>
        <Move className="h-3.5 w-3.5" />
        {t('notes_image_layout_free')}
      </button>
      <button type="button" className={cn(!free && 'is-active')} onClick={() => onLayout('flow')}>
        <Rows3 className="h-3.5 w-3.5" />
        {t('notes_image_layout_flow')}
      </button>
      <div className="note-image-menu-sep" />
      <button type="button" onClick={() => onAlign('left')}>
        <AlignLeft className="h-3.5 w-3.5" />
        {t('notes_image_align_left')}
      </button>
      <button type="button" onClick={() => onAlign('center')}>
        <AlignCenter className="h-3.5 w-3.5" />
        {t('notes_image_align_center')}
      </button>
      <button type="button" onClick={() => onAlign('right')}>
        <AlignRight className="h-3.5 w-3.5" />
        {t('notes_image_align_right')}
      </button>
      <div className="note-image-menu-sep" />
      <button type="button" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t('notes_image_reset')}
      </button>
      <button type="button" className="is-danger" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
        {t('notes_image_delete')}
        <kbd>Supr</kbd>
      </button>
    </div>
  );
}
