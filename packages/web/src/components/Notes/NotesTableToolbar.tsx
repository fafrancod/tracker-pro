import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Columns3,
  Rows3,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TKey } from '@/lib/i18n';

const MAX = 6;

type Translate = (key: TKey) => string;

export function NotesTableToolbar({
  editor,
  editable,
  t,
}: {
  editor: Editor;
  editable: boolean;
  t: Translate;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ rows: 3, cols: 3 });
  const boxRef = useRef<HTMLDivElement>(null);
  const inTable = editor.isActive('table');

  useEffect(() => {
    if (!open) return;
    function close(e: PointerEvent) {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function insert() {
    editor
      .chain()
      .focus()
      .insertTable({ rows: hover.rows, cols: hover.cols, withHeaderRow: true })
      .run();
    setOpen(false);
  }

  return (
    <div className="relative flex items-center gap-0.5" ref={boxRef}>
      <button
        type="button"
        title={t('notes_table_insert')}
        aria-label={t('notes_table_insert')}
        disabled={!editable}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'rounded-md p-1.5 text-text-muted transition-colors hover:bg-background hover:text-text-primary disabled:opacity-40',
          (open || inTable) && 'bg-accent-teal/15 text-accent-teal'
        )}
      >
        <TableIcon className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {hover.rows} × {hover.cols}
          </div>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${MAX}, 1.1rem)` }}
          >
            {Array.from({ length: MAX * MAX }, (_, i) => {
              const r = Math.floor(i / MAX) + 1;
              const c = (i % MAX) + 1;
              const on = r <= hover.rows && c <= hover.cols;
              return (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    'h-4 w-4 rounded-[3px] border',
                    on
                      ? 'border-accent-teal bg-accent-teal/30'
                      : 'border-border bg-background'
                  )}
                  onMouseEnter={() => setHover({ rows: r, cols: c })}
                  onClick={insert}
                />
              );
            })}
          </div>
        </div>
      ) : null}
      {inTable ? (
        <>
          <button
            type="button"
            title={t('notes_table_add_row')}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t('notes_table_add_col')}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t('notes_table_del_row')}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Rows3 className="h-4 w-4 opacity-50" />
          </button>
          <button
            type="button"
            title={t('notes_table_del_col')}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <Columns3 className="h-4 w-4 opacity-50" />
          </button>
          <button
            type="button"
            title={t('notes_table_del')}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-rose-500"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
