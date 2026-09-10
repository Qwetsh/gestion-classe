/**
 * Presse-papiers interne du tableau blanc : des objets typés (pas une image aplatie),
 * copiés d'une page et collés sur une autre, ou d'un tableau à l'autre dans le même onglet.
 *
 * Le contenu est aussi poussé dans le presse-papiers système en texte brut, pour pouvoir
 * coller le texte d'une zone dans un autre logiciel.
 */
import type { BoardObject } from './boardObjects';
import { cloneObjects } from './boardObjects';

let buffer: BoardObject[] = [];

export function copyObjects(objects: BoardObject[]) {
  buffer = objects.map((o) => ({ ...o }));
  const text = objects
    .map((o) => (o.type === 'text' ? new DOMParser().parseFromString(o.html, 'text/html').body.textContent || '' : ''))
    .filter(Boolean)
    .join('\n');
  if (text && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => undefined);
}

export function hasObjects(): boolean {
  return buffer.length > 0;
}

/** Nouvelle copie à chaque collage (identifiants neufs, léger décalage cumulé). */
export function pasteObjects(generation = 1): BoardObject[] {
  return cloneObjects(buffer, 24 * generation, 24 * generation);
}
