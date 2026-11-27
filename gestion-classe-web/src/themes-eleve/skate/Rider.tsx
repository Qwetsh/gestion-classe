import { useEffect, useRef } from 'react';

/**
 * Le skateur du thème « Skatepark » : il va et vient dans la rampe, sans animation écrite d'avance.
 *
 * Sa position est une distance `s` le long de la rampe (courbe de gauche, plat, courbe de droite, et
 * au-delà de chaque bord, la verticale où il décolle). À chaque image on applique la pesanteur le
 * long de la pente : il accélère en descendant, traverse le plat à vitesse constante, ralentit en
 * montant, décolle, s'arrête en l'air et retombe. Comme un vrai skateur, il « pompe » dans la rampe
 * pour garder toujours la même hauteur de saut (son énergie est ramenée doucement vers la bonne).
 *
 * Au toucher (`data-fx` du décor contient « figure ») : il pompe plus fort, sort plus haut au bord
 * suivant et fait un tour complet en l'air avant de se recevoir. Pendant cette figure, l'attribut
 * `data-trick` est posé sur le dessin de la rampe (le copain sur la plateforme applaudit).
 */

const R = 70; // rayon des courbes
const LX = 106; // bord gauche
const RX = 374; // bord droit
const LIP = 132; // hauteur des bords
const FLAT = LIP + R;
const S1 = (Math.PI / 2) * R; // fin de la courbe de gauche
const S2 = S1 + (RX - LX - 2 * R); // fin du plat
const S3 = S2 + S1; // bord droit
const G = 340; // pesanteur, en px/s²
const AIR = 20; // hauteur d'un saut ordinaire au-dessus du bord
const AIR_TRICK = 68; // hauteur du saut de la figure
const DEG = 180 / Math.PI;

interface Spot { x: number; y: number; angle: number; height: number; pull: number }

/** Point de la rampe à la distance `s` : position, inclinaison, hauteur au-dessus du plat, et part de la pesanteur qui tire le long de la pente. */
function spot(s: number): Spot {
  if (s < 0) return { x: LX, y: LIP + s, angle: 90, height: R - s, pull: 1 };
  if (s < S1) {
    const a = s / R;
    return { x: LX + R - R * Math.cos(a), y: LIP + R * Math.sin(a), angle: 90 - a * DEG, height: R * (1 - Math.sin(a)), pull: Math.cos(a) };
  }
  if (s < S2) return { x: LX + R + (s - S1), y: FLAT, angle: 0, height: 0, pull: 0 };
  if (s < S3) {
    const a = (s - S2) / R;
    return { x: RX - R + R * Math.sin(a), y: LIP + R * Math.cos(a), angle: -a * DEG, height: R * (1 - Math.cos(a)), pull: -Math.sin(a) };
  }
  return { x: RX, y: LIP - (s - S3), angle: -90, height: R + (s - S3), pull: -1 };
}

const START = S1 + 60;
/** Place le skateur sur la rampe ; le tour de la figure se fait autour du milieu de son corps, pas autour des roues. */
const pose = (p: Spot, spin: number) =>
  `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)})${spin ? ` rotate(${spin.toFixed(2)} 0 -20)` : ''}`;
const squash = (c: number) => `translate(0 -8) scale(1 ${c.toFixed(3)}) translate(0 8)`;

export function Rider() {
  const ref = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const rider = ref.current;
    const body = bodyRef.current;
    if (!rider || !body) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const decor = rider.closest('.el-decor');
    const park = rider.ownerSVGElement;

    let s = START;
    let v = Math.sqrt(2 * G * (R + AIR));
    let crouch = 0.92;
    let wasOn = false;
    let pending = false; // une figure est demandée : il pompe plus fort jusqu'au prochain bord
    let spinFrom = -1; // instant du décollage de la figure (s)
    let spinFor = 0; // durée du vol (s)
    let spinDir = 1;
    let cheerUntil = -1;
    let clock = 0;
    let last = -1;
    let frame = 0;

    const step = (dt: number) => {
      const before = spot(s);
      const wasAir = s < 0 || s > S3;
      v += G * before.pull * dt;
      s += v * dt;
      const now = spot(s);
      const air = s < 0 || s > S3;
      if (!air) {
        // Il pompe : son énergie revient doucement vers celle qui donne la bonne hauteur de saut
        const target = G * (R + (pending ? AIR_TRICK : AIR));
        const energy = (v * v) / 2 + G * now.height;
        const next = energy + (target - energy) * Math.min(1, dt * 3.2);
        v = (v < 0 ? -1 : 1) * Math.sqrt(Math.max(400, 2 * (next - G * now.height)));
      }
      if (air && !wasAir && pending && Math.abs(v) > Math.sqrt(2 * G * AIR_TRICK) * 0.94) {
        spinFrom = clock;
        spinFor = (2 * Math.abs(v)) / G;
        spinDir = s < 0 ? 1 : -1;
        cheerUntil = clock + spinFor + 1.5;
        park?.setAttribute('data-trick', '');
      }
      if (!air && wasAir && spinFrom >= 0) {
        spinFrom = -1;
        pending = false;
      }
      const wanted = air ? (spinFrom >= 0 ? 0.76 : 0.97) : now.pull !== 0 ? 0.84 : 0.92;
      crouch += (wanted - crouch) * Math.min(1, dt * 11);
    };

    const loop = (time: number) => {
      frame = window.requestAnimationFrame(loop);
      if (decor?.hasAttribute('data-paused') || decor?.hasAttribute('data-still')) { last = -1; return; }
      const on = (decor?.getAttribute('data-fx') ?? '').split(' ').includes('figure');
      if (on && !wasOn) pending = true;
      wasOn = on;
      const dt = last < 0 ? 0 : Math.min(0.05, (time - last) / 1000);
      last = time;
      for (let left = dt; left > 0; left -= 0.008) {
        const slice = Math.min(0.008, left);
        clock += slice;
        step(slice);
      }
      if (cheerUntil >= 0 && clock > cheerUntil) { cheerUntil = -1; park?.removeAttribute('data-trick'); }
      const spin = spinFrom >= 0 ? spinDir * 360 * Math.min(1, (clock - spinFrom) / spinFor) : 0;
      rider.setAttribute('transform', pose(spot(s), spin));
      body.setAttribute('transform', squash(crouch));
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      park?.removeAttribute('data-trick');
    };
  }, []);

  return (
    <g ref={ref} className="sk-rider" transform={pose(spot(START), 0)} data-tap="figure" data-tap-ms="5000">
      <rect x="-24" y="-50" width="48" height="58" fill="transparent" />
      <g ref={bodyRef} transform={squash(0.92)}>
        {/* Jambes fléchies, sweat, bras écartés pour l'équilibre, casque */}
        <path d="M-6 -8L-7.500 -14.500L-1.500 -20M6 -8L7.500 -14.500L1.500 -20" fill="none" stroke="#2B3350" strokeWidth="4.400" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M0 -21V-30" fill="none" stroke="#FFC93C" strokeWidth="8.400" strokeLinecap="round" />
        <path d="M-2 -29.500L-11 -24.500M2 -29.500L11.500 -26" fill="none" stroke="#FFC93C" strokeWidth="3.600" strokeLinecap="round" />
        <circle cx="-11.600" cy="-24.200" r="1.900" fill="#E8B48A" /><circle cx="12.100" cy="-25.800" r="1.900" fill="#E8B48A" />
        <circle cx="0" cy="-36.500" r="4.800" fill="#E8B48A" />
        <path d="M-5.400 -36.500A5.400 5.400 0 0 1 5.400 -36.500Z" fill="#19B5C8" stroke="#1B1D2A" strokeWidth="1" strokeLinejoin="round" />
      </g>
      {/* La planche */}
      <path d="M-14.500 -8.800Q-11.500 -6.200 -8.500 -6.200H8.500Q11.500 -6.200 14.500 -8.800" fill="none" stroke="#1B1D2A" strokeWidth="4.200" strokeLinecap="round" />
      <path d="M-14.500 -8.800Q-11.500 -6.200 -8.500 -6.200H8.500Q11.500 -6.200 14.500 -8.800" fill="none" stroke="#C2185B" strokeWidth="2.200" strokeLinecap="round" />
      <circle cx="-8" cy="-2.700" r="2.700" fill="#F4F1E8" stroke="#1B1D2A" strokeWidth="1.100" /><circle cx="8" cy="-2.700" r="2.700" fill="#F4F1E8" stroke="#1B1D2A" strokeWidth="1.100" />
    </g>
  );
}
