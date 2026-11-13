/**
 * Attributs des images d'un cours ajoutés au lot T8, et événements du ruban vers l'image
 * sélectionnée (rogner, écrire la légende).
 */

/** Rognage : fraction retirée de chaque côté de l'image (déjà tournée), de 0 à 1. */
export interface ImageCrop { t: number; r: number; b: number; l: number }

export type ImageFrame = 'none' | 'border' | 'rounded' | 'shadow' | 'circle';

export const IMAGE_FRAMES: { id: ImageFrame; label: string }[] = [
  { id: 'none', label: 'Sans cadre' },
  { id: 'border', label: 'Bordure' },
  { id: 'rounded', label: 'Coins arrondis' },
  { id: 'shadow', label: 'Ombre' },
  { id: 'circle', label: 'Rond' },
];

/** Le ruban demande le rognage de l'image sélectionnée (bascule). */
export const IMAGE_CROP_EVENT = 'course-editor:image-crop';
/** Le ruban demande d'écrire la légende de l'image sélectionnée. */
export const IMAGE_CAPTION_EVENT = 'course-editor:image-caption';

/** Rognage après un quart de tour (sens des aiguilles d'une montre si `clockwise`). */
export function rotateCrop(c: ImageCrop | null, clockwise: boolean): ImageCrop | null {
  if (!c) return null;
  return clockwise ? { t: c.l, r: c.t, b: c.r, l: c.b } : { t: c.r, r: c.b, b: c.l, l: c.t };
}

/** Rognage après un retournement horizontal. */
export function flipCrop(c: ImageCrop | null): ImageCrop | null {
  return c ? { ...c, l: c.r, r: c.l } : null;
}
