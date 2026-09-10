/**
 * Objets d'une page du tableau blanc (modèle v2).
 *
 * Une page porte, au-dessus de son fond et de son encre, une liste ordonnée d'objets
 * typés (l'ordre du tableau = ordre d'empilement). Tout objet partage la même
 * géométrie en unités logiques (page = 1000 de large) et la même mécanique de
 * sélection, de déplacement, de redimensionnement et de menu contextuel.
 *
 * Phase 0 : seul le type `text` existe (ancien `texts[]`, migré ici). Les formes,
 * images, tableaux… viendront s'ajouter à l'union sans toucher à la mécanique.
 */
import { type TextBox, textBoxRect } from './boardText';
import type { ShapeObject } from './boardShapes';
import type { RevealCover } from './boardReveal';
import { mediaRect, type MediaObject } from './boardMedia';
import type { LibraryObject } from './boardLibrary';

export interface BoardObjectBase {
  id: string;
  type: string;
  /** Coin haut-gauche et largeur, en unités logiques. */
  x: number;
  y: number;
  w: number;
  /** Rotation en degrés — dans le modèle dès maintenant, sans interface avant la phase TBI. */
  rotation?: number;
  /** Verrouillé : ni déplacement, ni redimensionnement, ni suppression par la sélection. */
  locked?: boolean;
  opacity?: number;
  /** Rideau ou ticket à gratter posé sur l'objet (voir boardReveal). */
  cover?: RevealCover;
}

/** Zone de texte : la hauteur découle du contenu. */
export interface TextObject extends BoardObjectBase, TextBox {
  type: 'text';
}

/** Image (photo, schéma, capture) stockée dans le bucket board-assets. */
export interface ImageObject extends BoardObjectBase {
  type: 'image';
  h: number;
  path: string;
  /** Dimensions du fichier, pour garder les proportions au redimensionnement. */
  naturalWidth: number;
  naturalHeight: number;
}

export type BoardObject = TextObject | ShapeObject | ImageObject | LibraryObject | MediaObject;

export interface Rect { x: number; y: number; w: number; h: number }

export const objectId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Emprise cliquable de l'objet, en unités logiques. */
export function objectRect(o: BoardObject): Rect {
  switch (o.type) {
    case 'text':
      return textBoxRect(o);
    case 'shape': {
      // Une ligne fine reste attrapable : emprise minimale de 12 unités
      const pad = Math.max(0, (12 - o.h) / 2);
      const padW = Math.max(0, (12 - o.w) / 2);
      return { x: o.x - padW, y: o.y - pad, w: o.w + padW * 2, h: o.h + pad * 2 };
    }
    case 'image':
    case 'library':
      return { x: o.x, y: o.y, w: o.w, h: o.h };
    default:
      return mediaRect(o);
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Objet le plus haut dans l'empilement sous le point (x, y). */
export function objectAt(objects: BoardObject[], x: number, y: number): BoardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (rectContains(objectRect(objects[i]), x, y)) return objects[i];
  }
  return null;
}

/** Copie d'objets avec de nouveaux identifiants, décalée (pour dupliquer / coller). */
export function cloneObjects(objects: BoardObject[], dx = 24, dy = 24): BoardObject[] {
  return objects.map((o) => ({ ...o, id: objectId(), x: o.x + dx, y: o.y + dy }));
}

/** Déplace les objets sélectionnés d'un cran vers l'avant ou l'arrière dans l'empilement. */
export function reorder(objects: BoardObject[], ids: Set<string>, move: 'front' | 'back' | 'forward' | 'backward'): BoardObject[] {
  const selected = objects.filter((o) => ids.has(o.id));
  const others = objects.filter((o) => !ids.has(o.id));
  if (selected.length === 0) return objects;
  if (move === 'front') return [...others, ...selected];
  if (move === 'back') return [...selected, ...others];
  const next = [...objects];
  if (move === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) {
      if (ids.has(next[i].id) && !ids.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (ids.has(next[i].id) && !ids.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]];
    }
  }
  return next;
}

/** Ancien champ `texts[]` d'une page → objets `text`. Idempotent. */
export function migrateLegacyTexts(objects: BoardObject[] | undefined, texts: TextBox[] | undefined): BoardObject[] {
  const base = Array.isArray(objects) ? objects : [];
  if (!Array.isArray(texts) || texts.length === 0) return base;
  const known = new Set(base.map((o) => o.id));
  const migrated: BoardObject[] = texts
    .filter((t) => !known.has(t.id))
    .map((t) => ({ ...t, type: 'text' as const }));
  return [...base, ...migrated];
}
