import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  CopyPlus,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { countNoteImages, emptyNoteDoc, MAX_NOTE_IMAGES } from '@core/lib/notes';
import type { NoteContent } from '@core/types';
import { imageFilesFromDataTransfer } from '@/lib/attachmentFiles';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { ResizableImage } from './resizableImage';
import { clipboardHtmlHasNoteImage } from './noteImageLayout';
import { duplicateImageAt, insertImageFiles } from './noteImageInsert';
import { NotesTableToolbar } from './NotesTableToolbar';

interface NotesEditorProps {
  noteId: string;
  content: NoteContent | null;
  editable?: boolean;
  placeholder?: string;
  onChange: (content: NoteContent) => void;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 text-text-muted transition-colors hover:bg-background hover:text-text-primary disabled:opacity-40',
        active && 'bg-accent-teal/15 text-accent-teal'
      )}
    >
      {children}
    </button>
  );
}

export function NotesEditor({
  noteId,
  content,
  editable = true,
  placeholder = 'Escribe tu idea…',
  onChange,
}: NotesEditorProps) {
  const { t } = useT();
  const { showToast } = useToast();
  const composing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const insertRef = useRef<(files: File[]) => Promise<void>>(async () => undefined);
  const limitToastRef = useRef<() => void>(() => undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'note-editor-image',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: content ?? emptyNoteDoc(),
    editable,
    editorProps: {
      attributes: {
        class: 'note-editor-surface focus:outline-none',
      },
      handleDOMEvents: {
        compositionstart: () => {
          composing.current = true;
          return false;
        },
        compositionend: () => {
          composing.current = false;
          return false;
        },
      },
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html') ?? '';
        if (clipboardHtmlHasNoteImage(html)) {
          if (countNoteImages(view.state.doc.toJSON()) >= MAX_NOTE_IMAGES) {
            event.preventDefault();
            limitToastRef.current();
            return true;
          }
          return false;
        }
        const files = imageFilesFromDataTransfer(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = imageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (composing.current) return;
      onChange(ed.getJSON() as NoteContent);
    },
  });

  useEffect(() => {
    insertRef.current = async (files: File[]) => {
      if (!editor || !editable) return;
      setBusy(true);
      try {
        await insertImageFiles(editor, files, t, showToast);
      } finally {
        setBusy(false);
      }
    };
    limitToastRef.current = () => {
      showToast(
        t('notes_image_limit').replace('{n}', String(MAX_NOTE_IMAGES)),
        'error'
      );
    };
  }, [editor, editable, t, showToast]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content ?? emptyNoteDoc(), false);
  }, [editor, noteId]);

  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  function onPickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    void insertRef.current(Array.from(list));
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPaste={e => {
        if ((e.target as HTMLElement).closest('.ProseMirror')) return;
        const files = imageFilesFromDataTransfer(e.clipboardData);
        if (files.length === 0) return;
        e.preventDefault();
        void insertRef.current(files);
      }}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1">
        <ToolbarButton
          label="Deshacer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Rehacer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Título 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Título 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Título 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Negrita"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Tachado"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Resaltar"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Lista"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Alinear izquierda"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Centrar"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Alinear derecha"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Enlace" active={editor.isActive('link')} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('notes_image_upload')}
          disabled={!editable || busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <NotesTableToolbar editor={editor} editable={editable} t={t} />
        <ToolbarButton
          label={t('notes_code_block')}
          active={editor.isActive('codeBlock')}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive('image') ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton
              label={t('notes_image_duplicate')}
              onClick={() =>
                duplicateImageAt(editor, editor.state.selection.from, t, showToast)
              }
            >
              <CopyPlus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label={t('notes_image_delete')}
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        ) : null}
        <span className="ml-auto hidden px-1 text-[10px] text-text-muted sm:inline">
          {busy ? t('notes_image_compressing') : t('notes_image_paste_hint')}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => onPickFiles(e.target.files)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        <EditorContent editor={editor} className="note-editor h-full" />
      </div>
    </div>
  );
}
