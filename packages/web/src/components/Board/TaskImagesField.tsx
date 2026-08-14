import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ChevronsRight, FilePlus, FileText, Loader2, PanelRightClose, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useTaskAttachmentFiles } from '@/hooks/useTaskAttachmentFiles';
import {
  MAX_TASK_IMAGES,
  isPdfAttachment,
  parseTaskAttachment,
} from '@core/lib/taskImages';

interface TaskImagesFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** compact = form de creación; full = detalle */
  compact?: boolean;
  /** field = bloque en el formulario; pane = columna derecha del modal */
  variant?: 'field' | 'pane';
  onExpand?: () => void;
  onCollapse?: () => void;
  onAdded?: (lastSrc: string) => void;
  /** Fuerza la vista previa (panel derecho). */
  selectedSrc?: string | null;
  onSelect?: (src: string) => void;
  className?: string;
}

export function TaskImagesField({
  images,
  onChange,
  compact = false,
  variant = 'field',
  onExpand,
  onCollapse,
  onAdded,
  selectedSrc,
  onSelect,
  className,
}: TaskImagesFieldProps) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    variant === 'pane' ? (images[0] ?? null) : null
  );

  const { addFiles, busy, remaining } = useTaskAttachmentFiles(images, onChange, {
    onAdded: lastSrc => {
      if (variant === 'pane') setPreview(lastSrc);
      onAdded?.(lastSrc);
    },
  });

  useEffect(() => {
    if (selectedSrc && images.includes(selectedSrc)) {
      setPreview(selectedSrc);
      return;
    }
    if (variant === 'pane') {
      if (preview && !images.includes(preview)) {
        setPreview(images[images.length - 1] ?? null);
      } else if (!preview && images.length > 0) {
        setPreview(images[0]);
      }
    } else if (preview && !images.includes(preview)) {
      setPreview(null);
    }
  }, [images, preview, variant, selectedSrc]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (busy) return;
    void addFiles(e.dataTransfer.files).finally(() => {
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  function bindDropTarget() {
    return {
      onDragEnter: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      },
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      },
      onDragLeave: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      },
      onDrop,
    };
  }

  function removeAt(index: number) {
    const next = images.filter((_, i) => i !== index);
    onChange(next);
    if (images[index] === preview) setPreview(next[Math.max(0, index - 1)] ?? null);
  }

  const previewMeta = preview ? parseTaskAttachment(preview) : null;

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*,application/pdf,.pdf"
      multiple
      className="hidden"
      onChange={e => {
        const files = e.target.files;
        if (files?.length) {
          void addFiles(files).finally(() => {
            if (fileRef.current) fileRef.current.value = '';
          });
        }
      }}
    />
  );

  if (variant === 'pane') {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 pr-12">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {t('task_images_label')}
            <span className="ml-1.5 font-normal normal-case">
              ({images.length}/{MAX_TASK_IMAGES})
            </span>
          </p>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-text-muted hover:bg-background hover:text-text-primary"
              aria-label={t('task_images_collapse')}
              title={t('task_images_collapse')}
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          {...bindDropTarget()}
          className={cn(
            'relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-background/40',
            dragging && 'bg-accent-teal/10'
          )}
        >
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
              <Loader2 className="h-6 w-6 animate-spin text-accent-teal" />
            </div>
          )}

          {preview && previewMeta ? (
            <div className="flex h-full w-full min-h-0 flex-col">
              <p className="shrink-0 truncate px-3 py-1.5 text-[11px] text-text-muted">
                {previewMeta.name}
              </p>
              <div className="min-h-0 flex-1 px-3 pb-3">
                {previewMeta.kind === 'pdf' ? (
                  <iframe
                    src={preview}
                    title={previewMeta.name}
                    className="h-full w-full rounded-lg border border-border bg-white"
                  />
                ) : (
                  <img
                    src={preview}
                    alt={previewMeta.name}
                    className="h-full w-full rounded-lg object-contain"
                  />
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                'm-3 flex min-h-[12rem] w-[calc(100%-1.5rem)] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragging
                  ? 'border-accent-teal text-accent-teal'
                  : 'border-border text-text-muted hover:border-accent-teal/40'
              )}
              onClick={() => !busy && fileRef.current?.click()}
            >
              <FilePlus className="h-8 w-8 opacity-70" />
              <span className="text-sm font-medium text-text-primary">
                {dragging ? t('task_images_drop') : t('task_images_pane_empty')}
              </span>
              <span className="text-[11px] opacity-70">
                {t('task_images_max').replace('{n}', String(MAX_TASK_IMAGES))}
              </span>
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-2.5">
          {images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {images.map((src, i) => {
                const meta = parseTaskAttachment(src);
                const isPdf = isPdfAttachment(src);
                const active = src === preview;
                return (
                  <div
                    key={`${i}-${src.slice(0, 40)}`}
                    className={cn(
                      'group relative h-12 w-12 overflow-hidden rounded-md border bg-background',
                      active ? 'border-accent-teal ring-1 ring-accent-teal/40' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      className="absolute inset-0"
                      onClick={() => setPreview(src)}
                      title={meta?.name}
                      aria-label={
                        isPdf ? t('task_images_preview_pdf') : t('task_images_preview')
                      }
                    >
                      {isPdf ? (
                        <span className="flex h-full w-full items-center justify-center bg-accent-red/10 text-[8px] font-semibold text-accent-red">
                          PDF
                        </span>
                      ) : (
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={t('task_images_remove')}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => !busy && fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-text-muted hover:border-accent-teal/40 hover:text-text-primary"
            >
              <FilePlus className="h-3.5 w-3.5" />
              {t('task_images_hint')}
            </button>
          )}
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {t('task_images_label')}
          {images.length > 0 && (
            <span className="ml-1.5 font-normal normal-case text-text-muted">
              ({images.length}/{MAX_TASK_IMAGES})
            </span>
          )}
        </p>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent-teal hover:bg-accent-teal/10"
          >
            {t('task_images_expand')}
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => {
            const meta = parseTaskAttachment(src);
            const isPdf = isPdfAttachment(src);
            return (
              <div
                key={`${i}-${src.slice(0, 40)}`}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-background sm:h-20 sm:w-20"
              >
                <button
                  type="button"
                  className="absolute inset-0"
                  onClick={() => {
                    if (onSelect) onSelect(src);
                    else setPreview(src);
                  }}
                  aria-label={
                    isPdf ? t('task_images_preview_pdf') : t('task_images_preview')
                  }
                  title={meta?.name}
                >
                  {isPdf ? (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-accent-red/10 px-1 text-accent-red">
                      <FileText className="h-5 w-5" />
                      <span className="w-full truncate text-center text-[9px] font-medium text-text-primary">
                        {meta?.name ?? 'PDF'}
                      </span>
                    </span>
                  ) : (
                    <img
                      src={src}
                      alt={meta?.name ?? ''}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label={t('task_images_remove')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {remaining > 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && fileRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!busy) fileRef.current?.click();
            }
          }}
          {...bindDropTarget()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 transition-colors',
            compact ? 'py-3' : 'py-4',
            dragging
              ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
              : 'border-border bg-field text-text-muted hover:border-accent-teal/40 hover:bg-accent-teal/5',
            busy && 'pointer-events-none opacity-60'
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin opacity-80" />
          ) : (
            <FilePlus className="h-5 w-5 opacity-70" />
          )}
          <span className="text-center text-xs">
            {busy
              ? t('task_images_compressing')
              : dragging
                ? t('task_images_drop')
                : t('task_images_hint')}
          </span>
          <span className="text-[10px] opacity-70">
            {t('task_images_max').replace('{n}', String(MAX_TASK_IMAGES))}
          </span>
        </div>
      )}

      {fileInput}

      {preview && previewMeta && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            onClick={() => setPreview(null)}
            aria-label={t('action_close')}
          >
            <X className="h-5 w-5" />
          </button>
          {previewMeta.kind === 'pdf' ? (
            <iframe
              src={preview}
              title={previewMeta.name}
              className="h-[85vh] w-full max-w-4xl rounded-lg bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              src={preview}
              alt={previewMeta.name}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface AttachmentsExpandRailProps {
  images: string[];
  onOpen: () => void;
  onDropFiles: (files: FileList) => void;
  busy?: boolean;
}

/** Pestaña derecha del modal: clic o drop abre el panel de adjuntos. */
export function AttachmentsExpandRail({
  images,
  onOpen,
  onDropFiles,
  busy,
}: AttachmentsExpandRailProps) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files);
        else onOpen();
      }}
      disabled={busy}
      className={cn(
        'hidden w-9 shrink-0 flex-col items-center justify-center gap-2 border-l border-border transition-colors md:flex',
        dragging
          ? 'bg-accent-teal/15 text-accent-teal'
          : 'bg-background/40 text-text-muted hover:bg-accent-teal/10 hover:text-accent-teal'
      )}
      aria-label={t('task_images_expand')}
      title={t('task_images_expand')}
    >
      <ChevronsRight className="h-4 w-4" />
      <span className="max-h-40 overflow-hidden text-[10px] font-medium uppercase tracking-wider [writing-mode:vertical-rl]">
        {t('task_images_pane_tab')}
        {images.length > 0 ? ` · ${images.length}` : ''}
      </span>
    </button>
  );
}
