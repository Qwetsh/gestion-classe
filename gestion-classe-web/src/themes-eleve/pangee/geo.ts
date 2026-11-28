/**
 * Géographie du planisphère du thème « Pangée ».
 *
 * La carte est une projection simple (un degré = une unité) : x = longitude + 180, y = 90 - latitude,
 * dans un cadre de 360 × 180. Chaque continent est dessiné à sa place d'aujourd'hui (contours très
 * simplifiés, adoucis en courbes) ; sa place dans la Pangée est un décalage (dx, dy), une rotation a
 * (en degrés, autour de son centre) et, pour l'Antarctique écrasé par la projection, une échelle.
 * La feuille de style passe de l'une à l'autre (variable `--w` : 1 = Pangée, 0 = aujourd'hui).
 */

export type Land = {
  id: string;
  /** Contour, îles comprises (chemin SVG). */
  d: string;
  /** Centre de rotation (centre de gravité du contour principal). */
  cx: number;
  cy: number;
  /** Place dans la Pangée, par rapport à aujourd'hui. */
  dx: number;
  dy: number;
  a: number;
  sx: number;
  sy: number;
};

const f = (n: number) => n.toFixed(1);

/** Points de la carte à partir de couples (longitude, latitude). */
function project(lonLat: number[]): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < lonLat.length; i += 2) pts.push([lonLat[i] + 180, 90 - lonLat[i + 1]]);
  return pts;
}

/** Contour fermé adouci : on passe par le milieu de chaque côté, les sommets servent de points d'appui. */
function smooth(pts: [number, number][]): string {
  const n = pts.length;
  const mid = (i: number) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const start = mid(n - 1);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/** Centre de gravité d'un polygone (formule du lacet). */
function centroid(pts: [number, number][]): [number, number] {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    area += c;
    x += (x0 + x1) * c;
    y += (y0 + y1) * c;
  }
  return [x / (3 * area), y / (3 * area)];
}

type Shape = { id: string; main: number[]; isles?: number[][]; dx: number; dy: number; a: number; sx?: number; sy?: number };

const SHAPES: Shape[] = [
  {
    id: 'amn', // Amérique du Nord, Groenland, Cuba
    main: [
      -166, 66, -162, 70, -150, 71, -140, 70, -128, 70, -115, 68, -100, 68, -92, 70, -82, 69, -80, 64, -88, 64, -93, 59, -92, 57,
      -85, 55, -80, 52, -79, 57, -77, 61, -72, 61, -65, 60, -62, 57, -58, 54, -56, 51, -60, 48, -65, 49, -64, 46, -60, 46, -66, 44,
      -70, 42, -74, 40, -76, 37, -76, 35, -81, 31, -80, 26, -81, 25, -83, 28, -85, 30, -89, 30, -94, 29, -97, 27, -97, 22, -94, 18,
      -91, 19, -90, 21, -87, 21, -88, 16, -84, 15, -83, 10, -79, 9, -77, 8, -80, 7, -83, 8, -86, 12, -91, 14, -96, 16, -105, 20,
      -106, 23, -110, 24, -112, 29, -114, 31, -117, 32, -120, 34, -123, 38, -124, 42, -124, 47, -127, 50, -131, 54, -136, 58,
      -142, 60, -148, 61, -152, 59, -157, 57, -162, 55, -158, 58, -162, 60, -165, 62, -164, 64,
    ],
    isles: [
      [-73, 78, -60, 82, -40, 83, -22, 82, -18, 77, -21, 71, -25, 68, -35, 66, -43, 60, -49, 62, -52, 66, -54, 70, -58, 75, -67, 77],
      [-85, 22, -80, 23, -74, 20, -78, 20],
    ],
    dx: 48, dy: 24, a: -6,
  },
  {
    id: 'ams', // Amérique du Sud
    main: [
      -77, 8, -72, 12, -64, 10, -60, 9, -57, 6, -52, 5, -50, 1, -48, -1, -44, -2, -39, -3, -35, -6, -35, -9, -38, -13, -39, -18,
      -41, -22, -45, -24, -48, -26, -49, -29, -53, -34, -58, -35, -57, -38, -62, -39, -65, -42, -65, -46, -68, -50, -69, -53,
      -67, -55, -71, -54, -74, -50, -75, -46, -73, -41, -73, -36, -71, -30, -70, -22, -71, -18, -76, -14, -79, -8, -81, -5,
      -80, -1, -78, 2, -77, 4, -78, 7,
    ],
    dx: 47, dy: 18, a: -42,
  },
  {
    id: 'afr', // Afrique, Arabie, Madagascar
    main: [
      -17, 21, -16, 25, -13, 28, -10, 30, -9, 33, -6, 36, -1, 35, 5, 37, 10, 37, 11, 34, 15, 32, 20, 31, 25, 32, 32, 31, 35, 33,
      36, 36, 44, 37, 48, 30, 51, 25, 56, 24, 59, 22, 55, 17, 52, 16, 45, 13, 51, 12, 51, 9, 48, 5, 44, 0, 41, -2, 40, -6, 39, -10,
      40, -15, 36, -19, 35, -23, 33, -26, 32, -29, 28, -33, 25, -34, 20, -35, 18, -32, 15, -27, 12, -18, 13, -12, 12, -6, 9, -1,
      9, 4, 6, 4, 2, 6, -2, 5, -5, 5, -8, 4, -11, 7, -13, 9, -15, 11, -17, 14, -17, 17,
    ],
    isles: [[44, -25, 47, -25, 50, -16, 49, -12, 44, -17]],
    dx: -8, dy: 15, a: -6,
  },
  {
    id: 'eur', // Europe et Asie, îles Britanniques, Japon, Bornéo, Sumatra
    main: [
      -9, 37, -9, 43, -2, 43.5, -1, 46, -4, 48, -1, 49, 2, 51, 5, 53, 8, 54, 8, 57, 10, 58, 12, 56, 14, 55, 19, 54, 21, 57, 24, 59,
      28, 60, 23, 61, 21, 63, 25, 65, 22, 66, 17, 62, 19, 60, 16, 56, 12, 59, 10, 59, 5, 59, 5, 62, 10, 64, 14, 67, 20, 70, 26, 71,
      31, 70, 40, 67, 42, 66, 35, 66, 37, 64, 44, 66, 44, 68, 55, 68, 60, 69, 68, 73, 72, 72, 80, 73, 88, 76, 100, 78, 112, 76,
      120, 73, 130, 72, 140, 72, 150, 71, 160, 70, 170, 70, 180, 66, 180, 64, 176, 62, 170, 60, 163, 59, 162, 56, 156, 51, 155, 57,
      160, 61, 150, 59, 142, 59, 136, 55, 140, 52, 141, 48, 138, 46, 133, 43, 130, 42, 129, 39, 129, 35, 127, 35, 126, 37, 126, 39,
      122, 40, 118, 38, 122, 37, 120, 34, 122, 31, 121, 28, 119, 25, 115, 23, 110, 21, 106, 19, 108, 16, 109, 12, 106, 9, 103, 10,
      100, 13, 99, 10, 100, 7, 103, 4, 104, 1, 101, 3, 98, 8, 98, 14, 97, 17, 94, 16, 94, 19, 92, 22, 89, 22, 88, 27, 84, 28,
      80, 30, 76, 33, 74, 35, 71, 33, 70, 29, 68, 25, 62, 25, 57, 26, 56, 27, 52, 28, 48, 31, 44, 38, 36, 37, 28, 37, 26, 40,
      23, 40, 24, 38, 22, 37, 21, 39, 19, 42, 16, 43, 14, 45, 12, 45, 13, 44, 16, 41, 18, 40, 16, 38, 15, 40, 12, 42, 10, 44,
      7, 44, 3, 43, 0, 39, -1, 37, -5, 36,
    ],
    isles: [
      [-5, 50, 1, 51, 2, 53, -1, 55, -2, 57, -5, 58.5, -6, 56, -4, 54, -5, 52],
      [-10, 52, -6, 52, -6, 55, -8, 55, -10, 54],
      [130, 31, 132, 34, 135, 34, 140, 35, 141, 38, 142, 41, 140, 41, 139, 38, 136, 37, 133, 35, 130, 34],
      [109, 1, 110, 2, 116, 7, 119, 5, 118, 1, 116, -4, 111, -3],
      [95, 5, 98, 4, 104, -2, 106, -6, 102, -4, 100, -1],
    ],
    dx: -4, dy: 16, a: -4,
  },
  {
    id: 'ind', // Inde
    main: [
      68, 24, 70, 21, 73, 19, 73, 16, 75, 12, 77, 8, 80, 10, 80, 13, 80, 16, 83, 18, 86, 20, 87, 22, 89, 22, 88, 27, 84, 28, 80, 30,
      76, 33, 74, 35, 71, 33, 70, 29, 68, 25,
    ],
    dx: -35, dy: 55, a: 40,
  },
  {
    id: 'ant', // Antarctique (étiré par la projection : la Pangée le rend plus ramassé)
    main: [
      -150, -80, -120, -75, -90, -73, -75, -72, -60, -74, -45, -77, -20, -73, 0, -70, 30, -69, 60, -67, 90, -66, 120, -66,
      150, -69, 165, -74, 160, -82, 120, -86, 60, -87, 0, -87, -60, -87, -120, -85,
    ],
    dx: 9, dy: -12, a: 0, sx: 0.25, sy: 1.8,
  },
  {
    id: 'aus', // Australie, Nouvelle-Guinée, Tasmanie
    main: [
      114, -22, 114, -26, 115, -34, 118, -35, 124, -33, 129, -32, 132, -32, 135, -35, 138, -35, 140, -38, 144, -38, 147, -39,
      150, -37, 153, -31, 153, -25, 149, -21, 146, -19, 145, -15, 143, -11, 142, -11, 141, -15, 140, -17, 137, -15, 136, -12,
      131, -11, 129, -15, 126, -14, 122, -17, 120, -19,
    ],
    isles: [
      [131, -1, 135, -3, 141, -3, 146, -6, 150, -10, 145, -8, 141, -9, 138, -8, 137, -5],
      [145, -41, 148, -41, 147, -43.5, 146, -43.5],
    ],
    dx: -66, dy: 36, a: -40,
  },
];

export const LANDS: Land[] = SHAPES.map((s) => {
  const main = project(s.main);
  const [cx, cy] = centroid(main);
  const d = [smooth(main), ...(s.isles ?? []).map((isle) => smooth(project(isle)))].join('');
  return { id: s.id, d, cx, cy, dx: s.dx, dy: s.dy, a: s.a, sx: s.sx ?? 1, sy: s.sy ?? 1 };
});

export const LAND = Object.fromEntries(LANDS.map((l) => [l.id, l])) as Record<string, Land>;

/**
 * Place, dans le dessin d'aujourd'hui d'un continent, d'un point repéré sur la Pangée (x, y) :
 * on défait le décalage, la rotation et l'échelle de ce continent. Sert à poser les fossiles de
 * façon qu'ils forment des bandes continues quand les continents sont rassemblés.
 */
export function fromPangaea(id: string, x: number, y: number): [number, number] {
  const l = LAND[id];
  const px = x - l.cx - l.dx;
  const py = y - l.cy - l.dy;
  const r = (-l.a * Math.PI) / 180;
  const qx = px * Math.cos(r) - py * Math.sin(r);
  const qy = px * Math.sin(r) + py * Math.cos(r);
  return [l.cx + qx / l.sx, l.cy + qy / l.sy];
}

/** Le même point, de l'autre sens : où se trouve, dans la Pangée, un point du dessin d'aujourd'hui. */
export function toPangaea(id: string, x: number, y: number): [number, number] {
  const l = LAND[id];
  const px = (x - l.cx) * l.sx;
  const py = (y - l.cy) * l.sy;
  const r = (l.a * Math.PI) / 180;
  return [l.cx + l.dx + px * Math.cos(r) - py * Math.sin(r), l.cy + l.dy + px * Math.sin(r) + py * Math.cos(r)];
}
