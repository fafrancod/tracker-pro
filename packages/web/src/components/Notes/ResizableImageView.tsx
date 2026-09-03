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
  RotateCcw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { imageFilesFromDataTransfer } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';
import {
  clampImageWidth,
  indentFromDrop,
  normalizeWrap,
  snapFreePosition,
  snapImageWidth,
  wrapFromDropX,
  wrapFromStoredX,
  type NoteImageGuide,
  type NoteImageWrap,
} from './noteImageLayout';
import {
  alignImageOnPage,
  boxFromDom,
  collectOtherImageBoxes,
  contentWidthOfEditor,
  duplicateImageAt,
  editorOriginRect,
  insertImageFiles,
  moveImageNode,
  selectImageAt,
} from './noteImageInsert';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD = 5;

type Translate = (key: TKey) => string;

function WrapGlyph({ wrap }: { wrap: NoteImageWrap }) {
  if (wrap === 'left') {
    return (
      <svg viewBox="0 0 20 16" className="h-3.5 w-4" aria-hidden>
        <rect x="1" y="1" width="7" height="8" rx="1" fill="currentColor" />
        <path
          d="M10 2.2h9M10 5h9M10 7.8h6M1 11.5h18M1 14.2h18"
          stroke="currentColor"
          strokeWidth="1.35"
          fill="none"
        />
      </svg>
    );
  }
  if (wrap === 'right') {
    return (
      <svg viewBox="0 0 20 16" className="h-3.5 w-4" aria-hidden>
        <rect x="12" y="1" width="7" height="8" rx="1" fill="currentColor" />
        <path
          d="M1 2.2h9M1 5h9M3 7.8h7M1 11.5h18M1 14.2h18"
          stroke="currentColor"
          strokeWidth="1.35"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 16" className="h-3.5 w-4" aria-hidden>
      <rect x="5.5" y="1" width="9" height="6.5" rx="1" fill="currentColor" />
      <path d="M1 10.2h18M1 13.2h18" stroke="currentColor" strokeWidth="1.35" fill="none" />
    </svg>
  );
}

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
  const wrap = normalizeWrap(node.attrs.wrap);
  const storedWidth = typeof node.attrs.width === 'number' ? node.attrs.width : null;

  const frameRef = useRef<HTMLSpanElement>(null);
  const aspectRef = useRef(1);
  const draftRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const placeRef = useRef<{
    x: number;
    y: number;
    wrap: NoteImageWrap;
    width: number;
    height: number;
  } | null>(null);

  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [placing, setPlacing] = useState<{
    x: number;
    y: number;
    wrap: NoteImageWrap;
    width: number;
    height: number;
  } | null>(null);
  const [guides, setGuides] = useState<NoteImageGuide[]>([]);
  const [sizeTip, setSizeTip] = useState<string | null>(null);

  useEffect(() => {
    if (node.attrs.layout !== 'free') return;
    const x = node.attrs.x;
    if (typeof x !== 'number') {
      updateAttributes({ layout: 'flow', wrap: normalizeWrap(node.attrs.wrap), x: null, y: null });
      return;
    }
    const origin = editorOriginRect(editor);
    const w = typeof node.attrs.width === 'number' ? node.attrs.width : 240;
    updateAttributes({
      layout: 'flow',
      wrap: wrapFromStoredX(x, w, origin.width),
      indent: 0,
      x: null,
      y: null,
    });
  }, [editor, node.attrs.layout, node.attrs.x, node.attrs.width, node.attrs.wrap, updateAttributes]);

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

  const applyWrap = useCallback(
    (next: NoteImageWrap) => {
      updateAttributes({
        wrap: next,
        indent: 0,
        layout: 'flow',
        x: null,
        y: null,
        align: next === 'below' ? 'center' : node.attrs.align,
      });
      const outer = outerNodeOf(frameRef.current);
      if (outer) {
        outer.style.left = '';
        outer.style.top = '';
        outer.style.position = '';
        outer.style.zIndex = '';
      }
      setMenu(null);
    },
    [node.attrs.align, updateAttributes]
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
    const maxW = wrap === 'below' ? editorW : Math.floor(editorW * 0.72);

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
    const grabX = event.clientX - (frame.getBoundingClientRect().left);
    const grabY = event.clientY - (frame.getBoundingClientRect().top);
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
      const liveOrigin = editorOriginRect(editor);
      let imgLeft = ev.clientX - grabX;
      let imgTop = ev.clientY - grabY;
      let nextGuides: NoteImageGuide[] = [];
      let x = imgLeft - liveOrigin.left;
      let y = imgTop - liveOrigin.top;
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
        imgLeft = liveOrigin.left + x;
        imgTop = liveOrigin.top + y;
        nextGuides = snapped.guides;
      }
      const nextWrap = wrapFromDropX(
        imgLeft + startBox.width / 2,
        liveOrigin.left,
        liveOrigin.width
      );
      const ghost = {
        x: imgLeft,
        y: imgTop,
        wrap: nextWrap,
        width: startBox.width,
        height: startBox.height,
      };
      placeRef.current = ghost;
      setPlacing(ghost);
      setGuides(nextGuides);
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      clearLongPress();
      setPlacing(null);
      setGuides([]);
      if (!started) return;
      const placed = placeRef.current;
      placeRef.current = null;
      const from = posOfNode();
      if (!placed || from == null) return;
      const liveOrigin = editorOriginRect(editor);
      const indent = indentFromDrop(
        placed.wrap,
        placed.x,
        placed.width,
        liveOrigin.left,
        liveOrigin.width
      );
      const coords = editor.view.posAtCoords({ left: ev.clientX, top: ev.clientY });
      if (!coords) {
        updateAttributes({ wrap: placed.wrap, indent, layout: 'flow', x: null, y: null });
        return;
      }
      let preferAfter = true;
      try {
        const $pos = editor.state.doc.resolve(coords.pos);
        if ($pos.depth >= 1) {
          const before = editor.view.coordsAtPos($pos.before(1));
          const after = editor.view.coordsAtPos($pos.after(1));
          preferAfter = ev.clientY > (before.top + after.bottom) / 2;
        }
      } catch {
        preferAfter = true;
      }
      moveImageNode(editor, from, coords.pos, preferAfter, {
        wrap: placed.wrap,
        indent,
        align: placed.wrap === 'below' ? 'center' : undefined,
      });
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
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        applyWrap('left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        applyWrap('right');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        applyWrap('below');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [applyWrap, deleteNode, editable, editor, selected]);

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
              <div className="note-image-toolbar-group" role="group" aria-label={t('notes_image_wrap')}>
                {(['left', 'below', 'right'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    title={
                      mode === 'left'
                        ? t('notes_image_wrap_left')
                        : mode === 'right'
                          ? t('notes_image_wrap_right')
                          : t('notes_image_wrap_below')
                    }
                    className={cn('note-image-tool', wrap === mode && 'is-active')}
                    onClick={() => applyWrap(mode)}
                  >
                    <WrapGlyph wrap={mode} />
                  </button>
                ))}
              </div>
              {wrap === 'below' ? (
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
                      className={cn(
                        'note-image-tool',
                        node.attrs.align === value && 'is-active'
                      )}
                      onClick={() =>
                        updateAttributes({ wrap: 'below', align: value, indent: 0 })
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}
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
      {placing
        ? createPortal(
            <PlaceOverlay placing={placing} origin={origin} guides={guides} t={t} />,
            document.body
          )
        : null}
      {menu && editable
        ? createPortal(
            <ImageContextMenu
              x={menu.x}
              y={menu.y}
              wrap={wrap}
              onWrap={applyWrap}
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

function PlaceOverlay({
  placing,
  origin,
  guides,
  t,
}: {
  placing: {
    x: number;
    y: number;
    wrap: NoteImageWrap;
    width: number;
    height: number;
  };
  origin: DOMRect | null;
  guides: NoteImageGuide[];
  t: Translate;
}) {
  const label =
    placing.wrap === 'left'
      ? t('notes_image_wrap_left')
      : placing.wrap === 'right'
        ? t('notes_image_wrap_right')
        : t('notes_image_wrap_below');
  return (
    <div className="note-image-place-layer" data-image-ui="">
      <div
        className="note-image-ghost"
        style={{
          left: placing.x,
          top: placing.y,
          width: placing.width,
          height: placing.height,
        }}
      />
      <div
        className="note-image-place-chip"
        style={{ left: placing.x, top: Math.max(8, placing.y - 28) }}
      >
        {label}
      </div>
      {origin
        ? guides.map((guide, i) =>
            guide.axis === 'x' ? (
              <div
                key={`x-${i}-${guide.at}`}
                className="note-image-guide is-x"
                style={{
                  left: origin.left + guide.at,
                  top: origin.top,
                  height: origin.height,
                }}
              />
            ) : (
              <div
                key={`y-${i}-${guide.at}`}
                className="note-image-guide is-y"
                style={{
                  top: origin.top + guide.at,
                  left: origin.left,
                  width: origin.width,
                }}
              />
            )
          )
        : null}
    </div>
  );
}

function ImageContextMenu({
  x,
  y,
  wrap,
  onWrap,
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
  wrap: NoteImageWrap;
  onWrap: (wrap: NoteImageWrap) => void;
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
      <div className="note-image-menu-label">{t('notes_image_wrap')}</div>
      {(['left', 'below', 'right'] as const).map(mode => (
        <button
          key={mode}
          type="button"
          className={cn(wrap === mode && 'is-active')}
          onClick={() => onWrap(mode)}
        >
          <WrapGlyph wrap={mode} />
          {mode === 'left'
            ? t('notes_image_wrap_left')
            : mode === 'right'
              ? t('notes_image_wrap_right')
              : t('notes_image_wrap_below')}
        </button>
      ))}
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
