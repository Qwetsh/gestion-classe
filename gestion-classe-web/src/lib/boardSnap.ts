/**
 * Aimantation pendant le déplacement d'objets : bords et centres alignés sur ceux des objets
 * voisins (guides), accroche à la grille quand le fond en a une. Fonctions pures, en unités de
 * page ; le calque d'objets les appelle à chaque mouvement et dessine les guides renvoyés.
 */
import type { Rect } from './boardObjects';

export interface SnapResult {
  /** Correction à ajouter au déplacement demandé. */
  dx: number;
  dy: number;
  /** Guides à dessiner : abscisses (verticaux) et ordonnées (horizontaux), en unités. */
  vertical: number[];
  horizontal: number[];
}

const NONE: SnapResult = { dx: 0, dy: 0, vertical: [], horizontal: [] };

/** Union de rectangles. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Aimante la boîte `moving` (déjà déplacée) sur les objets `others` et la grille.
 * Les objets ont priorité sur la grille ; un seul guide par axe, le plus proche.
 * `threshold` en unités (≈ 6 px écran).
 */
export function snapMove(moving: Rect, others: readonly Rect[], threshold: number, grid?: number): SnapResult {
  if (threshold <= 0) return NONE;
  const mx = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const my = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let best: { d: number; delta: number; at: number } | null = null;
  let bestY: { d: number; delta: number; at: number } | null = null;
  for (const o of others) {
    const ox = [o.x, o.x + o.w / 2, o.x + o.w];
    const oy = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const a of mx) for (const b of ox) {
      const d = Math.abs(a - b);
      if (d <= threshold && (!best || d < best.d)) best = { d, delta: b - a, at: b };
    }
    for (const a of my) for (const b of oy) {
      const d = Math.abs(a - b);
      if (d <= threshold && (!bestY || d < bestY.d)) bestY = { d, delta: b - a, at: b };
    }
  }
  let dx = best ? best.delta : 0, dy = bestY ? bestY.delta : 0;
  if (grid && grid > 0) {
    // Grille : le coin haut-gauche s'accroche au nœud le plus proche, sauf si un guide a déjà pris l'axe
    if (!best) { const g = Math.round(moving.x / grid) * grid; if (Math.abs(g - moving.x) <= threshold) dx = g - moving.x; }
    if (!bestY) { const g = Math.round(moving.y / grid) * grid; if (Math.abs(g - moving.y) <= threshold) dy = g - moving.y; }
  }
  return { dx, dy, vertical: best ? [best.at] : [], horizontal: bestY ? [bestY.at] : [] };
}
