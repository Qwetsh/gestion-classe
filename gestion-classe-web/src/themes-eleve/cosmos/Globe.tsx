import { useEffect, useRef } from 'react';

/**
 * La surface de la planète du thème « Cosmos », dessinée comme une vraie sphère qui tourne.
 *
 * Une carte de la planète (bandes de nuages, grande tache, petits ovales) est calculée une fois ;
 * à chaque image, chaque point du disque va chercher sur cette carte la couleur du point de la
 * sphère qu'il montre. Les détails naissent donc sur un bord, traversent le disque (vite au centre,
 * lentement près des bords, comme sur un globe) et disparaissent de l'autre côté. L'axe est penché
 * comme l'anneau. L'éclairage (reflet, côté nuit) est posé par-dessus en CSS et ne tourne pas.
 */

const SIZE = 232; // 116 px à l'écran, dessinés deux fois plus fin
const MAP_W = 1024;
const MAP_H = 256;
const TURN_SECONDS = 38;
const TILT = (16 * Math.PI) / 180;

type Rgb = [number, number, number];
const STOPS: [number, Rgb][] = [
  [0, [44, 33, 140]],
  [0.3, [78, 64, 196]],
  [0.55, [124, 108, 236]],
  [0.78, [178, 165, 255]],
  [1, [226, 214, 255]],
];

function ramp(t: number): Rgb {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i += 1) {
    const [t1, c1] = STOPS[i] as [number, Rgb];
    const [t0, c0] = STOPS[i - 1] as [number, Rgb];
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return [226, 214, 255];
}

/** Taches ovales : position (u, v entre 0 et 1), demi-axes, couleur, force. */
const SPOTS: { u: number; v: number; ru: number; rv: number; color: Rgb; gain: number }[] = [
  { u: 0.3, v: 0.6, ru: 0.062, rv: 0.05, color: [255, 176, 226], gain: 0.95 },
  { u: 0.3, v: 0.6, ru: 0.03, rv: 0.022, color: [255, 232, 246], gain: 0.9 },
  { u: 0.68, v: 0.36, ru: 0.03, rv: 0.02, color: [240, 234, 255], gain: 0.7 },
  { u: 0.84, v: 0.7, ru: 0.04, rv: 0.022, color: [40, 30, 130], gain: 0.55 },
  { u: 0.08, v: 0.3, ru: 0.022, rv: 0.014, color: [240, 234, 255], gain: 0.6 },
  { u: 0.52, v: 0.78, ru: 0.026, rv: 0.016, color: [240, 234, 255], gain: 0.5 },
];

/** La carte de la planète, qui se raccorde à elle-même de gauche à droite. */
function buildMap(): Uint32Array {
  const map = new Uint32Array(MAP_W * MAP_H);
  const turn = Math.PI * 2;
  for (let y = 0; y < MAP_H; y += 1) {
    const v = y / (MAP_H - 1);
    for (let x = 0; x < MAP_W; x += 1) {
      const u = x / MAP_W;
      // Bandes de nuages : des lits horizontaux, dont le bord ondule
      const wave = 0.2 * Math.sin(turn * u * 2 + v * 6) + 0.11 * Math.sin(turn * u * 5 - v * 11) + 0.05 * Math.sin(turn * u * 11 + v * 23);
      const band = Math.sin(v * Math.PI * 5.6 + wave);
      // De fines bandes dans les grandes (elles suivent les parallèles : aucun quadrillage)
      const streak = 0.07 * Math.sin(v * Math.PI * 23 + 0.9 * Math.sin(turn * u * 3)) + 0.035 * Math.sin(v * Math.PI * 41 + 0.7 * Math.sin(turn * u * 2 + 1.3));
      let [r, g, b] = ramp(0.5 + 0.36 * band + streak);
      for (const spot of SPOTS) {
        let du = Math.abs(u - spot.u);
        if (du > 0.5) du = 1 - du;
        const d = (du / spot.ru) ** 2 + ((v - spot.v) / spot.rv) ** 2;
        if (d < 4) {
          const k = spot.gain * Math.exp(-d * 1.6);
          r += (spot.color[0] - r) * k;
          g += (spot.color[1] - g) * k;
          b += (spot.color[2] - b) * k;
        }
      }
      // Les pôles, un peu plus sombres
      const pole = 1 - 0.3 * Math.abs(v - 0.5) ** 2 * 4;
      map[y * MAP_W + x] = (255 << 24) | (Math.round(b * pole) << 16) | (Math.round(g * pole) << 8) | Math.round(r * pole);
    }
  }
  return map;
}

export function Globe() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const map = buildMap();
    const image = ctx.createImageData(SIZE, SIZE);
    const pixels = new Uint32Array(image.data.buffer);

    // Pour chaque point du disque : la ligne de la carte (sa latitude) et sa longitude de départ
    const row = new Int32Array(SIZE * SIZE).fill(-1);
    const lon = new Float32Array(SIZE * SIZE);
    const cos = Math.cos(TILT);
    const sin = Math.sin(TILT);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const nx = ((x + 0.5) / SIZE) * 2 - 1;
        const ny = ((y + 0.5) / SIZE) * 2 - 1;
        const px = nx * cos + ny * sin;
        const py = -nx * sin + ny * cos;
        const d2 = px * px + py * py;
        if (d2 > 1.04) continue;
        const depth = Math.sqrt(Math.max(0, 1 - d2));
        const lat = Math.asin(Math.max(-1, Math.min(1, py)));
        const i = y * SIZE + x;
        row[i] = Math.round((lat / Math.PI + 0.5) * (MAP_H - 1)) * MAP_W;
        lon[i] = (Math.atan2(px, depth) / (Math.PI * 2) + 0.5) * MAP_W;
      }
    }

    const draw = (seconds: number) => {
      const shift = ((seconds / TURN_SECONDS) % 1) * MAP_W;
      for (let i = 0; i < pixels.length; i += 1) {
        const base = row[i] ?? -1;
        if (base < 0) continue;
        pixels[i] = map[base + (Math.floor((lon[i] ?? 0) + shift) % MAP_W)] ?? 0;
      }
      ctx.putImageData(image, 0, 0);
    };

    draw(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      if (now - last < 32) return;
      last = now;
      draw(now / 1000);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="co-surface" />;
}
