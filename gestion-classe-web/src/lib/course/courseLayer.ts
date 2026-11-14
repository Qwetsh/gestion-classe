/**
 * Calque Tableau d'un cours (PLAN_cours_editeur.md, lot 3) : annotations posées par-dessus le
 * texte — encre, surligneur, traits, flèches, rectangles, ellipses, étiquettes de texte.
 *
 * Rangé dans le document du cours (`doc.layer`) : versions, copies, modèles et garde-fou
 * d'enregistrement le suivent sans rien de plus. Coordonnées en px de feuille (793,7 px = 21 cm),
 * hors zoom.
 *
 * Ancrage : chaque élément est accroché au bloc de premier niveau (paragraphe, titre, image…)
 * sous son origine, par l'identifiant du bloc (`blockId`) et un décalage vertical `dy`. Quand du
 * texte est ajouté plus haut, le bloc descend et l'élément avec lui. La position horizontale
 * reste celle de la feuille. Si le bloc disparaît, l'élément reste à sa dernière place connue.
 */

export type LayerTool = 'pen' | 'highlighter';

interface LayerBase {
  id: string;
  color: string;
  /** Épaisseur du trait (px de feuille) ; taille de police pour le texte. */
  size: number;
  /** Bloc d'ancrage (identifiant `blockId` du nœud) ; '' = haut de la feuille. */
  blockId: string;
  /** Décalage vertical de l'origine par rapport au haut du bloc. */
  dy: number;
  /** Origine : x absolu sur la feuille ; y absolu au dernier enregistrement (repli). */
  x: number;
  y: number;
}

export type LayerItem =
  | (LayerBase & { kind: 'ink'; tool: LayerTool; /** Points relatifs à l'origine. */ points: [number, number][] })
  | (LayerBase & { kind: 'line' | 'arrow'; /** Extrémité, relative à l'origine. */ to: [number, number] })
  | (LayerBase & { kind: 'rect' | 'ellipse'; w: number; h: number })
  | (LayerBase & { kind: 'text'; text: string });

export interface CourseLayer {
  items: LayerItem[];
}

/** Haut (et bas) de chaque bloc de premier niveau, en px de feuille, dans l'ordre du document. */
export interface BlockBox { id: string; top: number; bottom: number }

/** Arrondi au dixième de px : le JSON du cours reste léger. */
export const r1 = (v: number) => Math.round(v * 10) / 10;

export const newLayerId = () => Math.random().toString(36).slice(2, 10);

/** Bloc d'ancrage d'un point : le dernier bloc qui commence au-dessus de lui (ou le premier). */
export function anchorAt(blocks: BlockBox[], y: number): { blockId: string; dy: number } {
  let pick: BlockBox | null = null;
  for (const b of blocks) {
    if (b.top <= y) pick = b;
    else break;
  }
  if (!pick && blocks.length) pick = blocks[0];
  return pick ? { blockId: pick.id, dy: r1(y - pick.top) } : { blockId: '', dy: r1(y) };
}

/** Position verticale actuelle de l'origine d'un élément. */
export function resolveY(item: Pick<LayerItem, 'blockId' | 'dy' | 'y'>, tops: Map<string, number>): number {
  if (item.blockId === '') return item.dy;
  const top = tops.get(item.blockId);
  return top === undefined ? item.y : top + item.dy;
}

/** Réancre un élément à une nouvelle origine (après un déplacement). */
export function placeAt<T extends LayerItem>(item: T, x: number, y: number, blocks: BlockBox[]): T {
  const a = anchorAt(blocks, y);
  return { ...item, x, y, blockId: a.blockId, dy: a.dy };
}

/** Garde les points d'un tracé espacés d'au moins `min` px (moins lourd, même rendu). */
export function simplify(points: [number, number][], min = 1.5): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    if (Math.hypot(points[i][0] - px, points[i][1] - py) >= min) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Boîte englobante (relative à l'origine) d'un élément, pour la sélection. */
export function localBox(item: LayerItem): { x: number; y: number; w: number; h: number } {
  switch (item.kind) {
    case 'ink': {
      const xs = item.points.map((p) => p[0]);
      const ys = item.points.map((p) => p[1]);
      const x0 = Math.min(...xs); const y0 = Math.min(...ys);
      return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
    }
    case 'line':
    case 'arrow':
      return { x: Math.min(0, item.to[0]), y: Math.min(0, item.to[1]), w: Math.abs(item.to[0]), h: Math.abs(item.to[1]) };
    case 'rect':
    case 'ellipse':
      return { x: 0, y: 0, w: item.w, h: item.h };
    case 'text':
      return { x: 0, y: 0, w: Math.max(20, item.text.length * item.size * 0.55), h: item.size * 1.3 };
  }
}
