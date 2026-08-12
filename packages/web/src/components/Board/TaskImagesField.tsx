import { useCallback, useRef, useState, type DragEvent } from 'react';
import { FilePlus, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { compressImageToDataUrl } from '@/lib/imageCompress';
import { isImageFile, isPdfFile, pdfFileToDataUrl } from '@/lib/attachmentFiles';
import {
  MAX_TASK_IMAGES,
  isPdfAttachment,
  parseTaskAttachment,
  withAttachmentName,
} from '@core/lib/taskImages';

interface TaskImagesFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** compact = form de creación; full = detalle */
  compact?: boolean;
  className?: string;
}

/**
 * Zona de adjuntos: click abre el selector del SO;
 * drag & drop añade imágenes (comprimidas) o PDFs.
 */
export function TaskImagesField({
  images,
  onChange,
  compact = false,
  className,
}: TaskImagesFieldProps) {
  const { t } = useT();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const remaining = Math.max(0, MAX_TASK_IMAGES - images.length);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(f => isImageFile(f) || isPdfFile(f));
      if (list.length === 0) {
        showToast(t('task_images_not_image'), 'error');
        return;
      }
      if (remaining <= 0) {
        showToast(
          t('task_images_limit').replace('{n}', String(MAX_TASK_IMAGES)),
          'error'
        );
        return;
      }

      setBusy(true);
      try {
        const next = [...images];
        for (const file of list) {
          if (next.length >= MAX_TASK_IMAGES) break;
          try {
            let dataUrl: string;
            if (isPdfFile(file)) {
              dataUrl = await pdfFileToDataUrl(file);
            } else {
              const compressed = await compressImageToDataUrl(file, {
                maxEdge: 640,
                quality: 0.7,
                maxDataUrlLength: 180_000,
              });
              dataUrl = withAttachmentName(compressed, file.name);
            }
            if (!next.includes(dataUrl)) next.push(dataUrl);
          } catch (err) {
            const msg =
              err instanceof Error && err.message === 'pdf_too_large'
                ? t('task_images_pdf_too_large')
                : err instanceof Error
                  ? err.message
                  : t('task_images_error');
            showToast(msg, 'error');
          }
        }
        onChange(next.slice(0, MAX_TASK_IMAGES));
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [images, onChange, remaining, showToast, t]
  );

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (busy) return;
    void addFiles(e.dataTransfer.files);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  const previewMeta = preview ? parseTaskAttachment(preview) : null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {t('task_images_label')}
        {images.length > 0 && (
          <span className="ml-1.5 font-normal normal-case text-text-muted">
            ({images.length}/{MAX_TASK_IMAGES})
          </span>
        )}
      </p>

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
                  onClick={() => setPreview(src)}
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
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 transition-colors',
            compact ? 'py-3' : 'py-4',
            dragging
              ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
              : 'border-border bg-background/60 text-text-muted hover:border-accent-teal/40 hover:bg-accent-teal/5',
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

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={e => {
          const files = e.target.files;
          if (files?.length) void addFiles(files);
        }}
      />

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
