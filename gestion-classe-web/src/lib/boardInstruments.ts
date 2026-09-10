/**
 * Instruments de géométrie posés sur le tableau (règle, équerre, rapporteur).
 * Ce sont des outils, pas des objets du document : ils ne sont pas enregistrés.
 * Le trait tracé au stylo près d'un bord d'instrument est aimanté sur ce bord.
 */

export type InstrumentKind = 'ruler' | 'setsquare' | 'protractor';

export interface Instrument {
  id: string;
  kind: InstrumentKind;
  /** Centre, en unités logiques. */
  x: number;
  y: number;
  /** Rotation en degrés (sens horaire). */
  angle: number;
  /** Longueur (règle, hypoténuse de l'équerre) ou diamètre (rapporteur), en unités. */
  size: number;
}

/** 1 cm sur le tableau = 25 unités (page de 1000 = 40 cm). */
export const UNITS_PER_CM = 25;
/** Distance d'aimantation au bord, en unités. */
export const SNAP_DISTANCE = 12;

export const RULER_WIDTH = 70;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point local (instrument non tourné, centré en 0) → page. */
export function toPage(inst: Instrument, lx: number, ly: number): { x: number; y: number } {
  const a = rad(inst.angle);
  return { x: inst.x + lx * Math.cos(a) - ly * Math.sin(a), y: inst.y + lx * Math.sin(a) + ly * Math.cos(a) };
}

/** Segments (page) sur lesquels un trait s'aimante. */
export function snapEdges(inst: Instrument): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  const s = inst.size;
  if (inst.kind === 'ruler') {
    const h = RULER_WIDTH / 2;
    return [
      { a: toPage(inst, -s / 2, -h), b: toPage(inst, s / 2, -h) },
      { a: toPage(inst, -s / 2, h), b: toPage(inst, s / 2, h) },
    ];
  }
  if (inst.kind === 'setsquare') {
    // Triangle rectangle isocèle : angle droit en bas à gauche, hypoténuse en haut
    const l = s / Math.SQRT2;
    const p0 = toPage(inst, -l / 2, l / 2), p1 = toPage(inst, l / 2, l / 2), p2 = toPage(inst, -l / 2, -l / 2);
    return [{ a: p0, b: p1 }, { a: p0, b: p2 }, { a: p2, b: p1 }];
  }
  return [];
}

/** Sommets d'un instrument (page), pour le test « le doigt est sur le corps ». */
export function outline(inst: Instrument): { x: number; y: number }[] {
  const s = inst.size;
  if (inst.kind === 'ruler') {
    const h = RULER_WIDTH / 2;
    return [toPage(inst, -s / 2, -h), toPage(inst, s / 2, -h), toPage(inst, s / 2, h), toPage(inst, -s / 2, h)];
  }
  if (inst.kind === 'setsquare') {
    const l = s / Math.SQRT2;
    return [toPage(inst, -l / 2, l / 2), toPage(inst, l / 2, l / 2), toPage(inst, -l / 2, -l / 2)];
  }
  // Rapporteur : demi-disque approché par un polygone
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 18; i++) pts.push(toPage(inst, (s / 2) * Math.cos(Math.PI + (i * Math.PI) / 18), (s / 2) * Math.sin(Math.PI + (i * Math.PI) / 18)));
  return pts;
}

/**
 * Aimante un point du stylo sur le bord d'instrument le plus proche (s'il est à moins de
 * SNAP_DISTANCE). Renvoie le point inchangé sinon.
 */
export function snapToInstruments(x: number, y: number, instruments: Instrument[]): { x: number; y: number } {
  let best: { d: number; x: number; y: number } | null = null;
  for (const inst of instruments) {
    for (const { a, b } of snapEdges(inst)) {
      const vx = b.x - a.x, vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2));
      const px = a.x + t * vx, py = a.y + t * vy;
      const d = Math.hypot(px - x, py - y);
      if (d <= SNAP_DISTANCE && (!best || d < best.d)) best = { d, x: px, y: py };
    }
  }
  return best ? { x: best.x, y: best.y } : { x, y };
}

export function newInstrument(kind: InstrumentKind, cx: number, cy: number): Instrument {
  return {
    id: Math.random().toString(36).slice(2, 10),
    kind,
    x: cx,
    y: cy,
    angle: 0,
    size: kind === 'ruler' ? 20 * UNITS_PER_CM : kind === 'setsquare' ? 14 * UNITS_PER_CM : 12 * UNITS_PER_CM,
  };
}
