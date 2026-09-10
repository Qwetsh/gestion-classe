/**
 * Formes géométriques du tableau blanc : catalogue, géométrie et rendu.
 *
 * Une forme est un objet de page à boîte (x, y, w, h) ; sa géométrie est décrite par un
 * chemin SVG en coordonnées locales (0..w, 0..h), **une seule source** utilisée à la fois
 * par le calque DOM (balise <path>) et par le rendu canvas (Path2D) — ce qui garantit que
 * l'écran, les vignettes et l'export PDF coïncident.
 *
 * Les formes « ligne » (ligne, flèches) relient deux points a et b exprimés en fraction de
 * la boîte (0..1), pour survivre au redimensionnement par les poignées.
 */
import type { BoardObjectBase } from './boardObjects';

export type ShapeKind =
  | 'line' | 'arrow' | 'double-arrow'
  | 'rect' | 'rounded-rect' | 'ellipse'
  | 'triangle' | 'right-triangle' | 'diamond' | 'parallelogram' | 'trapezoid'
  | 'pentagon' | 'hexagon' | 'star'
  | 'polygon';

export interface ShapePoint { x: number; y: number }

export interface ShapeObject extends BoardObjectBase {
  type: 'shape';
  kind: ShapeKind;
  h: number;
  stroke: string;
  /** Épaisseur du contour, en unités logiques. */
  strokeWidth: number;
  /** Remplissage (couleur) ou null pour une forme creuse. */
  fill: string | null;
  dashed?: boolean;
  /** Extrémités des lignes, en fraction de la boîte. */
  a?: ShapePoint;
  b?: ShapePoint;
  /** Sommets d'un polygone quelconque (kind = 'polygon'), en fraction de la boîte. */
  points?: ShapePoint[];
}

export interface ShapeEntry { kind: ShapeKind; label: string }

/** Formes proposées dans la palette (le polygone libre vient de la reconnaissance). */
export const SHAPE_CATALOG: ShapeEntry[] = [
  { kind: 'line', label: 'Ligne' },
  { kind: 'arrow', label: 'Flèche' },
  { kind: 'double-arrow', label: 'Double flèche' },
  { kind: 'rect', label: 'Rectangle' },
  { kind: 'rounded-rect', label: 'Rectangle arrondi' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'right-triangle', label: 'Triangle rectangle' },
  { kind: 'diamond', label: 'Losange' },
  { kind: 'parallelogram', label: 'Parallélogramme' },
  { kind: 'trapezoid', label: 'Trapèze' },
  { kind: 'pentagon', label: 'Pentagone' },
  { kind: 'hexagon', label: 'Hexagone' },
  { kind: 'star', label: 'Étoile' },
];

export const SHAPE_STROKE_WIDTHS: Record<'S' | 'M' | 'L', number> = { S: 2, M: 4, L: 8 };
/** Taille d'une forme posée d'un simple clic (sans étirement). */
export const DEFAULT_SHAPE_SIZE = { w: 180, h: 120 };
export const MIN_SHAPE_SIZE = 8;

export const isLineKind = (kind: ShapeKind) => kind === 'line' || kind === 'arrow' || kind === 'double-arrow';

const f = (n: number) => Math.round(n * 100) / 100;

function regularPolygon(n: number, w: number, h: number, startAngle = -Math.PI / 2): ShapePoint[] {
  const pts: ShapePoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = startAngle + (i * 2 * Math.PI) / n;
    pts.push({ x: w / 2 + (w / 2) * Math.cos(t), y: h / 2 + (h / 2) * Math.sin(t) });
  }
  return pts;
}

function closedPath(pts: ShapePoint[]): string {
  if (pts.length === 0) return '';
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}Z`;
}

/** Points de la ligne en coordonnées locales. */
export function lineEnds(s: ShapeObject): { a: ShapePoint; b: ShapePoint } {
  const a = s.a ?? { x: 0, y: 0 };
  const b = s.b ?? { x: 1, y: 1 };
  return { a: { x: a.x * s.w, y: a.y * s.h }, b: { x: b.x * s.w, y: b.y * s.h } };
}

/** Chemin SVG du contour, en coordonnées locales (0..w, 0..h). */
export function shapePath(s: ShapeObject): string {
  const { w, h, kind } = s;
  switch (kind) {
    case 'line': case 'arrow': case 'double-arrow': {
      const { a, b } = lineEnds(s);
      return `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
    }
    case 'rect':
      return `M0 0H${f(w)}V${f(h)}H0Z`;
    case 'rounded-rect': {
      const r = Math.min(w, h) * 0.18;
      return `M${f(r)} 0H${f(w - r)}Q${f(w)} 0 ${f(w)} ${f(r)}V${f(h - r)}Q${f(w)} ${f(h)} ${f(w - r)} ${f(h)}H${f(r)}Q0 ${f(h)} 0 ${f(h - r)}V${f(r)}Q0 0 ${f(r)} 0Z`;
    }
    case 'ellipse': {
      const rx = w / 2, ry = h / 2;
      return `M${f(rx)} 0A${f(rx)} ${f(ry)} 0 1 1 ${f(rx)} ${f(h)}A${f(rx)} ${f(ry)} 0 1 1 ${f(rx)} 0Z`;
    }
    case 'triangle':
      return closedPath([{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    case 'right-triangle':
      return closedPath([{ x: 0, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    case 'diamond':
      return closedPath([{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }]);
    case 'parallelogram':
      return closedPath([{ x: w * 0.25, y: 0 }, { x: w, y: 0 }, { x: w * 0.75, y: h }, { x: 0, y: h }]);
    case 'trapezoid':
      return closedPath([{ x: w * 0.2, y: 0 }, { x: w * 0.8, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    case 'pentagon':
      return closedPath(regularPolygon(5, w, h));
    case 'hexagon':
      return closedPath(regularPolygon(6, w, h, 0));
    case 'star': {
      const pts: ShapePoint[] = [];
      for (let i = 0; i < 10; i++) {
        const t = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : 0.42;
        pts.push({ x: w / 2 + (w / 2) * k * Math.cos(t), y: h / 2 + (h / 2) * k * Math.sin(t) });
      }
      return closedPath(pts);
    }
    case 'polygon':
      return closedPath((s.points ?? []).map((p) => ({ x: p.x * w, y: p.y * h })));
  }
}

/** Têtes de flèche (chemins fermés à remplir), en coordonnées locales. */
export function arrowHeadPaths(s: ShapeObject): string[] {
  if (s.kind !== 'arrow' && s.kind !== 'double-arrow') return [];
  const { a, b } = lineEnds(s);
  const size = Math.max(10, s.strokeWidth * 3.5);
  const head = (tip: ShapePoint, from: ShapePoint): string => {
    const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
    const l = { x: tip.x - size * Math.cos(ang - Math.PI / 6), y: tip.y - size * Math.sin(ang - Math.PI / 6) };
    const r = { x: tip.x - size * Math.cos(ang + Math.PI / 6), y: tip.y - size * Math.sin(ang + Math.PI / 6) };
    return closedPath([tip, l, r]);
  };
  const heads = [head(b, a)];
  if (s.kind === 'double-arrow') heads.push(head(a, b));
  return heads;
}

/** Motif de pointillé proportionné à l'épaisseur. */
export const dashPattern = (strokeWidth: number) => [strokeWidth * 3, strokeWidth * 2.2];

export function renderShape(ctx: CanvasRenderingContext2D, s: ShapeObject, scale: number) {
  ctx.save();
  ctx.translate(s.x * scale, s.y * scale);
  ctx.scale(scale, scale);
  if (s.rotation) {
    ctx.translate(s.w / 2, s.h / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.translate(-s.w / 2, -s.h / 2);
  }
  const path = new Path2D(shapePath(s));
  ctx.lineWidth = s.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = s.stroke;
  if (s.fill && !isLineKind(s.kind)) {
    ctx.fillStyle = s.fill;
    ctx.fill(path);
  }
  if (s.dashed) ctx.setLineDash(dashPattern(s.strokeWidth));
  ctx.stroke(path);
  ctx.setLineDash([]);
  ctx.fillStyle = s.stroke;
  for (const head of arrowHeadPaths(s)) {
    const hp = new Path2D(head);
    ctx.fill(hp);
    ctx.stroke(hp);
  }
  ctx.restore();
}

/** Boîte d'une forme posée d'un clic, centrée sur le point. */
export function defaultShapeBox(kind: ShapeKind, cx: number, cy: number): { x: number; y: number; w: number; h: number } {
  const w = DEFAULT_SHAPE_SIZE.w;
  const h = isLineKind(kind) ? 0 : DEFAULT_SHAPE_SIZE.h;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}
