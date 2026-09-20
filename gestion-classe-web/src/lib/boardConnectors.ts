/**
 * Connecteurs du tableau blanc : flèches qui relient deux objets (ou un objet et un point libre)
 * façon tableau de schémas. La géométrie n'est jamais stockée : à chaque rendu, les points
 * d'ancrage sont recalculés depuis la boîte courante des objets reliés, donc déplacer,
 * redimensionner ou tourner une forme repositionne ses flèches sans rien faire de plus.
 *
 * Le chemin (chaîne SVG) est la seule source, partagée par le calque DOM (<path>) et le rendu
 * canvas (Path2D) : écran, vignettes et export coïncident. Les flèches d'interaction des boutons
 * (lot E) réutilisent ce module avec des connecteurs éphémères.
 */
import type { BoardObject, BoardObjectBase, Rect } from './boardObjects';
import { objectRect } from './boardObjects';
import { isLineKind } from './boardShapes';

export type ConnectorSide = 'auto' | 'n' | 'e' | 's' | 'w';
export type FixedSide = Exclude<ConnectorSide, 'auto'>;
/** Extrémité : attachée à un objet (côté choisi ou automatique) ou point libre de la page. */
export type ConnectorEnd = { objectId: string; side: ConnectorSide } | { x: number; y: number };
export type ConnectorRoute = 'curve' | 'straight';

export interface ConnectorObject extends BoardObjectBase {
  type: 'connector';
  /** Boîte englobante dérivée (mise à jour par `refreshConnectors`), pour la sélection au lasso. */
  h: number;
  from: ConnectorEnd;
  to: ConnectorEnd;
  route: ConnectorRoute;
  heads: { start: boolean; end: boolean };
  stroke: string;
  strokeWidth: number;
  dashed?: boolean;
  /** Cintrage posé à la main : décalage du point de contrôle depuis le milieu, en unités. */
  bend?: { x: number; y: number };
  /** Libellé au milieu de la flèche. */
  label?: string;
}

export interface Pt { x: number; y: number }

export const isAttachedEnd = (e: ConnectorEnd): e is { objectId: string; side: ConnectorSide } => 'objectId' in e;
/** Largeur de la zone de pointage invisible autour du tracé (px écran) : une courbe fine s'attrape au doigt. */
export const CONNECTOR_HIT_WIDTH = 14;
export const CONNECTOR_COLORS = ['#6B7280', '#111827', '#1D4ED8', '#DC2626', '#059669'];
export const CONNECTOR_WIDTHS: Record<'S' | 'M' | 'L', number> = { S: 2, M: 3, L: 6 };

const SIDE_DIR: Record<FixedSide, Pt> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
const f = (n: number) => Math.round(n * 100) / 100;
const rad = (deg: number) => (deg * Math.PI) / 180;
const rotate = (p: Pt, deg: number): Pt => {
  if (!deg) return p;
  const a = rad(deg);
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};

/** Boîte d'ancrage d'un objet : sa boîte propre pour une forme (rotation comprise), sinon son emprise. */
function anchorBox(o: BoardObject): Rect & { rotation: number } {
  if (o.type === 'shape') return { x: o.x, y: o.y, w: o.w, h: Math.max(o.h, 1), rotation: isLineKind(o.kind) ? 0 : o.rotation ?? 0 };
  return { ...objectRect(o), rotation: 0 };
}

const center = (b: Rect): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Milieu d'un côté de l'objet, sur la page (tourné avec une forme). */
export function sidePoint(o: BoardObject, side: FixedSide): Pt {
  const b = anchorBox(o);
  const c = center(b);
  const local = { x: (SIDE_DIR[side].x * b.w) / 2, y: (SIDE_DIR[side].y * b.h) / 2 };
  const r = rotate(local, b.rotation);
  return { x: c.x + r.x, y: c.y + r.y };
}

/** Direction sortante d'un côté, sur la page. */
export function sideDir(o: BoardObject, side: FixedSide): Pt {
  return rotate(SIDE_DIR[side], anchorBox(o).rotation);
}

/** Côté de l'objet qui regarde vers le point (dans le repère tourné de l'objet). */
export function nearestSide(o: BoardObject, p: Pt): FixedSide {
  const b = anchorBox(o);
  const c = center(b);
  const local = rotate({ x: p.x - c.x, y: p.y - c.y }, -b.rotation);
  // Comparaison normalisée par la boîte : une boîte large préfère ses côtés est / ouest
  const nx = b.w > 0 ? local.x / b.w : local.x;
  const ny = b.h > 0 ? local.y / b.h : local.y;
  if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'e' : 'w';
  return ny >= 0 ? 's' : 'n';
}

export interface ConnectorGeometry {
  p0: Pt; p1: Pt;
  /** Directions sortantes aux extrémités (null : extrémité libre). */
  d0: Pt | null; d1: Pt | null;
  side0: FixedSide | null; side1: FixedSide | null;
  /** Points de contrôle utilisés (courbe) ; vide pour une droite. */
  controls: Pt[];
  path: string;
  /** Point à mi-parcours (poignée de cintrage, libellé). */
  mid: Pt;
  /** Têtes de flèche : chemins fermés à remplir. */
  heads: string[];
}

function resolveEnd(end: ConnectorEnd, objects: readonly BoardObject[], fallback: Pt): { o: BoardObject | null; pt: Pt } {
  if (!isAttachedEnd(end)) return { o: null, pt: end };
  const o = objects.find((t) => t.id === end.objectId) ?? null;
  return { o, pt: o ? center(anchorBox(o)) : fallback };
}

const bez2 = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
  y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
});
const bez3 = (p0: Pt, c0: Pt, c1: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
  };
};

function headPath(tip: Pt, from: Pt, size: number): string {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const l = { x: tip.x - size * Math.cos(ang - Math.PI / 6), y: tip.y - size * Math.sin(ang - Math.PI / 6) };
  const r = { x: tip.x - size * Math.cos(ang + Math.PI / 6), y: tip.y - size * Math.sin(ang + Math.PI / 6) };
  return `M${f(tip.x)} ${f(tip.y)}L${f(l.x)} ${f(l.y)}L${f(r.x)} ${f(r.y)}Z`;
}

/** Géométrie complète d'un connecteur d'après l'état courant des objets de la page. */
export function resolveConnector(c: ConnectorObject, objects: readonly BoardObject[]): ConnectorGeometry {
  const a = resolveEnd(c.from, objects, { x: c.x, y: c.y });
  const b = resolveEnd(c.to, objects, { x: c.x + c.w, y: c.y + c.h });
  // Côtés : automatique = celui qui regarde l'autre extrémité (deux passes pour deux « auto »)
  let side0: FixedSide | null = null, side1: FixedSide | null = null;
  let p0 = a.pt, p1 = b.pt;
  for (let pass = 0; pass < 2; pass++) {
    if (a.o && isAttachedEnd(c.from)) { side0 = c.from.side === 'auto' ? nearestSide(a.o, p1) : c.from.side; p0 = sidePoint(a.o, side0); }
    if (b.o && isAttachedEnd(c.to)) { side1 = c.to.side === 'auto' ? nearestSide(b.o, p0) : c.to.side; p1 = sidePoint(b.o, side1); }
  }
  const d0 = a.o && side0 ? sideDir(a.o, side0) : null;
  const d1 = b.o && side1 ? sideDir(b.o, side1) : null;
  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const size = Math.max(10, c.strokeWidth * 3.5);
  let path: string;
  let mid: Pt;
  const controls: Pt[] = [];
  let tail0: Pt, tail1: Pt; // points d'où partent les têtes
  if (c.route === 'straight' || dist < 1) {
    path = `M${f(p0.x)} ${f(p0.y)}L${f(p1.x)} ${f(p1.y)}`;
    mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    tail0 = p1; tail1 = p0;
  } else if (c.bend) {
    const ctrl = { x: (p0.x + p1.x) / 2 + c.bend.x, y: (p0.y + p1.y) / 2 + c.bend.y };
    controls.push(ctrl);
    path = `M${f(p0.x)} ${f(p0.y)}Q${f(ctrl.x)} ${f(ctrl.y)} ${f(p1.x)} ${f(p1.y)}`;
    mid = bez2(p0, ctrl, p1, 0.5);
    tail0 = ctrl; tail1 = ctrl;
  } else {
    const k = Math.min(160, Math.max(30, dist / 2.5));
    const dir = { x: (p1.x - p0.x) / dist, y: (p1.y - p0.y) / dist };
    const c0 = d0 ? { x: p0.x + d0.x * k, y: p0.y + d0.y * k } : { x: p0.x + dir.x * k, y: p0.y + dir.y * k };
    const c1 = d1 ? { x: p1.x + d1.x * k, y: p1.y + d1.y * k } : { x: p1.x - dir.x * k, y: p1.y - dir.y * k };
    controls.push(c0, c1);
    path = `M${f(p0.x)} ${f(p0.y)}C${f(c0.x)} ${f(c0.y)} ${f(c1.x)} ${f(c1.y)} ${f(p1.x)} ${f(p1.y)}`;
    mid = bez3(p0, c0, c1, p1, 0.5);
    tail0 = c1; tail1 = c0;
  }
  const heads: string[] = [];
  if (c.heads.end) heads.push(headPath(p1, tail0, size));
  if (c.heads.start) heads.push(headPath(p0, tail1, size));
  return { p0, p1, d0, d1, side0, side1, controls, path, mid, heads };
}

/** Boîte englobante d'une géométrie, avec une marge (têtes, épaisseur). */
export function connectorBox(g: ConnectorGeometry, pad = 8): Rect {
  const pts = [g.p0, g.p1, ...g.controls, g.mid];
  const minX = Math.min(...pts.map((p) => p.x)) - pad, maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad, maxY = Math.max(...pts.map((p) => p.y)) + pad;
  return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
}

/**
 * Met à jour la boîte englobante des connecteurs d'après les objets courants. Renvoie le même
 * tableau quand rien ne change (pas de rendu inutile).
 */
export function refreshConnectors(objects: BoardObject[]): BoardObject[] {
  let changed = false;
  const out = objects.map((o) => {
    if (o.type !== 'connector') return o;
    const box = connectorBox(resolveConnector(o, objects));
    if (box.x === o.x && box.y === o.y && box.w === o.w && box.h === o.h) return o;
    changed = true;
    return { ...o, ...box };
  });
  return changed ? out : objects;
}

/** Supprimer un objet supprime les connecteurs qui lui étaient attachés (une seule étape d'annulation). */
export function dropOrphanConnectors(prev: BoardObject[], next: BoardObject[]): BoardObject[] {
  const before = new Set(prev.map((o) => o.id));
  const after = new Set(next.map((o) => o.id));
  const gone = (e: ConnectorEnd) => isAttachedEnd(e) && before.has(e.objectId) && !after.has(e.objectId);
  const out = next.filter((o) => o.type !== 'connector' || (!gone(o.from) && !gone(o.to)));
  return out.length === next.length ? next : out;
}

/** Copie : les extrémités attachées suivent les identifiants recopiés. */
export function remapConnectorEnds(c: ConnectorObject, ids: Map<string, string>): ConnectorObject {
  const remap = (e: ConnectorEnd): ConnectorEnd => (isAttachedEnd(e) ? { ...e, objectId: ids.get(e.objectId) ?? e.objectId } : e);
  return { ...c, from: remap(c.from), to: remap(c.to) };
}

/** Connecteur neuf (courbe, flèche à la fin), boîte à rafraîchir. */
export function newConnector(id: string, from: ConnectorEnd, to: ConnectorEnd, style?: Partial<Pick<ConnectorObject, 'stroke' | 'strokeWidth' | 'dashed' | 'route'>>): ConnectorObject {
  return {
    id, type: 'connector', x: 0, y: 0, w: 0, h: 0,
    from, to, route: style?.route ?? 'curve', heads: { start: false, end: true },
    stroke: style?.stroke ?? CONNECTOR_COLORS[0], strokeWidth: style?.strokeWidth ?? CONNECTOR_WIDTHS.M, dashed: style?.dashed,
  };
}

/** Objet (hors connecteur) sous le point écran : le cadre `[data-obj]` le plus haut du calque DOM. */
export function objectUnderPoint(clientX: number, clientY: number, objects: readonly BoardObject[], exclude?: string): BoardObject | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const frame = (el as HTMLElement).closest?.<HTMLElement>('[data-obj]');
    const id = frame?.dataset.obj;
    if (!id || id === exclude) continue;
    const o = objects.find((t) => t.id === id);
    if (o && o.type !== 'connector') return o;
  }
  return null;
}

/** Rendu canvas (export, vignettes) : même chemin que le DOM. */
export function renderConnector(ctx: CanvasRenderingContext2D, c: ConnectorObject, objects: readonly BoardObject[], scale: number) {
  const g = resolveConnector(c, objects);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineWidth = c.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = c.stroke;
  if (c.dashed) ctx.setLineDash([c.strokeWidth * 3, c.strokeWidth * 2.2]);
  ctx.stroke(new Path2D(g.path));
  ctx.setLineDash([]);
  ctx.fillStyle = c.stroke;
  for (const h of g.heads) { const p = new Path2D(h); ctx.fill(p); ctx.stroke(p); }
  if (c.label) {
    const size = 18;
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
    const w = ctx.measureText(c.label).width + 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(g.mid.x - w / 2, g.mid.y - size * 0.75, w, size * 1.4);
    ctx.fillStyle = '#111827';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, g.mid.x, g.mid.y);
  }
  ctx.restore();
}
