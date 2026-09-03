import {
  MAX_TASK_PDF_DATA_URL_LENGTH,
  MAX_TASK_PDF_FILE_BYTES,
  withAttachmentName,
} from '@core/lib/taskImages';

export function isPdfFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** Imágenes del portapapeles o de un drop (Ctrl+V / arrastrar). */
export function imageFilesFromDataTransfer(
  data: DataTransfer | null | undefined
): File[] {
  if (!data) return [];
  const seen = new Set<File>();
  const out: File[] = [];
  const add = (file: File | null | undefined) => {
    if (!file || seen.has(file) || !isImageFile(file)) return;
    seen.add(file);
    out.push(file);
  };
  if (data.files?.length) {
    for (const file of Array.from(data.files)) add(file);
  }
  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind === 'file') add(item.getAsFile());
    }
  }
  return out;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo.'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export async function pdfFileToDataUrl(file: File): Promise<string> {
  if (!isPdfFile(file)) {
    throw new Error('El archivo debe ser un PDF.');
  }
  if (file.size > MAX_TASK_PDF_FILE_BYTES) {
    throw new Error('pdf_too_large');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const named = withAttachmentName(dataUrl, file.name);
  if (named.length > MAX_TASK_PDF_DATA_URL_LENGTH) {
    throw new Error('pdf_too_large');
  }
  return named;
}

export function downloadDataUrl(dataUrl: string, name: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
