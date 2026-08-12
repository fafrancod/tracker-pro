import { useCallback, useRef, useState } from 'react';
import {
  MAX_TASK_IMAGES,
  withAttachmentName,
} from '@core/lib/taskImages';
import { compressImageToDataUrl } from '@/lib/imageCompress';
import { isImageFile, isPdfFile, pdfFileToDataUrl } from '@/lib/attachmentFiles';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';

export function useTaskAttachmentFiles(
  images: string[],
  onChange: (images: string[]) => void,
  opts?: { onAdded?: (lastSrc: string, next: string[]) => void }
) {
  const { t } = useT();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, MAX_TASK_IMAGES - images.length);
  const onAddedRef = useRef(opts?.onAdded);
  onAddedRef.current = opts?.onAdded;

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
        let lastAdded: string | null = null;
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
            if (!next.includes(dataUrl)) {
              next.push(dataUrl);
              lastAdded = dataUrl;
            }
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
        const sliced = next.slice(0, MAX_TASK_IMAGES);
        onChange(sliced);
        if (lastAdded) onAddedRef.current?.(lastAdded, sliced);
      } finally {
        setBusy(false);
      }
    },
    [images, onChange, remaining, showToast, t]
  );

  return { addFiles, busy, remaining };
}
