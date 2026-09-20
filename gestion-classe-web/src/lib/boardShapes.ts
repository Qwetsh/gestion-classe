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

/** Texte écrit dans une forme fermée (double-clic), centré dans sa boîte intérieure. */
export interface ShapeText { html: string; size: number; font: string; color: string }

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
  /** Texte dans la forme (jamais sur une ligne ou une flèche). */
  text?: ShapeText;
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

// ---- Texte, contenance et suivi (encre attachée, connecteurs) ----

/** Ce qu'il faut d'une forme pour situer ce qui la suit : sa boîte et sa rotation. */
export interface ShapeBox { x: number; y: number; w: number; h: number; rotation?: number }
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Texte par défaut d'une forme : centré, lisible sur le remplissage. */
export function defaultShapeText(s: ShapeObject): ShapeText {
  return { html: '<div style="text-align:center"><br></div>', size: 24, font: 'sans', color: contrastColor(s.fill) };
}
/** Noir ou blanc selon la clarté du fond (forme creuse : noir). */
export function contrastColor(fill: string | null): string {
  if (!fill) return '#111827';
  const m = /^#([0-9a-f]{6})$/i.exec(fill);
  if (!m) return '#111827';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111827' : '#FFFFFF';
}

/** Boîte intérieure pour le texte (avant rotation) : marge plus large quand la forme rentre vers le centre. */
export function shapeTextBox(s: ShapeBox & { kind: ShapeKind }): { x: number; y: number; w: number; h: number } {
  const inset = s.kind === 'rect' || s.kind === 'rounded-rect' ? 0.08
    : s.kind === 'ellipse' || s.kind === 'hexagon' || s.kind === 'pentagon' || s.kind === 'parallelogram' || s.kind === 'trapezoid' ? 0.16
    : 0.24;
  const ix = s.w * inset, iy = s.h * inset;
  return { x: s.x + ix, y: s.y + iy, w: Math.max(1, s.w - 2 * ix), h: Math.max(1, s.h - 2 * iy) };
}

/** Point de la page → repère local de la forme (0..w, 0..h), rotation comprise. */
export function toShapeLocal(s: ShapeBox, x: number, y: number): ShapePoint {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const dx = x - cx, dy = y - cy;
  const a = -rad(s.rotation ?? 0);
  return { x: dx * Math.cos(a) - dy * Math.sin(a) + s.w / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + s.h / 2 };
}

/**
 * La forme contient-elle le point ? Sur le chemin réel (`isPointInPath`) quand un contexte
 * canvas est fourni, sinon sur la boîte (tests, environnement sans canvas). `tolerance`
 * (unités) accepte un point juste au bord. Une ligne ou une flèche n'a pas d'intérieur.
 */
export function shapeContainsPoint(s: ShapeObject, x: number, y: number, ctx: CanvasRenderingContext2D | null, tolerance = 0): boolean {
  if (isLineKind(s.kind)) return false;
  const p = toShapeLocal(s, x, y);
  const offsets: [number, number][] = tolerance > 0
    ? [[0, 0], [tolerance, 0], [-tolerance, 0], [0, tolerance], [0, -tolerance]]
    : [[0, 0]];
  if (!ctx) return offsets.some(([ox, oy]) => p.x + ox >= 0 && p.x + ox <= s.w && p.y + oy >= 0 && p.y + oy <= s.h);
  const path = new Path2D(shapePath(s));
  return offsets.some(([ox, oy]) => ctx.isPointInPath(path, p.x + ox, p.y + oy));
}

/** Tous les points sont dans la forme : un trait dessiné dedans lui est attaché. */
export function pointsInsideShape(points: readonly ShapePoint[], s: ShapeObject, ctx: CanvasRenderingContext2D | null, tolerance = 4): boolean {
  return points.length > 0 && points.every((pt) => shapeContainsPoint(s, pt.x, pt.y, ctx, tolerance));
}

/** Un point qui suit une forme d'une boîte à l'autre : translation, échelle et rotation. */
export function followShape<P extends ShapePoint>(pt: P, from: ShapeBox, to: ShapeBox): P {
  const local = toShapeLocal(from, pt.x, pt.y);
  const kx = from.w > 0 ? to.w / from.w : 1, ky = from.h > 0 ? to.h / from.h : 1;
  const lx = local.x * kx - to.w / 2, ly = local.y * ky - to.h / 2;
  const a = rad(to.rotation ?? 0);
  return { ...pt, x: to.x + to.w / 2 + lx * Math.cos(a) - ly * Math.sin(a), y: to.y + to.h / 2 + lx * Math.sin(a) + ly * Math.cos(a) };
}

export const sameShapeBox = (a: ShapeBox, b: ShapeBox) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && (a.rotation ?? 0) === (b.rotation ?? 0);

/** Boîte d'une forme posée d'un clic, centrée sur le point. */
export function defaultShapeBox(kind: ShapeKind, cx: number, cy: number): { x: number; y: number; w: number; h: number } {
  const w = DEFAULT_SHAPE_SIZE.w;
  const h = isLineKind(kind) ? 0 : DEFAULT_SHAPE_SIZE.h;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}
