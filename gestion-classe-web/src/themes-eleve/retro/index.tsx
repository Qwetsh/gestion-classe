import { scatter, vars } from '../shared';
import { Grid } from './Grid';
import './theme.css';

/**
 * Thème « Rétro 84 » : un coucher de soleil de jeu vidéo des années 80, au bord d'un horizon infini.
 * Plans, du fond vers l'avant : ciel violet et étoiles, grand soleil dégradé coupé de bandes,
 * montagnes en fil de fer, sol en grille rose avec la route au milieu (Grid.tsx), palmiers en
 * silhouette, voiture de sport vue de dos (aucune marque, aucun modèle réel).
 * Mouvement, sans que l'élève touche à rien : la grille et les tirets de la route défilent vers
 * nous, la voiture roule (elle tressaute et change un peu de place sur la route), ses feux arrière
 * rougeoient, le halo du soleil respire, les palmes se balancent, les étoiles scintillent. De temps
 * en temps, une étoile filante traverse le ciel (toutes les 17 s) et un dauphin en fil de fer saute
 * par-dessus la grille (toutes les 23 s).
 * Au toucher : la voiture (turbo : elle file vers l'horizon en laissant des traînées rouges, la
 * grille accélère, puis tout ralentit et elle revient), le soleil (ses bandes tombent une à une
 * comme des stores derrière l'horizon, puis remontent et le recomposent), les montagnes (une
 * cassette surgit dans le ciel, ses bobines tournent et les montagnes dansent comme un égaliseur).
 */

const STARS = scatter(24, 84, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${Math.round(r() * 104 + 4)}px`,
  s: `${(r() * 1.6 + 1.1).toFixed(1)}px`,
  d: `${(r() * 3 + 2.4).toFixed(1)}s`,
  delay: `${(-r() * 5).toFixed(1)}s`,
}));
const SPARKS = [
  { x: '12%', y: '22px', d: '3.4s' },
  { x: '71%', y: '14px', d: '4.1s' },
  { x: '88%', y: '64px', d: '3s' },
];

const f1 = (n: number) => n.toFixed(1);
type Pt = [number, number];
const line = (points: Pt[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');

/* ---- Le soleil : des bandes horizontales découpées dans un disque, chacune dessinée à part
   pour pouvoir tomber seule. Les écarts entre bandes grandissent vers le bas. ---- */
const SUN = { cx: 240, cy: 92, r: 66 };
const BANDS: Pt[] = [[26, 62], [64, 73], [75.5, 83.5], [86.5, 93.5], [97, 103], [107, 112], [116.5, 120.5], [125.5, 129], [134.5, 138]];
function band([y1, y2]: Pt): string {
  const { cx, cy, r } = SUN;
  const half = (y: number) => Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
  const a = half(y1);
  const b = half(y2);
  return `M${f1(cx - a)} ${y1}H${f1(cx + a)}A${r} ${r} 0 0 1 ${f1(cx + b)} ${y2}H${f1(cx - b)}A${r} ${r} 0 0 1 ${f1(cx - a)} ${y1}Z`;
}

/* ---- Les montagnes en fil de fer : une crête, des arêtes qui descendent vers le pied, une ligne
   de relief en zigzag. Base à y = 84 (l'horizon). ---- */
const PEAKS: { ridge: Pt[]; wires: [Pt, Pt][]; zig: Pt[] }[] = [
  {
    ridge: [[-30, 86], [-6, 50], [18, 36], [44, 10], [66, 30], [84, 38], [110, 58], [128, 86]],
    wires: [[[-6, 50], [20, 84]], [[18, 36], [20, 84]], [[44, 10], [20, 84]], [[44, 10], [50, 84]], [[66, 30], [50, 84]], [[66, 30], [80, 84]], [[84, 38], [80, 84]], [[84, 38], [110, 84]]],
    zig: [[-14, 66], [8, 60], [33, 56], [58, 58], [80, 62], [104, 72]],
  },
  {
    ridge: [[300, 86], [330, 52], [352, 40], [374, 22], [398, 6], [420, 26], [440, 32], [466, 54], [496, 86]],
    wires: [[[352, 40], [330, 84]], [[352, 40], [360, 84]], [[374, 22], [360, 84]], [[374, 22], [390, 84]], [[398, 6], [390, 84]], [[398, 6], [420, 84]], [[420, 26], [420, 84]], [[440, 32], [420, 84]], [[440, 32], [450, 84]], [[466, 54], [450, 84]], [[466, 54], [480, 84]]],
    zig: [[318, 70], [346, 62], [372, 56], [400, 50], [428, 56], [456, 64], [482, 74]],
  },
  {
    ridge: [[70, 86], [96, 56], [118, 44], [138, 52], [160, 66], [186, 86]],
    wires: [[[96, 56], [100, 84]], [[118, 44], [100, 84]], [[118, 44], [128, 84]], [[138, 52], [128, 84]], [[138, 52], [158, 84]], [[160, 66], [158, 84]]],
    zig: [[84, 72], [110, 66], [132, 68], [160, 76]],
  },
  {
    ridge: [[282, 86], [306, 62], [322, 54], [344, 68], [366, 86]],
    wires: [[[306, 62], [312, 84]], [[322, 54], [312, 84]], [[322, 54], [336, 84]], [[344, 68], [336, 84]]],
    zig: [[294, 74], [318, 70], [340, 77]],
  },
];

/* ---- Les palmiers : un tronc courbe et effilé, des palmes en plumes (folioles en dents de scie
   sous la nervure), calculés une fois. ---- */
function bezier(p0: Pt, p1: Pt, p2: Pt, t: number): { p: Pt; d: Pt } {
  const u = 1 - t;
  return {
    p: [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]],
    d: [2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])],
  };
}

function frond(c: Pt, angle: number, len: number): string {
  const a = (angle * Math.PI) / 180;
  const tip: Pt = [c[0] + Math.cos(a) * len, c[1] + Math.sin(a) * len + len * 0.45];
  const ctrl: Pt = [c[0] + Math.cos(a) * len * 0.55, c[1] + Math.sin(a) * len * 0.55 - len * 0.32];
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  const n = 13;
  for (let i = 1; i < n; i += 1) {
    const t = i / n;
    const { p, d } = bezier(c, ctrl, tip, t);
    const l = Math.hypot(d[0], d[1]) || 1;
    let nx = -d[1] / l;
    let ny = d[0] / l;
    if (ny < 0) { nx = -nx; ny = -ny; }
    const wd = len * 0.12 * Math.sin(Math.PI * t ** 0.7);
    upper.push([p[0] - nx * wd * 0.5, p[1] - ny * wd * 0.5]);
    lower.push(i % 2
      ? [p[0] + nx * wd * 1.7 + (d[0] / l) * wd * 0.7, p[1] + ny * wd * 1.7 + (d[1] / l) * wd * 0.7]
      : [p[0] + nx * wd * 0.3, p[1] + ny * wd * 0.3]);
  }
  return `${line([c, ...upper, tip, ...lower.reverse()])}Z`;
}

function palm(base: Pt, crown: Pt, size: number, bend: number) {
  const ctrl: Pt = [(base[0] + crown[0]) / 2 + bend, (base[1] + crown[1]) / 2];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const rings: string[] = [];
  const rim: Pt[] = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const { p, d } = bezier(base, ctrl, crown, t);
    const l = Math.hypot(d[0], d[1]) || 1;
    const nx = -d[1] / l;
    const ny = d[0] / l;
    const wd = (4.6 - 2 * t) * size;
    left.push([p[0] + nx * wd, p[1] + ny * wd]);
    right.push([p[0] - nx * wd, p[1] - ny * wd]);
    rim.push([p[0] - nx * wd * 0.7, p[1] - ny * wd * 0.7]);
    if (i > 0 && i < 14) rings.push(line([[p[0] + nx * wd, p[1] + ny * wd + 1.4], [p[0] - nx * wd, p[1] - ny * wd - 1.4]]));
  }
  const angles = [192, 160, 222, 250, 290, 322, 352, 18];
  return {
    trunk: `${line([...left, ...right.reverse()])}Z`,
    rings: rings.join(''),
    rim: line(rim.slice(5, 13)),
    fronds: angles.map((a, i) => frond(crown, a, size * (i % 2 ? 40 : 46))),
    crown,
  };
}

const PALMS = [palm([66, 252], [98, 112], 1, -22), palm([428, 252], [404, 126], 0.82, 18), palm([462, 252], [470, 150], 0.62, -8)];

/* ---- Le dauphin en fil de fer (tourné vers la droite) ---- */
const DOLPHIN = 'M63 18.3C61 17.2 58.5 16.8 56.5 16.4C55 13.5 52.5 11.6 49 11C46 10.4 43 10.2 40.5 10.3C39 7 36.5 4 33 2.5C33.8 5.5 33.6 8 32 10.8C25 11.8 19 13 14.5 14.4C11.5 15.2 9 14.8 6.8 13.2L2 9C3 12.5 3.8 15 5 16.5C3.6 18.8 2.6 21.4 1.8 24.5L7.6 19.4C10.5 18.6 13 18.8 16 19.8C24 22.4 34 23.4 44 22.6C50 22 54.5 20.6 57.5 19.6C59.5 19.1 61.5 18.8 63 18.3Z';
const DOLPHIN_WIRES = 'M49 11L52 21M40.5 10.3L43 22.6M32 10.8L33 23M24 12L25 21.8M15 14.4L16 19.8M58 18.4C46 16.6 30 17 7 16.4M42 22.6L37 27.8L35.6 23';

/* ---- Traînées de vitesse sur la grille (pendant le turbo) ---- */
const STREAKS = [-66, -54, -42, 40, 52, 64];
const NOTES = [{ x: 8, d: '0.5s' }, { x: 30, d: '1.1s' }, { x: 48, d: '1.7s' }];

export default function RetroScene() {
  return (
    <>
      <div className="el-layer rt-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        {STARS.map((s, i) => (
          <span key={i} className="rt-star" style={vars({ left: s.x, top: s.y, '--s': s.s, '--d': s.d, '--delay': s.delay })} />
        ))}
        {SPARKS.map((s, i) => (
          <span key={i} className="rt-spark" style={vars({ left: s.x, top: s.y, '--d': s.d })} />
        ))}
        <span className="rt-meteor" />
      </div>

      <div className="el-layer rt-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 1.5 })}>
        <div className="rt-set">
          <span className="rt-halo" />
          <svg viewBox="0 0 480 140" width="480">
            <defs>
              <linearGradient id="rt-sun" gradientUnits="userSpaceOnUse" x1="0" y1="26" x2="0" y2="140">
                <stop offset="0" stopColor="#FFF27A" />
                <stop offset="0.42" stopColor="#FFB347" />
                <stop offset="0.72" stopColor="#FF6E9C" />
                <stop offset="1" stopColor="#FF4FD8" />
              </linearGradient>
            </defs>
            <g className="rt-sun" data-tap="stores" data-tap-ms="4300">
              {BANDS.map((b, i) => (
                <path key={i} className="rt-band" d={band(b)} fill="url(#rt-sun)" style={vars({ '--n': BANDS.length - 1 - i })} />
              ))}
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer rt-hills" style={vars({ top: '56px', '--k': 0.4, '--kx': 3 })}>
        <div className="rt-set">
          <svg viewBox="0 0 480 88" width="480">
            {[0, 1].map((side) => (
              <g key={side} data-tap="cassette" data-tap-ms="4400">
                {PEAKS.filter((_, i) => i % 2 === side).map((p, i) => (
                  <g key={i} className={`rt-peak rt-peak--${side ? 'b' : 'a'}`} style={vars({ '--n': i * 2 + side })}>
                    <path d={`${line(p.ridge)}Z`} className="rt-peak__body" />
                    <path d={p.wires.map((w) => line(w)).join('') + line(p.zig)} className="rt-peak__wire" />
                    <path d={line(p.ridge.slice(1, -1))} className="rt-peak__ridge" />
                  </g>
                ))}
              </g>
            ))}
          </svg>
          <div className="rt-cassette">
            <svg viewBox="0 0 60 40" className="rt-tape">
              <rect x="1" y="1" width="58" height="38" rx="3.5" fill="#2E1E55" stroke="#FF4FD8" strokeWidth="1.2" />
              <rect x="5" y="4.5" width="50" height="22" rx="2" fill="#FDF0FF" />
              <rect x="5" y="4.5" width="50" height="4.5" fill="#FF4FD8" />
              <rect x="5" y="9" width="50" height="2.4" fill="#FFB347" />
              <rect x="13" y="13" width="34" height="11" rx="5.5" fill="#1A0B2E" />
              <rect x="22" y="20.6" width="16" height="1.6" fill="#7A3B2A" />
              {[20, 40].map((x) => (
                <g key={x} className="rt-reel">
                  <circle cx={x} cy="18.5" r="4.4" fill="#FDF0FF" />
                  <path d={`M${x} 15.4V21.6M${x - 2.7} 17L${x + 2.7} 20M${x - 2.7} 20L${x + 2.7} 17`} stroke="#1A0B2E" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx={x} cy="18.5" r="1.2" fill="#FF4FD8" />
                </g>
              ))}
              <path d="M13 39L16.5 31H43.5L47 39Z" fill="#20143D" />
              <circle cx="21" cy="35" r="1.6" fill="#0E0618" />
              <circle cx="39" cy="35" r="1.6" fill="#0E0618" />
              <rect x="28" y="33.6" width="4" height="2.8" rx="0.6" fill="#0E0618" />
              <circle cx="4.5" cy="35.5" r="1.1" fill="#9C86C9" />
              <circle cx="55.5" cy="35.5" r="1.1" fill="#9C86C9" />
            </svg>
            {NOTES.map((n, i) => (
              <svg key={i} viewBox="0 0 12 16" className="rt-note" style={vars({ left: `${n.x}px`, '--d': n.d })}>
                <ellipse cx="4.5" cy="12.4" rx="3.3" ry="2.4" transform="rotate(-20 4.5 12.4)" />
                <path d="M6.9 12V1.2C8.4 3.8 11.4 4.3 11.4 7.8C10.4 6.3 8.9 5.6 8.1 5.5V12Z" />
              </svg>
            ))}
          </div>
        </div>
      </div>

      <div className="el-layer rt-floor" style={vars({ top: '140px', '--k': 0.55, '--kx': 4 })}>
        <Grid />
        <div className="rt-streaks">
          {STREAKS.map((a, i) => <span key={i} className="rt-streak" style={vars({ '--a': `${a}deg`, '--n': i })} />)}
        </div>
        <div className="rt-set">
          <div className="rt-dolbox">
            <svg viewBox="0 0 64 30" className="rt-dolphin">
              <path d={DOLPHIN} className="rt-dolphin__body" />
              <path d={DOLPHIN_WIRES} className="rt-dolphin__wire" />
              <circle cx="54.2" cy="16" r="1.1" fill="#5FF2FF" />
            </svg>
          </div>
          <span className="rt-ripple" style={{ left: 280 }} />
          <span className="rt-ripple rt-ripple--out" style={{ left: 390 }} />
        </div>
      </div>

      <div className="el-layer rt-palms" style={vars({ top: '0px', '--k': 0.56, '--kx': 8 })}>
        <div className="rt-set">
          <svg viewBox="0 0 480 252" width="480">
            <defs>
              <linearGradient id="rt-trunk" gradientUnits="userSpaceOnUse" x1="0" y1="196" x2="0" y2="242">
                <stop offset="0" stopColor="#12041F" />
                <stop offset="1" stopColor="#1A0B2E" />
              </linearGradient>
            </defs>
            {PALMS.map((p, i) => (
              <g key={i} className="rt-palm">
                <path d={p.trunk} fill="url(#rt-trunk)" />
                <path d={p.rings} className="rt-palm__rings" />
                <path d={p.rim} className="rt-palm__rim" />
                <g className="rt-crown" style={{ transformOrigin: `${p.crown[0]}px ${p.crown[1]}px`, animationDelay: `${-i * 1.7}s` }}>
                  {p.fronds.map((d, j) => <path key={j} d={d} className="rt-frond" />)}
                  <circle cx={p.crown[0] - 3} cy={p.crown[1] + 4} r="3" className="rt-nut" />
                  <circle cx={p.crown[0] + 3} cy={p.crown[1] + 5} r="2.8" className="rt-nut" />
                </g>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="el-layer rt-carlayer" style={vars({ top: '173px', '--k': 0.56, '--kx': 5 })}>
        <div className="rt-set">
          <div className="rt-carbox">
            <svg viewBox="0 0 100 50" className="rt-car" data-tap="turbo" data-tap-ms="3600">
              <defs>
                <linearGradient id="rt-trail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF2A55" />
                  <stop offset="1" stopColor="#FF2A55" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="rt-glass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3B1C6B" />
                  <stop offset="1" stopColor="#1A0B2E" />
                </linearGradient>
                <radialGradient id="rt-glow">
                  <stop offset="0" stopColor="#FF3D63" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#FF3D63" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="rt-trails">
                <path d="M8 29.5H14L1 150Z" fill="url(#rt-trail)" />
                <path d="M21 29.5H27L24 150Z" fill="url(#rt-trail)" />
                <path d="M73 29.5H79L76 150Z" fill="url(#rt-trail)" />
                <path d="M86 29.5H92L99 150Z" fill="url(#rt-trail)" />
              </g>
              <ellipse cx="50" cy="46.5" rx="49" ry="3.6" fill="#0A0314" opacity="0.7" />
              <g className="rt-body">
                <rect x="5" y="34" width="15" height="13" rx="2.4" fill="#0E0618" stroke="#3A2850" strokeWidth="0.8" />
                <rect x="80" y="34" width="15" height="13" rx="2.4" fill="#0E0618" stroke="#3A2850" strokeWidth="0.8" />
                <path d="M9.5 14.2H16.5L15.6 18.2H10Z" fill="#A71F45" />
                <path d="M90.5 14.2H83.5L84.4 18.2H90Z" fill="#A71F45" />
                <path d="M23.5 5.5H76.5L87 20H13Z" fill="#A71F45" />
                <path d="M28 8.2H72L80 18.6H20Z" fill="url(#rt-glass)" />
                <path d="M45 8.2H53L43 18.6H35Z" fill="#FF8BE6" opacity="0.3" />
                <path d="M57 8.2H60L50 18.6H47Z" fill="#5FF2FF" opacity="0.25" />
                <rect x="25" y="4.4" width="50" height="2.2" rx="1.1" fill="#FF7A95" />
                <path d="M9 20H91L97 26.5H3Z" fill="#F0486C" />
                <path d="M3 26H97L98.5 36.5Q98.5 39.5 95.5 39.5H4.5Q1.5 39.5 1.5 36.5Z" fill="#D2305A" />
                <path d="M2 34H98L98.5 36.5Q98.5 39.5 95.5 39.5H4.5Q1.5 39.5 1.5 36.5Z" fill="#AE2349" />
                <path d="M9 20H91L92 21.2H8Z" fill="#FF8AA4" />
                <rect x="6" y="17.2" width="88" height="3" rx="1.2" fill="#2A0A20" />
                <rect x="20" y="19.6" width="3" height="2.6" fill="#2A0A20" />
                <rect x="77" y="19.6" width="3" height="2.6" fill="#2A0A20" />
                <rect x="5" y="27.4" width="90" height="5.6" rx="1.6" fill="#1A0614" />
                <rect x="7" y="28.4" width="21" height="3.6" rx="1" className="rt-light" />
                <rect x="72" y="28.4" width="21" height="3.6" rx="1" className="rt-light" />
                <path d="M14 28.4V32M21 28.4V32M79 28.4V32M86 28.4V32" stroke="#8E0F2C" strokeWidth="0.8" />
                <rect x="41" y="33.4" width="18" height="5" rx="1" fill="#EDE2F7" />
                <rect x="2" y="38.2" width="96" height="2.6" rx="1.3" fill="#3A0C28" />
                <ellipse cx="31" cy="41.6" rx="2.6" ry="1.4" fill="#4A3A5C" />
                <ellipse cx="69" cy="41.6" rx="2.6" ry="1.4" fill="#4A3A5C" />
                <ellipse cx="17.5" cy="30.2" rx="17" ry="6.5" fill="url(#rt-glow)" className="rt-glow" />
                <ellipse cx="82.5" cy="30.2" rx="17" ry="6.5" fill="url(#rt-glow)" className="rt-glow" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
