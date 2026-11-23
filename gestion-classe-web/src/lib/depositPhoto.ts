/**
 * Dépôt de photos par les élèves (PLAN_tp_groupes.md, lot 4) : la photo est réduite sur le
 * téléphone de l'élève avant l'envoi. Le stockage n'accepte pas plus de 1 Mo par fichier : on
 * réencode en JPEG, de plus en plus petit, jusqu'à passer sous ce plafond.
 */

/** Plafond visé, sous la limite du bucket (1 Mo) pour garder une marge. */
export const DEPOSIT_MAX_BYTES = 950_000;
/** Au-delà, ce n'est pas une photo de téléphone (ou elle ne se lira pas en mémoire). */
export const DEPOSIT_MAX_SOURCE_BYTES = 40 * 1024 * 1024;

/** Tailles essayées tour à tour : plus grand côté en pixels, qualité JPEG. */
export const DEPOSIT_STEPS: { side: number; quality: number }[] = [
  { side: 1600, quality: 0.8 },
  { side: 1600, quality: 0.7 },
  { side: 1280, quality: 0.7 },
  { side: 1024, quality: 0.65 },
  { side: 800, quality: 0.6 },
];

/** Dimensions ramenées pour que le plus grand côté ne dépasse pas `side` (jamais agrandies). */
export function fitInside(width: number, height: number, side: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= side || longest === 0) return { width, height };
  const r = side / longest;
  return { width: Math.max(1, Math.round(width * r)), height: Math.max(1, Math.round(height * r)) };
}

/** « 7,8 Mo », « 640 ko ». */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} ko`;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // L'orientation de l'appareil photo (EXIF) est appliquée : la photo ne part pas couchée
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* format que le navigateur ne décode pas ainsi : on essaie par une image */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('unreadable'));
      i.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas'));
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality));
}

export class DepositPhotoError extends Error {
  kind: 'not_image' | 'too_big' | 'unreadable';
  constructor(kind: DepositPhotoError['kind']) {
    super(kind);
    this.kind = kind;
  }
}

/** Photo prête à partir : JPEG sous le plafond, avec la taille d'origine pour l'afficher. */
export async function prepareDepositPhoto(file: File): Promise<{ blob: Blob; before: number; after: number }> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) throw new DepositPhotoError('not_image');
  if (file.size > DEPOSIT_MAX_SOURCE_BYTES) throw new DepositPhotoError('too_big');
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new DepositPhotoError('unreadable');
  }
  try {
    let last: Blob | null = null;
    for (const step of DEPOSIT_STEPS) {
      const { width, height } = fitInside(decoded.width, decoded.height, step.side);
      last = await encode(decoded.source, width, height, step.quality);
      if (last.size <= DEPOSIT_MAX_BYTES) return { blob: last, before: file.size, after: last.size };
    }
    throw new DepositPhotoError('too_big');
  } finally {
    decoded.close();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(blob);
  });
}
