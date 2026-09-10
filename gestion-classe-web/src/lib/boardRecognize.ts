/**
 * Reconnaissance des formes tracées à main levée (« formes intelligentes »).
 *
 * Entrée : les points d'un trait (unités logiques). Sortie : une forme du catalogue avec
 * sa boîte, ou null si le tracé ne ressemble à rien de connu (il reste alors de l'encre).
 *
 * Méthode, du plus simple au plus précis :
 *  1. rééchantillonnage et simplification du tracé (Ramer–Douglas–Peucker) → sommets ;
 *  2. le tracé est-il fermé ? (retour près du point de départ) ;
 *  3. classification par règles géométriques sur le nombre de sommets et leurs angles :
 *     2 sommets ouverts = ligne ; 3 fermés = triangle ; 4 fermés = rectangle / carré /
 *     losange / parallélogramme ; fermé et « rond » = ellipse / cercle ; 5–8 fermés =
 *     polygone ; ouvert avec un rebroussement en bout = flèche.
 *
 * Pas de dépendance, tout est testable hors navigateur.
 */
import type { Point } from './boardRender';
import type { ShapeKind, ShapePoint } from './boardShapes';

export interface RecognizedShape {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  a?: ShapePoint;
  b?: ShapePoint;
  points?: ShapePoint[];
}

type P = { x: number; y: number };

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

function bbox(pts: P[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Distance d'un point au segment [a, b]. */
function segDist(p: P, a: P, b: P): number {
  const vx = b.x - a.x, vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return dist(p, { x: a.x + t * vx, y: a.y + t * vy });
}

/** Simplification de Ramer–Douglas–Peucker. */
export function simplify(pts: P[], epsilon: number): P[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= epsilon) return [a, b];
  const left = simplify(pts.slice(0, idx + 1), epsilon);
  const right = simplify(pts.slice(idx), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** Rééchantillonnage à pas constant, pour ne pas dépendre de la vitesse du geste. */
function resample(pts: P[], step: number): P[] {
  if (pts.length < 2) return pts.slice();
  const out: P[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = out[out.length - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step) {
      const t = (step - acc) / d;
      const np = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(np);
      a = np;
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  if (dist(out[out.length - 1], pts[pts.length - 1]) > step * 0.3) out.push(pts[pts.length - 1]);
  return out;
}

/** Longueur du tracé. */
function pathLength(pts: P[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Angle intérieur (degrés) au sommet i d'un polygone fermé. */
function innerAngle(poly: P[], i: number): number {
  const n = poly.length;
  const p = poly[i], prev = poly[(i - 1 + n) % n], next = poly[(i + 1) % n];
  const a1 = Math.atan2(prev.y - p.y, prev.x - p.x);
  const a2 = Math.atan2(next.y - p.y, next.x - p.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Écart moyen des points à l'ellipse inscrite dans la boîte (0 = ellipse parfaite). */
function ellipseDeviation(pts: P[], box: { x: number; y: number; w: number; h: number }): number {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const rx = box.w / 2, ry = box.h / 2;
  if (rx < 1 || ry < 1) return Infinity;
  let sum = 0;
  for (const p of pts) {
    const nx = (p.x - cx) / rx, ny = (p.y - cy) / ry;
    sum += Math.abs(Math.hypot(nx, ny) - 1);
  }
  return sum / pts.length;
}

const norm = (p: P, box: { x: number; y: number; w: number; h: number }): ShapePoint => ({
  x: box.w > 0 ? (p.x - box.x) / box.w : 0,
  y: box.h > 0 ? (p.y - box.y) / box.h : 0,
});

/**
 * Reconnaît une forme dans un trait. `null` si rien de convaincant.
 * Les seuils sont volontairement tolérants : au TBI, on trace vite et gros.
 */
export function recognizeShape(raw: Point[]): RecognizedShape | null {
  if (raw.length < 6) return null;
  const pts0: P[] = raw.map((p) => ({ x: p.x, y: p.y }));
  const box = bbox(pts0);
  const diag = Math.hypot(box.w, box.h);
  if (diag < 25) return null; // trop petit pour être une forme voulue

  const pts = resample(pts0, Math.max(2, diag / 80));
  const length = pathLength(pts);
  const closed = dist(pts[0], pts[pts.length - 1]) < Math.max(18, diag * 0.22);
  const eps = diag * 0.06;
  let verts = simplify(pts, eps);
  if (closed && verts.length > 2 && dist(verts[0], verts[verts.length - 1]) < eps * 2) verts = verts.slice(0, -1);

  // ---- Ligne / flèche (tracé ouvert) ----
  if (!closed) {
    if (verts.length === 2) {
      const [a, b] = verts;
      if (dist(a, b) < length * 0.85) return null; // trop tortueux pour une droite
      return lineResult('line', a, b);
    }
    // Flèche : un long segment puis un court rebroussement (la tête tracée d'un trait)
    if (verts.length >= 3 && verts.length <= 5) {
      const a = verts[0];
      const tipIdx = verts.length >= 4 ? verts.length - 3 : verts.length - 2;
      const tip = verts[tipIdx];
      const shaft = dist(a, tip);
      const tail = pathLength(verts.slice(tipIdx));
      if (shaft > diag * 0.6 && tail < shaft * 0.45) return lineResult('arrow', a, tip);
    }
    return null;
  }

  // ---- Tracé fermé ----
  const rect = { x: box.x, y: box.y, w: box.w, h: box.h };
  const ell = ellipseDeviation(pts, box);
  const n = verts.length;

  if (n === 3) return { kind: 'triangle', ...rect, points: verts.map((v) => norm(v, box)) };

  if (n === 4) {
    const angles = verts.map((_, i) => innerAngle(verts, i));
    const right = angles.every((d) => Math.abs(d - 90) < 18);
    const axisAligned = verts.every((v) =>
      Math.abs(v.x - box.x) < eps * 1.6 || Math.abs(v.x - box.x - box.w) < eps * 1.6
    ) && verts.every((v) => Math.abs(v.y - box.y) < eps * 1.6 || Math.abs(v.y - box.y - box.h) < eps * 1.6);
    if (right && axisAligned) {
      const squareish = Math.abs(box.w - box.h) < Math.max(box.w, box.h) * 0.12;
      const size = Math.max(box.w, box.h);
      return squareish
        ? { kind: 'rect', x: box.x + (box.w - size) / 2, y: box.y + (box.h - size) / 2, w: size, h: size }
        : { kind: 'rect', ...rect };
    }
    // Losange : sommets près des milieux des côtés de la boîte
    const mids = [
      { x: box.x + box.w / 2, y: box.y }, { x: box.x + box.w, y: box.y + box.h / 2 },
      { x: box.x + box.w / 2, y: box.y + box.h }, { x: box.x, y: box.y + box.h / 2 },
    ];
    const nearMid = verts.every((v) => mids.some((m) => dist(v, m) < diag * 0.14));
    if (nearMid) return { kind: 'diamond', ...rect };
    // Quadrilatère quelconque (parallélogramme, trapèze…) : on garde ses sommets
    return { kind: 'polygon', ...rect, points: verts.map((v) => norm(v, box)) };
  }

  // Rond : beaucoup de sommets et faible écart à l'ellipse (avant les polygones réguliers)
  if (n >= 5 && ell < 0.16) {
    const circ = Math.abs(box.w - box.h) < Math.max(box.w, box.h) * 0.15;
    if (circ) {
      const d = (box.w + box.h) / 2;
      return { kind: 'ellipse', x: box.x + (box.w - d) / 2, y: box.y + (box.h - d) / 2, w: d, h: d };
    }
    return { kind: 'ellipse', ...rect };
  }

  if (n >= 5 && n <= 8) return { kind: 'polygon', ...rect, points: verts.map((v) => norm(v, box)) };

  return null;
}

function lineResult(kind: 'line' | 'arrow', a: P, b: P): RecognizedShape {
  // Presque horizontale / verticale : on redresse (comme le fait la main en pensée)
  const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI));
  let a2 = { ...a }, b2 = { ...b };
  if (ang < 7 || ang > 173) { const y = (a.y + b.y) / 2; a2 = { x: a.x, y }; b2 = { x: b.x, y }; }
  else if (Math.abs(ang - 90) < 7) { const x = (a.x + b.x) / 2; a2 = { x, y: a.y }; b2 = { x, y: b.y }; }
  const bx = bbox([a2, b2]);
  const w = Math.max(bx.w, 0), h = Math.max(bx.h, 0);
  return {
    kind,
    x: bx.x, y: bx.y, w, h,
    a: { x: w > 0 ? (a2.x - bx.x) / w : 0, y: h > 0 ? (a2.y - bx.y) / h : 0 },
    b: { x: w > 0 ? (b2.x - bx.x) / w : 0, y: h > 0 ? (b2.y - bx.y) / h : 0 },
  };
}
