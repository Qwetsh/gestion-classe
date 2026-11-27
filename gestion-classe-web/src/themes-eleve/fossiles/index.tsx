import type { CSSProperties } from 'react';
import './theme.css';

/**
 * Thème « Fossiles » : une falaise en coupe. Cinq strates empilées, chacune avec son grain, glissent
 * les unes sur les autres au défilement (plus la strate est profonde, plus elle va vite). Les
 * fossiles sont gravés dans la roche : ammonite, trilobite, fougère, poisson, coquilles.
 * Rien ne s'anime tout seul (seules les strates glissent). Au toucher : la grande ammonite se
 * réveille (l'animal sort ses tentacules de la coquille, regarde, puis rentre), le trilobite du
 * haut fait quelques pas et revient à sa place.
 */

const TAU = Math.PI * 2;
const f = (n: number): string => n.toFixed(1);

/* ---------- Ammonite : spirale logarithmique, côtes rayonnantes ---------- */

const TURNS = 3.15;
const GROWTH = 0.2;
const END = TURNS * TAU;
const SCALE = 46 / Math.exp(GROWTH * END);
const radius = (a: number): number => SCALE * Math.exp(GROWTH * a);
const at = (a: number, k = 1): [number, number] => [50 + radius(a) * k * Math.cos(a), 50 + radius(a) * k * Math.sin(a)];

const SPIRAL = (() => {
  const pts: string[] = [];
  for (let a = TAU * 0.35; a <= END + 0.001; a += 0.09) pts.push(at(a).map(f).join(' '));
  return `M${pts.join('L')}`;
})();

/** Silhouette de la coquille : le dernier tour, refermé sur lui-même. */
const SHELL = (() => {
  const pts: string[] = [];
  for (let a = END - TAU; a <= END + 0.001; a += 0.09) pts.push(at(a).map(f).join(' '));
  return `M${pts.join('L')}Z`;
})();

/** Côtes : du tour précédent au bord, légèrement arquées. */
const RIBS = (() => {
  const parts: string[] = [];
  for (let a = TAU * 0.9; a <= END - 0.05; a += 0.17) {
    const inner = a > TAU ? radius(a - TAU) / radius(a) + 0.03 : 0.42;
    const [x1, y1] = at(a, inner);
    const [x2, y2] = at(a + 0.1, 0.985);
    const [cx, cy] = at(a + 0.13, (inner + 1) / 2);
    parts.push(`M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`);
  }
  return parts.join('');
})();

/** Tentacules de l'animal, dans le repère de l'ouverture (x le long de l'ouverture, y vers l'avant). */
const ARMS = Array.from({ length: 7 }, (_, i) => {
  const x = -11 + i * 3.7;
  const len = 17 + ((i * 5) % 4) * 3;
  const bend = i % 2 ? 4 : -4;
  return { x, d: `M${f(x)} 6Q${f(x + bend)} ${f(6 + len * 0.55)} ${f(x - bend * 0.6)} ${f(6 + len)}` };
});

/** `alive` : au toucher, l'animal sort de sa coquille (l'ouverture est au bout du dernier tour). */
function Ammonite({ style, alive }: { style: CSSProperties; alive?: boolean }) {
  const [ox, oy] = at(END, (1 + radius(END - TAU) / radius(END)) / 2);
  return (
    <svg viewBox="0 0 100 100" className="fo-fossil" style={style} data-tap={alive ? 'reveil' : undefined} data-tap-ms={alive ? 4600 : undefined}>
      {alive && (
        <g transform={`translate(${f(ox)} ${f(oy)}) rotate(${f((END * 360) / TAU - 1080)})`}>
          <g className="fo-live">
            {ARMS.map((arm, i) => (
              <path key={i} className="fo-live__arm" d={arm.d} style={{ transformOrigin: `${f(arm.x)}px 6px`, '--i': i } as CSSProperties} />
            ))}
            <path className="fo-live__body" d="M-15 -2Q-14 10 0 12Q14 10 15 -2Z" />
            <circle className="fo-live__eye" cx="8.500" cy="4" r="2.800" />
            <circle className="fo-live__pupil" cx="8.900" cy="4.500" r="1.200" />
          </g>
        </g>
      )}
      <g className="fo-shell">
        <path d={SHELL} className="fo-fill" />
        <path d={RIBS} className="fo-light" transform="translate(0.7 0.7)" />
        <path d={RIBS} className="fo-ink" />
        <path d={SPIRAL} className="fo-ink fo-ink--bold" />
        <circle cx="50" cy="50" r="1.6" className="fo-dot" />
      </g>
    </svg>
  );
}

/* ---------- Trilobite : tête, dix segments, queue ---------- */

const SEGMENTS = Array.from({ length: 10 }, (_, i) => {
  const y = 31 + i * 4.7;
  const w = 25 - i * 0.95;
  return `M${f(30 - w)} ${f(y)}Q30 ${f(y - 3.2)} ${f(30 + w)} ${f(y)}L${f(30 + w - 1.2)} ${f(y + 3.7)}Q30 ${f(y + 0.5)} ${f(30 - w + 1.2)} ${f(y + 3.7)}Z`;
}).join('');

function Trilobite({ style, walker }: { style: CSSProperties; walker?: boolean }) {
  return (
    <svg viewBox="0 0 60 100" className="fo-fossil" style={style} data-tap={walker ? 'trotte' : undefined} data-tap-ms={walker ? 3200 : undefined}>
      <g className="fo-walk"><g className="fo-wobble">
      <path d="M3 30C3 4 57 4 57 30L51 32C41 25 19 25 9 32Z" className="fo-fill fo-ink" />
      <path d="M3 30L1 50M57 30L59 50" className="fo-ink" />
      <path d={SEGMENTS} className="fo-fill fo-ink" />
      <path d="M15 78Q30 99 45 78Q30 73 15 78Z" className="fo-fill fo-ink" />
      <path d="M21 81Q30 88 39 81M24 85Q30 90 36 85" className="fo-ink" />
      <ellipse cx="30" cy="19" rx="8" ry="10" className="fo-ink" />
      <path d="M25 15h10M24.500 20h11M25 25h10" className="fo-ink" />
      <path d="M13 22q4-6 8-1M39 21q4-5 8 1" className="fo-ink fo-ink--bold" />
      <path d="M23 30L26.500 79M37 30L33.500 79" className="fo-ink" />
      </g></g>
    </svg>
  );
}

/* ---------- Fougère : une tige, des folioles par paires ---------- */

const LEAFLETS = Array.from({ length: 13 }, (_, i) => {
  const t = i / 12;
  const y = 112 - t * 100;
  const x = 30 - 5 * Math.sin(t * 2.2) + 4 * t;
  const l = 19 * (1 - t * 0.78) + 3;
  const left = `M${f(x)} ${f(y)}q${f(-l * 0.5)} ${f(-l * 0.62)} ${f(-l)} ${f(-l * 0.5)}q${f(l * 0.3)} ${f(l * 0.55)} ${f(l)} ${f(l * 0.5)}`;
  const right = `M${f(x)} ${f(y)}q${f(l * 0.5)} ${f(-l * 0.62)} ${f(l)} ${f(-l * 0.5)}q${f(-l * 0.3)} ${f(l * 0.55)} ${f(-l)} ${f(l * 0.5)}`;
  return left + right;
}).join('');

function Fern({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 122" className="fo-fossil" style={style}>
      <path d={LEAFLETS} className="fo-fill fo-ink" />
      <path d="M30 120Q22 62 34 6" className="fo-ink fo-ink--bold" />
    </svg>
  );
}

/* ---------- Poisson : colonne, arêtes, crâne, nageoires ---------- */

const BONES = Array.from({ length: 15 }, (_, i) => {
  const x = 36 + i * 5.7;
  const l = 12.5 * Math.sin((Math.PI * (i + 1.5)) / 17) + 2.5;
  const y = 30 - 2.2 * Math.sin((Math.PI * i) / 14);
  return `M${f(x)} ${f(y - 1)}q-1.500 ${f(-l * 0.5)} -5 ${f(-l)}M${f(x)} ${f(y + 1)}q-1.500 ${f(l * 0.5)} -5 ${f(l)}`;
}).join('');

function Fish({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 150 60" className="fo-fossil" style={style}>
      <path d="M30 30Q76 24 124 30" className="fo-ink fo-ink--bold" />
      <path d={BONES} className="fo-ink" />
      <path d="M31 19L9 22Q1 30 9 38L31 41Q24 30 31 19Z" className="fo-fill fo-ink" />
      <circle cx="15" cy="28" r="2.6" className="fo-ink" />
      <path d="M5 33h13M24 22q-4 8 0 16" className="fo-ink" />
      <path d="M124 30L146 12M124 30L143 20M124 30L147 30M124 30L143 40M124 30L146 48" className="fo-ink" />
      <path d="M146 12Q138 30 146 48" className="fo-ink" />
      <path d="M66 20l-3-12M74 19l-1-13M82 19l1-12M90 20l3-10" className="fo-ink" />
    </svg>
  );
}

/* ---------- Coquille : éventail à côtes ---------- */

function Shell({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 36" className="fo-fossil" style={style}>
      <path d="M20 34Q-2 22 4 8Q20 -6 36 8Q42 22 20 34Z" className="fo-fill fo-ink" />
      <path d="M20 34L6 9M20 34L12 4M20 34L20 2M20 34L28 4M20 34L34 9" className="fo-ink" />
      <path d="M15 33h10" className="fo-ink fo-ink--bold" />
    </svg>
  );
}

/** Une strate : sa profondeur règle sa vitesse au défilement. */
function Stratum({ n, top, k, children }: { n: number; top: string; k: number; children?: React.ReactNode }) {
  return (
    <div className={`el-layer fo-band fo-band--${n}`} style={{ top, '--k': k, '--kx': 4 + n * 3 } as CSSProperties}>
      <div className="fo-edge" />
      <div className="el-stage">{children}</div>
    </div>
  );
}

export default function FossilesScene() {
  return (
    <>
      <div className="el-layer fo-top" style={{ top: 0, '--k': 0.03, '--kx': 3 } as CSSProperties}>
        <div className="el-stage">
          <Ammonite alive style={{ right: -6, top: 6, width: 158 }} />
          <Trilobite walker style={{ left: 20, top: 22, width: 54, transform: 'rotate(-14deg)' }} />
          <Shell style={{ left: 108, top: 92, width: 30, transform: 'rotate(18deg)' }} />
          <Shell style={{ left: 150, top: 30, width: 22, transform: 'rotate(-30deg)' }} />
        </div>
      </div>
      <Stratum n={1} top="250px" k={0.07}>
        <Fern style={{ right: 6, top: 30, width: 66, transform: 'rotate(24deg)' }} />
        <Ammonite style={{ left: -18, top: 70, width: 74, transform: 'rotate(140deg)' }} />
      </Stratum>
      <Stratum n={2} top="44vh" k={0.13}>
        <Fish style={{ left: -10, top: 34, width: 168, transform: 'rotate(-7deg)' }} />
        <Shell style={{ right: 14, top: 84, width: 34, transform: 'rotate(-12deg)' }} />
      </Stratum>
      <Stratum n={3} top="60vh" k={0.2}>
        <Trilobite style={{ right: 10, top: 28, width: 62, transform: 'rotate(22deg)' }} />
        <Fern style={{ left: 12, top: 40, width: 50, transform: 'rotate(-32deg)' }} />
      </Stratum>
      <Stratum n={4} top="76vh" k={0.28}>
        <Ammonite style={{ right: 20, top: 34, width: 104, transform: 'rotate(60deg)' }} />
        <Fish style={{ left: 8, top: 96, width: 120, transform: 'rotate(8deg) scaleX(-1)' }} />
      </Stratum>
      <Stratum n={5} top="92vh" k={0.36}>
        <Trilobite style={{ left: 40, top: 44, width: 48, transform: 'rotate(-40deg)' }} />
        <Shell style={{ right: 60, top: 60, width: 40 }} />
      </Stratum>
    </>
  );
}
