import { useEffect, useRef } from 'react';

/**
 * Le sol du thème « Rétro 84 » : une grille rose en perspective qui défile vers nous, avec la route
 * au milieu (bords cyan, tirets jaunes), dessinée à chaque image sur un canvas.
 *
 * Chaque ligne de la grille est posée à une profondeur ; à l'écran, elle est d'autant plus bas
 * qu'elle est proche (hauteur = hauteur du sol / profondeur). En avançant, les lignes naissent
 * contre l'horizon, serrées et pâles, puis descendent en s'écartant et en s'épaississant. Les
 * lignes de fuite partent toutes du point de l'horizon où se couche le soleil.
 *
 * Quand l'élève touche la voiture (`turbo` dans l'attribut `data-fx` du décor), la grille accélère
 * pendant deux secondes, puis ralentit jusqu'à sa vitesse de croisière. Rien ne bouge si l'appareil
 * demande de réduire les animations (`data-still`), rien n'est dessiné quand la page est cachée.
 */

const HEIGHT = 104;
/** Écart entre deux lignes de la grille, en profondeur (la ligne la plus proche est à 1). */
const GAP = 0.34;
/** Vitesse de croisière, en profondeur par seconde. */
const SPEED = 0.5;
/** Vitesse en accélération, en multiple de la vitesse de croisière. */
const TURBO = 4.6;
/** Demi-largeur de la route et écart des lignes de fuite, au bas du sol (px). */
const ROAD = 62;
const STEP = 44;

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** Multiple de la vitesse, `t` secondes après le toucher : on accélère, on file, on ralentit. */
function boost(t: number): number {
  if (t < 0 || t > 3.6) return 1;
  return 1 + (TURBO - 1) * Math.min(smooth(t / 0.55), 1 - smooth((t - 2.25) / 1.2));
}

export function Grid() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const decor = canvas.closest('.el-decor');
    let w = 0;
    let h = HEIGHT;
    let ratio = 1;
    let travel = 0;
    let turboAt = -1;

    const draw = () => {
      if (!w) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cx = w / 2;
      const far = h + 40;

      // Le sol, plus clair contre l'horizon
      const ground = ctx.createLinearGradient(0, 0, 0, h);
      ground.addColorStop(0, '#3E0F62');
      ground.addColorStop(0.2, '#2A0B48');
      ground.addColorStop(1, '#1A0B2E');
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, w, h);

      // La route
      const road = (y: number) => (ROAD * y) / h;
      ctx.fillStyle = '#13051F';
      ctx.beginPath();
      ctx.moveTo(cx - 0.6, 0);
      ctx.lineTo(cx + 0.6, 0);
      ctx.lineTo(cx + road(far), far);
      ctx.lineTo(cx - road(far), far);
      ctx.closePath();
      ctx.fill();

      // Lignes de fuite
      const pink = ctx.createLinearGradient(0, 0, 0, h);
      pink.addColorStop(0, 'rgba(255, 79, 216, 0)');
      pink.addColorStop(0.3, 'rgba(255, 79, 216, 0.7)');
      pink.addColorStop(1, 'rgba(255, 110, 225, 1)');
      ctx.strokeStyle = pink;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let j = 1; j <= 18; j += 1) {
        for (const side of [-1, 1]) {
          const x = side * (ROAD + j * STEP);
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx + (x * far) / h, far);
        }
      }
      ctx.stroke();

      // Lignes en travers, de part et d'autre de la route : un halo large, puis le trait
      const offset = travel % GAP;
      for (let k = 0; k < 160; k += 1) {
        const z = 0.8 + k * GAP - offset;
        const y = h / z;
        if (y > h + 3) continue;
        if (y < 1.4) break;
        const near = y / h;
        const edge = road(y);
        for (const pass of [0, 1]) {
          if (!pass && near < 0.12) continue;
          ctx.globalAlpha = Math.min(1, 0.04 + near * 1.5) * (pass ? 1 : 0.22);
          ctx.lineWidth = (0.8 + near * 1.5) * (pass ? 1 : 3.4);
          ctx.strokeStyle = '#FF5FDC';
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(cx - edge, y);
          ctx.moveTo(cx + edge, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Tirets du milieu de la route
      const dash = travel % (GAP * 2);
      ctx.fillStyle = '#FFE27A';
      for (let k = 0; k < 80; k += 1) {
        const z0 = 0.7 + k * GAP * 2 - dash;
        const y0 = h / z0;
        const y1 = h / (z0 + GAP * 0.9);
        if (y1 > h + 3) continue;
        if (y0 < 2) break;
        ctx.globalAlpha = Math.min(1, 0.1 + (y0 / h) * 1.1);
        const a = (2.4 * y0) / h;
        const b = (2.4 * y1) / h;
        ctx.beginPath();
        ctx.moveTo(cx - a, y0);
        ctx.lineTo(cx + a, y0);
        ctx.lineTo(cx + b, y1);
        ctx.lineTo(cx - b, y1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Bords de la route, en cyan
      const cyan = ctx.createLinearGradient(0, 0, 0, h);
      cyan.addColorStop(0, 'rgba(72, 229, 255, 0)');
      cyan.addColorStop(0.35, 'rgba(72, 229, 255, 0.8)');
      cyan.addColorStop(1, 'rgba(120, 240, 255, 1)');
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx - road(far), far);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + road(far), far);
      ctx.stroke();

      // La ligne d'horizon qui brille
      const glow = ctx.createLinearGradient(0, 0, 0, 6);
      glow.addColorStop(0, 'rgba(255, 140, 230, 0.4)');
      glow.addColorStop(1, 'rgba(255, 140, 230, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, 6);
      ctx.fillStyle = '#FFC4F2';
      ctx.fillRect(0, 0, w, 1.6);

      // En bas, le sol devient uni sous le contenu
      const fade = ctx.createLinearGradient(0, h - 34, 0, h);
      fade.addColorStop(0, 'rgba(26, 11, 46, 0)');
      fade.addColorStop(1, '#1A0B2E');
      ctx.fillStyle = fade;
      ctx.fillRect(0, h - 34, w, 34);
    };

    const fit = () => {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight || HEIGHT;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      draw();
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(canvas);

    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      if (decor?.hasAttribute('data-still') || decor?.hasAttribute('data-paused')) {
        last = 0;
        return;
      }
      if (last && now - last < 15) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const fx = (decor?.getAttribute('data-fx') ?? '').split(' ').includes('turbo');
      if (fx && turboAt < 0) turboAt = now;
      if (!fx) turboAt = -1;
      travel += SPEED * (turboAt < 0 ? 1 : boost((now - turboAt) / 1000)) * dt;
      draw();
    };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="rt-grid" />;
}
