import { useEffect, useRef } from 'react';
import { seeded } from '../shared';

/**
 * La double hélice du thème « ADN », dessinée sur un canvas.
 *
 * Deux brins en vis tournent autour d'un axe horizontal : chaque point d'un brin a une hauteur
 * (cosinus de son angle) et une profondeur (sinus). On dessine d'abord les portions qui passent
 * derrière (fines, pâles), puis les barreaux (les paires de bases, une couleur par base), puis les
 * portions qui passent devant (épaisses, foncées) : c'est ce qui donne le relief.
 *
 * Au toucher (`data-fx` du décor contient « copie ») : une seconde hélice, d'abord confondue avec
 * la première, s'en détache vers le bas, reste un moment, puis s'éloigne en s'effaçant.
 */

const W = 560;
const H = 240;
const MID = 80;
const AMP = 31;
const PITCH = 165;
const STEP = 16.5;
const TURN_MS = 5200;
const COPY_MS = 5000;

const BASES = [
  ['#E4572E', '#F2B134'], // A – T
  ['#F2B134', '#E4572E'], // T – A
  ['#2E86AB', '#3BB273'], // C – G
  ['#3BB273', '#2E86AB'], // G – C
] as const;

const pick = seeded(31);
const RUNGS = Array.from({ length: Math.ceil(W / STEP) + 1 }, (_, i) => ({ x: 4 + i * STEP, pair: BASES[Math.floor(pick() * BASES.length)] ?? BASES[0] }));

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix = (a: Rgb, b: Rgb, t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const A_FRONT = rgb('#0B7A75');
const A_BACK = rgb('#8CCBC5');
const B_FRONT = rgb('#2FA39A');
const B_BACK = rgb('#B4DEDA');
const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function drawHelix(ctx: CanvasRenderingContext2D, phase: number, dy: number, alpha: number): void {
  const y0 = MID + dy;
  const at = (x: number) => {
    const a = phase + (x / PITCH) * Math.PI * 2;
    return { y: Math.cos(a) * AMP, z: Math.sin(a) };
  };
  const strand = (sign: 1 | -1, front: boolean) => {
    for (let x = -6; x < W + 6; x += 5) {
      const p = at(x);
      const q = at(x + 5);
      const z = ((p.z + q.z) / 2) * sign;
      if (z >= 0 !== front) continue;
      const t = (z + 1) / 2;
      ctx.strokeStyle = sign === 1 ? mix(A_BACK, A_FRONT, t) : mix(B_BACK, B_FRONT, t);
      ctx.lineWidth = 3.2 + 4.2 * t;
      ctx.beginPath();
      ctx.moveTo(x, y0 + p.y * sign);
      ctx.lineTo(x + 5, y0 + q.y * sign);
      ctx.stroke();
    }
  };
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  strand(1, false);
  strand(-1, false);
  ctx.lineWidth = 3.4;
  for (const rung of RUNGS) {
    const { y } = at(rung.x);
    if (Math.abs(y) < 4) continue;
    const reach = y - Math.sign(y) * 2.5;
    ctx.strokeStyle = rung.pair[0];
    ctx.beginPath();
    ctx.moveTo(rung.x, y0 + reach);
    ctx.lineTo(rung.x, y0 + Math.sign(y) * 1.2);
    ctx.stroke();
    ctx.strokeStyle = rung.pair[1];
    ctx.beginPath();
    ctx.moveTo(rung.x, y0 - Math.sign(y) * 1.2);
    ctx.lineTo(rung.x, y0 - reach);
    ctx.stroke();
  }
  strand(1, true);
  strand(-1, true);
  ctx.globalAlpha = 1;
}

export function Helix() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const decor = canvas.closest('.el-decor');
    let copyStart = -1;
    let wasOn = false;

    const draw = (now: number) => {
      const on = (decor?.getAttribute('data-fx') ?? '').split(' ').includes('copie');
      if (on && !wasOn) copyStart = now;
      wasOn = on;
      const u = copyStart < 0 ? -1 : (now - copyStart) / COPY_MS;
      if (u >= 1) copyStart = -1;
      const phase = (now / TURN_MS) * Math.PI * 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let lift = 0;
      if (u >= 0 && u < 1) {
        lift = u < 0.62 ? ease(u / 0.22) : 1 - ease((u - 0.62) / 0.38);
        const leave = Math.max(0, (u - 0.62) / 0.24);
        const copyY = u < 0.22 ? 38 * ease(u / 0.22) : u < 0.62 ? 38 + 4 * ((u - 0.22) / 0.4) : 42 + 78 * leave * leave;
        const copyAlpha = u < 0.04 ? u / 0.04 : Math.max(0, 1 - leave);
        if (copyAlpha > 0) drawHelix(ctx, phase, copyY, copyAlpha);
      }
      drawHelix(ctx, phase, -34 * lift, 1);
    };

    draw(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      if (now - last < 32 || decor?.hasAttribute('data-paused')) return;
      last = now;
      draw(now);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="dn-helix" />;
}
