/**
 * Comprime una imagen File a JPEG data URL (cuadrado/ancho max).
 * Evita inflar el JSON de settings del perfil.
 */
export async function compressImageToDataUrl(
  file: File,
  opts?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 360;
  const quality = opts?.quality ?? 0.68;

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  // Tope duro de entrada ~8MB
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('La imagen es demasiado grande (máx. 8 MB).');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(bitmap, 0, 0, w, h);
    // ~120KB data URL: settings del perfil viven en jsonb
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length > 160_000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    }
    if (dataUrl.length > 160_000) {
      throw new Error('La imagen sigue siendo muy grande tras comprimir. Prueba otra más pequeña.');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

export function newLifeGoalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `lg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
