import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Platines » : le concert électro va commencer, vu depuis la fosse.
 * Plans, du fond vers l'avant : salle dans le noir (lueur violette au plafond), treillis de
 * lumière et écran géant où danse un égaliseur ; projecteurs motorisés accrochés au treillis
 * (leurs faisceaux), lasers ; la scène : murs d'enceintes à gauche et à droite, la DJ derrière sa
 * table (deux platines, table de mixage, façade au néon), deux canons à confettis au bord de la
 * scène, fumée de scène ; enfin la foule en ombres chinoises, mains levées.
 * Mouvement, sans que l'élève touche à rien : les barres de l'égaliseur montent et descendent,
 * la lueur de l'écran bat la mesure, les faisceaux balaient la salle, les vinyles tournent, la DJ
 * hoche la tête en rythme, pousse le curseur de la table et lève le poing de temps en temps, les
 * membranes des enceintes battent, la fumée dérive, des poussières montent dans la lumière, la
 * foule danse (les têtes suivent le tempo, les mains levées se balancent). De temps en temps : une
 * vague de mains traverse la foule de gauche à droite (toutes les 16 s) ; un éventail de lasers
 * verts s'ouvre derrière la DJ, balaie la salle puis s'éteint en douceur (toutes les 23 s).
 * Au toucher : la DJ et ses platines (« scratch » : le disque part en arrière et revient, la DJ
 * lève le bras, l'égaliseur bondit, la foule lève les mains), les enceintes (elles « soufflent » :
 * ondes qui sortent des membranes, la foule saute trois fois), un canon à confettis (les deux
 * canons tirent une pluie de confettis verts, violets et blancs qui retombe sur la foule).
 * Aucun clignotement : les lumières bougent et s'allument en fondu, elles ne flashent pas.
 */

const GREEN = '#B6FF3B';
const VIOLET = '#9B5CFF';

/** Treillis horizontal : deux longerons et des croisillons en zigzag. */
function trussH(x0: number, x1: number, y0: number, y1: number, step: number): string {
  let d = `M${x0} ${y0}H${x1}M${x0} ${y1}H${x1}`;
  for (let x = x0; x < x1; x += step) d += `M${x} ${y1}L${x + step / 2} ${y0}L${x + step} ${y1}`;
  return d;
}
/** Treillis vertical (les deux tours qui portent le treillis du haut). */
function trussV(x0: number, x1: number, y0: number, y1: number, step: number): string {
  let d = `M${x0} ${y0}V${y1}M${x1} ${y0}V${y1}`;
  for (let y = y0; y < y1; y += step) d += `M${x0} ${y}L${x1} ${y + step / 2}L${x0} ${y + step}`;
  return d;
}

/** Barres de l'égaliseur de l'écran géant. */
const BARS = scatter(20, 83, (r, i) => {
  const mid = 1 - Math.abs(i - 9.5) / 13;
  return {
    x: 141 + i * 10,
    lo: (0.1 + r() * 0.22).toFixed(2),
    hi: Math.min(1, 0.45 + mid * 0.35 + r() * 0.3).toFixed(2),
    d: `${(0.42 + r() * 0.5).toFixed(2)}s`,
    delay: `${(-r() * 2).toFixed(2)}s`,
  };
});

/** Façade de la table : la forme d'onde d'un morceau, en traits verticaux. */
const WAVEFORM = (() => {
  let d = '';
  for (let x = 158; x <= 322; x += 3) {
    const t = (x - 158) / 164;
    const a = 1.2 + 7.5 * Math.sin(Math.PI * t) * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.083) * Math.cos(x * 0.031)));
    d += `M${x} ${(168 - a).toFixed(1)}V${(168 + a).toFixed(1)}`;
  }
  return d;
})();

/** Projecteurs motorisés accrochés au treillis : position, couleur, balayage. */
const MOVERS = [
  { x: 166, c: GREEN, a: '-30deg', b: '22deg', d: '6.2s', delay: '-1s' },
  { x: 212, c: VIOLET, a: '26deg', b: '-18deg', d: '7.4s', delay: '-4s' },
  { x: 268, c: VIOLET, a: '-24deg', b: '20deg', d: '6.8s', delay: '-2.5s' },
  { x: 314, c: GREEN, a: '30deg', b: '-22deg', d: '8s', delay: '-5.5s' },
];

const LASERS = [-56, -38, -19, 0, 19, 38, 56];

/** Poussières qui montent dans la lumière. */
const MOTES = scatter(8, 29, (r) => ({
  x: `${(140 + r() * 200).toFixed(0)}px`,
  d: `${(9 + r() * 7).toFixed(1)}s`,
  delay: `${(-r() * 16).toFixed(1)}s`,
  dx: `${Math.round(r() * 40 - 20)}px`,
  s: `${(1.6 + r() * 1.8).toFixed(1)}px`,
}));

/** Confettis des deux canons (bouches en x = 132 et 348, y = 156). */
const CONFETTI = scatter(28, 47, (r, i) => {
  const left = i % 2 === 0;
  const side = left ? 1 : -1;
  return {
    x: left ? 132 : 348,
    tx: `${Math.round(side * (-20 + r() * 190))}px`,
    py: `${Math.round(-(105 + r() * 50))}px`,
    fy: `${Math.round(70 + r() * 130)}px`,
    ro: `${Math.round(r() * 1000 - 500)}deg`,
    dl: `${(r() * 0.3).toFixed(2)}s`,
    d: `${(2.4 + r() * 0.45).toFixed(2)}s`,
    fl: `${(0.22 + r() * 0.3).toFixed(2)}s`,
    w: `${(3 + r() * 2.5).toFixed(1)}px`,
    h: `${(6 + r() * 4).toFixed(1)}px`,
    c: [GREEN, VIOLET, '#FFFFFF', '#D9C4FF'][i % 4],
  };
});

/** La foule, rang de devant (de dos) : position, tête, bras, coiffure. */
type Arms = 'wave' | 'left' | 'right' | 'both' | 'none';
interface Fan { x: number; y: number; r: number; arms: Arms; hair: number }
const FRONT_ROW: Fan[] = [
  { x: -6, y: 30, r: 11, arms: 'wave', hair: 0 },
  { x: 30, y: 27, r: 10, arms: 'wave', hair: 1 },
  { x: 64, y: 31, r: 11.5, arms: 'both', hair: 3 },
  { x: 100, y: 26, r: 10, arms: 'wave', hair: 2 },
  { x: 136, y: 30, r: 11, arms: 'wave', hair: 0 },
  { x: 172, y: 28, r: 10.5, arms: 'right', hair: 4 },
  { x: 208, y: 31, r: 11, arms: 'wave', hair: 1 },
  { x: 244, y: 27, r: 10, arms: 'wave', hair: 3 },
  { x: 280, y: 30, r: 11.5, arms: 'both', hair: 0 },
  { x: 316, y: 26, r: 10, arms: 'wave', hair: 2 },
  { x: 352, y: 30, r: 11, arms: 'wave', hair: 4 },
  { x: 388, y: 28, r: 10.5, arms: 'left', hair: 1 },
  { x: 424, y: 31, r: 11, arms: 'wave', hair: 0 },
  { x: 460, y: 27, r: 10, arms: 'wave', hair: 3 },
  { x: 494, y: 30, r: 11, arms: 'wave', hair: 2 },
];
const BACK_ROW: Fan[] = [12, 48, 84, 118, 154, 190, 226, 262, 298, 334, 370, 406, 442, 478].map((x, i) => ({
  x,
  y: 17 + ((i * 7) % 5),
  r: 8 + ((i * 3) % 3) * 0.6,
  arms: (['none', 'none', 'none', 'left', 'none', 'none', 'both', 'none', 'none', 'right', 'none', 'none', 'none', 'none'] as Arms[])[i],
  hair: (i * 2 + 1) % 5,
}));

/** Coiffure vue de dos : 0 rien, 1 chignon, 2 queue de cheval, 3 boucles, 4 couettes. */
function Hair({ x, y, r, hair }: Fan) {
  if (hair === 1) return <circle cx={x + r * 0.15} cy={y - r * 1.02} r={r * 0.48} />;
  if (hair === 2) return <path d={`M${x + r * 0.35} ${y - r * 0.55}C${x + r * 1.5} ${y - r * 0.6} ${x + r * 1.6} ${y + r * 0.6} ${x + r * 1.15} ${y + r * 1.35}C${x + r * 1.05} ${y + r * 0.5} ${x + r * 0.7} ${y} ${x + r * 0.2} ${y - r * 0.1}Z`} />;
  if (hair === 3) return <g><circle cx={x - r * 0.6} cy={y - r * 0.6} r={r * 0.62} /><circle cx={x + r * 0.6} cy={y - r * 0.6} r={r * 0.62} /><circle cx={x} cy={y - r * 0.9} r={r * 0.62} /></g>;
  if (hair === 4) return <g><circle cx={x - r * 1.02} cy={y - r * 0.2} r={r * 0.42} /><circle cx={x + r * 1.02} cy={y - r * 0.2} r={r * 0.42} /></g>;
  return null;
}

/** Un bras levé, épaule à l'origine ; `side` = -1 à gauche, 1 à droite. */
function Arm({ side, s }: { side: -1 | 1; s: number }) {
  return (
    <>
      <path d={`M0 0Q${side * 5 * s} ${-13 * s} ${side * 8 * s} ${-25 * s}`} fill="none" strokeWidth={5.4 * s} strokeLinecap="round" />
      <circle cx={side * 8.6 * s} cy={-27 * s} r={3.4 * s} />
    </>
  );
}

function Person({ fan, n, front, still }: { fan: Fan; n: number; front: boolean; still?: boolean }) {
  const { x, y, r, arms } = fan;
  const w = r * 2.2;
  const s = r / 10.5;
  const sx = r * 1.3;
  const sy = y + r * 1.5;
  const body = `M${x - w} 92C${x - w} ${y + r * 1.6} ${x - w * 0.62} ${y + r * 1.05} ${x} ${y + r}C${x + w * 0.62} ${y + r * 1.05} ${x + w} ${y + r * 1.6} ${x + w} 92Z`;
  const fixed = (side: -1 | 1, k: number) => (
    <g transform={`translate(${x + side * sx} ${sy})`}>
      <g className={still ? undefined : 'pt-armup'} style={vars({ '--k2': k })}><Arm side={side} s={s} /></g>
    </g>
  );
  const wave = (side: -1 | 1) => (
    <g transform={`translate(${x + side * sx} ${sy})`}>
      <g className="pt-wavearm" style={vars({ '--n': n, '--dn': `${side * 172}deg` })}><Arm side={side} s={s} /></g>
    </g>
  );
  return (
    <g className={front ? 'pt-fan' : undefined} style={front ? vars({ '--dl': `${(-((n * 0.37) % 1) * 0.48).toFixed(2)}s`, '--n': n }) : undefined}>
      {arms === 'wave' && <>{wave(-1)}{wave(1)}</>}
      {(arms === 'left' || arms === 'both') && fixed(-1, n % 2 ? 1 : -1)}
      {(arms === 'right' || arms === 'both') && fixed(1, n % 2 ? -1 : 1)}
      <path d={body} />
      <circle cx={x} cy={y} r={r} />
      <Hair {...fan} />
    </g>
  );
}

/** Une enceinte de basses (caisson), avec sa membrane et ses ondes. */
function Sub({ x, y }: { x: number; y: number }) {
  const cx = x + 30;
  const cy = y + 17;
  return (
    <g>
      <rect x={x} y={y} width="60" height="34" rx="3" fill="#1C1A26" />
      <rect x={x + 3} y={y + 3} width="54" height="28" rx="2" fill="#24222F" />
      <circle cx={x + 8} cy={y + 8} r="1.3" fill="#3B384B" /><circle cx={x + 52} cy={y + 8} r="1.3" fill="#3B384B" />
      <circle cx={x + 8} cy={y + 26} r="1.3" fill="#3B384B" /><circle cx={x + 52} cy={y + 26} r="1.3" fill="#3B384B" />
      <g className="pt-woof">
        <circle cx={cx} cy={cy} r="13" fill="#34314A" />
        <circle cx={cx} cy={cy} r="11" fill="#121118" />
        <circle cx={cx} cy={cy} r="7.5" fill="#1B1A24" />
        <circle cx={cx} cy={cy} r="4.4" fill="#3E3A55" />
        <path d={`M${cx - 2.6} ${cy - 2.2}a3 3 0 0 1 3 -1.6`} stroke="#6A6585" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
      <circle className="pt-ring" cx={cx} cy={cy} r="12" />
      <circle className="pt-ring pt-ring--2" cx={cx} cy={cy} r="12" />
    </g>
  );
}

/** Mur d'enceintes : ligne suspendue au treillis + deux caissons posés sur la scène. */
function Tower({ x, flip }: { x: number; flip?: boolean }) {
  const boxes = [0, 1, 2, 3, 4, 5];
  return (
    <g data-tap="souffle" data-tap-ms="2400" className="pt-tower">
      <path d={`M${x + 12} -220V24M${x + 48} -220V24`} stroke="#3A3750" strokeWidth="1.2" />
      <g transform={flip ? `translate(${2 * x + 60} 0) scale(-1 1)` : undefined}>
        {boxes.map((i) => {
          const y = 22 + i * 13.5;
          const tilt = i * i * 0.5;
          return (
            <g key={i} transform={`rotate(${tilt} ${x + 30} ${y})`}>
              <path d={`M${x + 4} ${y}H${x + 56}L${x + 52} ${y + 12.5}H${x + 8}Z`} fill="#1C1A26" />
              <path d={`M${x + 9} ${y + 2.5}H${x + 51}L${x + 49} ${y + 10}H${x + 11}Z`} fill="#2A2837" />
              <path d={`M${x + 22} ${y + 4}H${x + 38}L${x + 36} ${y + 8.5}H${x + 24}Z`} fill="#121118" />
              <circle cx={x + 14} cy={y + 6.3} r="0.9" fill={i % 2 ? GREEN : VIOLET} />
            </g>
          );
        })}
      </g>
      <Sub x={x} y={116} />
      <Sub x={x} y={151} />
    </g>
  );
}

/** Un vinyle sur sa platine (vu un peu de dessus, d'où l'aplatissement). */
function Deck({ x, side }: { x: number; side: 'l' | 'r' }) {
  return (
    <g>
      <path d={`M${x - 32} 130H${x + 32}L${x + 36} 147H${x - 36}Z`} fill="#1A1823" />
      <ellipse cx={x} cy={139.4} rx="28.5" ry="8.4" fill="#0A0A0E" />
      <g transform={`translate(${x} 138.6) scale(1 0.3)`}>
        <g className={`pt-scr pt-scr--${side}`}>
          <g className={`pt-spin pt-spin--${side}`}>
            <circle r="26" fill="#121218" />
            <circle r="22" fill="none" stroke="#262634" strokeWidth="1.6" />
            <circle r="18" fill="none" stroke="#262634" strokeWidth="1.6" />
            <circle r="14" fill="none" stroke="#262634" strokeWidth="1.6" />
            <path d="M0 -25A25 25 0 0 1 17.7 -17.7" fill="none" stroke="#4A4860" strokeWidth="3" />
            <circle r="8.5" fill={GREEN} />
            <path d="M0 -8.5A8.5 8.5 0 0 1 0 8.5Z" fill={VIOLET} />
            <circle r="1.7" fill="#0F0F14" />
          </g>
        </g>
      </g>
      <circle cx={x + 28} cy={132} r="2.4" fill="#8A869C" />
      <path d={`M${x + 28} 132L${x + 17} 139.5`} stroke="#C9C6DA" strokeWidth="1.4" strokeLinecap="round" />
      <rect x={x + 14.5} y={138.4} width="4" height="2.4" rx="0.6" fill="#E9E7F2" />
    </g>
  );
}

export default function PlatinesScene() {
  return (
    <>
      <div className="el-layer pt-back" style={vars({ top: '0px', '--k': 0.2, '--kx': 1 })} />

      {/* Treillis, écran géant et son égaliseur */}
      <div className="el-layer pt-screenlayer" style={vars({ top: '0px', '--k': 0.28, '--kx': 2 })}>
        <div className="pt-set">
          <svg viewBox="0 0 480 190" width="480">
            <defs>
              <linearGradient id="pt-eqg" x1="0" y1="118" x2="0" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={GREEN} />
                <stop offset="0.55" stopColor="#7FE0B0" />
                <stop offset="1" stopColor={VIOLET} />
              </linearGradient>
              <linearGradient id="pt-scr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1E1338" />
                <stop offset="1" stopColor="#0E0B1A" />
              </linearGradient>
              <radialGradient id="pt-glowg" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor={VIOLET} stopOpacity="0.55" />
                <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
              </radialGradient>
              <clipPath id="pt-screenclip"><rect x="134" y="28" width="212" height="94" rx="3" /></clipPath>
              <pattern id="pt-led" width="10" height="4.5" patternUnits="userSpaceOnUse" y="118">
                <rect width="10" height="3.3" fill="#FFFFFF" />
              </pattern>
              <mask id="pt-ledmask" maskUnits="userSpaceOnUse" x="130" y="20" width="220" height="104">
                <rect x="130" y="20" width="220" height="104" fill="url(#pt-led)" />
              </mask>
            </defs>
            {/* Tours de treillis et treillis du haut */}
            <path d={trussV(112, 124, 16, 190, 12)} stroke="#3C3954" strokeWidth="1.4" fill="none" />
            <path d={trussV(356, 368, 16, 190, 12)} stroke="#3C3954" strokeWidth="1.4" fill="none" />
            <path d={trussH(-1100, 1580, 4, 16, 12)} stroke="#4A4664" strokeWidth="1.5" fill="none" />
            {/* Câbles de l'écran */}
            <path d="M160 16V28M320 16V28" stroke="#3C3954" strokeWidth="1.2" />
            {/* L'écran */}
            <rect x="131" y="25" width="218" height="100" rx="5" fill="#26233A" />
            <rect x="134" y="28" width="212" height="94" rx="3" fill="url(#pt-scr)" />
            <g clipPath="url(#pt-screenclip)">
              <ellipse className="pt-glow" cx="240" cy="112" rx="110" ry="46" fill="url(#pt-glowg)" />
              <g className="pt-eqall">
                <g mask="url(#pt-ledmask)">
                  {BARS.map((b, i) => (
                    <rect key={i} className="pt-bar" x={b.x} y="44" width="7.4" height="74" fill="url(#pt-eqg)" style={vars({ '--lo': b.lo, '--hi': b.hi, '--d': b.d, '--delay': b.delay })} />
                  ))}
                </g>
              </g>
              <rect x="134" y="118" width="212" height="4" fill="#0E0B1A" />
            </g>
            {/* Étriers des projecteurs (la tête mobile est dans le plan des faisceaux) */}
            {MOVERS.map((m) => (
              <path key={m.x} d={`M${m.x - 8} 22V16H${m.x + 8}V22`} stroke="#4A4664" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
      </div>

      {/* Faisceaux des projecteurs, lasers, poussières dans la lumière */}
      <div className="el-layer pt-beamlayer" style={vars({ top: '0px', '--k': 0.28, '--kx': 2 })}>
        <div className="pt-set">
          <div className="pt-lasers">
            {LASERS.map((a) => <span key={a} className="pt-laser" style={vars({ '--a': `${a}deg` })} />)}
            <span className="pt-emitter" />
          </div>
          {MOVERS.map((m) => (
            <div key={m.x} className="pt-mover" style={vars({ left: `${m.x}px`, '--c': m.c, '--a': m.a, '--b': m.b, '--d': m.d, '--delay': m.delay })}>
              <span className="pt-beam" style={{ background: `linear-gradient(${m.c === GREEN ? 'rgba(182, 255, 59, 0.34)' : 'rgba(155, 92, 255, 0.42)'}, rgba(0, 0, 0, 0) 92%)` }} />
              <span className="pt-lamp" />
            </div>
          ))}
          {MOTES.map((m, i) => (
            <span key={i} className="pt-mote" style={vars({ left: m.x, '--d': m.d, '--delay': m.delay, '--dx': m.dx, width: m.s, height: m.s })} />
          ))}
        </div>
      </div>

      {/* La scène : enceintes, DJ, table, canons, fumée */}
      <div className="el-layer pt-stagelayer" style={vars({ top: '0px', '--k': 0.45, '--kx': 5 })}>
        <div className="pt-strip"><span /></div>
        <div className="pt-set">
          <svg viewBox="0 0 480 262" width="480">
            <defs>
              <radialGradient id="pt-pool" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor={VIOLET} stopOpacity="0.45" />
                <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Le plancher, la façade de la scène et la lueur sur la fosse sont l'aplat du plan (CSS) */}
            <ellipse cx="240" cy="168" rx="130" ry="12" fill="url(#pt-pool)" />

            <Tower x={52} />
            <Tower x={368} flip />

            {/* La DJ (derrière la table) */}
            <g className="pt-dj">
              <path d="M226 113C223 96 230 85 240 85C250 85 257 96 254 113Z" fill="#3E2477" />
              <path d="M215 152C215 127 222 113 240 111C258 113 265 127 265 152Z" fill="#5B34A8" />
              <path d="M240 111C258 113 265 127 265 152H253C253 131 249 117 240 111Z" fill="#4C2B90" />
              <path d="M229 112C233 119 247 119 251 112C247 115.5 233 115.5 229 112Z" fill="#3E2477" />
              <path d="M236 117V126M244 117V126" stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" />
              <rect x="236.5" y="103" width="7" height="10" rx="2.5" fill="#8E5536" />
              <g className="pt-dj__head">
                <circle cx="240" cy="81" r="11" fill="#1E1410" />
                <circle cx="230" cy="86" r="7.5" fill="#1E1410" />
                <circle cx="250" cy="86" r="7.5" fill="#1E1410" />
                <circle cx="232.5" cy="77" r="7" fill="#1E1410" />
                <circle cx="247.5" cy="77" r="7" fill="#1E1410" />
                <circle cx="240" cy="73" r="7.5" fill="#1E1410" />
                <ellipse cx="240" cy="95" rx="9" ry="10.5" fill="#A86B4A" />
                <path d="M231.5 89C234 85 246 85 248.5 89C245 87.5 235 87.5 231.5 89Z" fill="#1E1410" />
                <path d="M234.6 94.6q2.2 -2 4.4 0M241 94.6q2.2 -2 4.4 0" stroke="#2A1810" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M236.6 100.2q3.4 2.8 6.8 0" stroke="#2A1810" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <ellipse cx="234" cy="98.6" rx="1.9" ry="1.1" fill="#D27C62" opacity="0.8" />
                <ellipse cx="246" cy="98.6" rx="1.9" ry="1.1" fill="#D27C62" opacity="0.8" />
                <path d="M228.6 94C227 76 253 76 251.4 94" stroke="#15141C" strokeWidth="3.4" fill="none" strokeLinecap="round" />
                <rect x="225" y="88.5" width="7" height="12.5" rx="3.2" fill="#15141C" />
                <rect x="248" y="88.5" width="7" height="12.5" rx="3.2" fill="#15141C" />
                <rect x="226.3" y="90.8" width="2" height="8" rx="1" fill={GREEN} />
                <rect x="251.7" y="90.8" width="2" height="8" rx="1" fill={GREEN} />
              </g>
            </g>

            {/* Le dessus de la table, les platines, la table de mixage */}
            <path d="M152 128H328L337 150H143Z" fill="#2A2637" />
            <Deck x={192} side="l" />
            <Deck x={288} side="r" />
            <path d="M231 130H249L250.5 147H229.5Z" fill="#24212F" />
            <circle cx="235.5" cy="133.4" r="1.3" fill={VIOLET} /><circle cx="244.5" cy="133.4" r="1.3" fill={VIOLET} />
            <circle cx="235.5" cy="137.4" r="1.3" fill={GREEN} /><circle cx="244.5" cy="137.4" r="1.3" fill={GREEN} />
            <rect className="pt-vu" x="239.2" y="132" width="1.6" height="7" fill={GREEN} />
            <path d="M233.5 143.4H246.5" stroke="#0E0D14" strokeWidth="1.4" />
            <rect className="pt-fader" x="238.5" y="141.6" width="3" height="3.6" rx="0.6" fill="#F5F5FA" />

            {/* Les bras de la DJ, posés sur le vinyle et sur le curseur */}
            <g className="pt-arm pt-arm--l">
              <path d="M222 117Q211 128 204.5 134.5" stroke="#5B34A8" strokeWidth="7" fill="none" strokeLinecap="round" />
              <ellipse cx="203.5" cy="135.6" rx="4.2" ry="3" fill="#A86B4A" />
            </g>
            <g className="pt-arm pt-arm--r">
              <path d="M258 117Q263 131 248 138.5" stroke="#5B34A8" strokeWidth="7" fill="none" strokeLinecap="round" />
              <ellipse cx="246" cy="139.6" rx="4" ry="3" fill="#A86B4A" />
            </g>
            <g className="pt-scratchmarks" stroke="#F5F5FA" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M160 116l-5 -3 4 -3 -5 -3" />
              <path d="M170 110l-2 -5 4 -1 -2 -5" />
              <path d="M152 126l-6 -1 3 -4 -6 -1" />
            </g>

            {/* Zone de toucher du scratch : la DJ et ses deux platines */}
            <rect data-tap="scratch" data-tap-ms="2600" x="150" y="64" width="180" height="86" fill="none" />

            {/* La façade de la table, au néon */}
            <path d="M143 150H337V185H143Z" fill="#16131F" />
            <rect x="143" y="150" width="194" height="3" fill="#3B3650" />
            <rect className="pt-neon" x="149" y="156" width="182" height="24" rx="4" fill="none" stroke={GREEN} strokeWidth="1.5" />
            <path className="pt-wave" d={WAVEFORM} stroke={VIOLET} strokeWidth="1.6" strokeLinecap="round" />

            {/* Canons à confettis au bord de la scène */}
            <g className="pt-cannons">
              {[{ x: 128, s: 1 }, { x: 352, s: -1 }].map((c) => (
                <g key={c.x} data-tap="confettis" data-tap-ms="3200">
                  <g className="pt-cannon" transform={`rotate(${c.s * 12} ${c.x} 178)`}>
                    <rect x={c.x - 4.5} y={156} width="9" height="24" rx="2" fill="#2E2A40" />
                    <rect x={c.x - 4.5} y={161} width="9" height="3" fill={GREEN} />
                    <rect x={c.x - 4.5} y={168} width="9" height="3" fill={VIOLET} />
                    <rect x={c.x - 5.5} y={154} width="11" height="4" rx="1.5" fill="#46405E" />
                  </g>
                  <path d={`M${c.x - 9} 188L${c.x - 7} 177H${c.x + 7}L${c.x + 9} 188Z`} fill="#24212F" />
                  <circle cx={c.x} cy={182.5} r="1.3" fill={GREEN} />
                  <circle className="pt-puff" cx={c.x + c.s * 4.5} cy={154} r="7" />
                </g>
              ))}
            </g>
          </svg>
          <span className="pt-fog pt-fog--1" />
          <span className="pt-fog pt-fog--2" />
          <span className="pt-fog pt-fog--3" />
        </div>
      </div>

      {/* La foule en ombres chinoises */}
      <div className="el-layer pt-crowdlayer" style={vars({ top: '180px', '--k': 0.8, '--kx': 11 })}>
        <svg viewBox="-1060 -10 2600 80" width="2600" height="80" className="pt-crowd">
          {/* Sur un grand écran, la foule continue de chaque côté (copies immobiles) */}
          {[-1040, -520, 520, 1040].map((dx) => (
            <g key={dx} transform={`translate(${dx} 0)`}>
              <g className="pt-backrow--still">{BACK_ROW.map((f, i) => <Person key={i} fan={{ ...f, arms: f.arms === 'wave' ? 'none' : f.arms }} n={i} front={false} still />)}</g>
              <g className="pt-frontrow">{FRONT_ROW.map((f, i) => <Person key={i} fan={{ ...f, arms: f.arms === 'wave' ? 'none' : f.arms }} n={i} front={false} still />)}</g>
            </g>
          ))}
          <g className="pt-backrow">
            {BACK_ROW.map((f, i) => <Person key={i} fan={f} n={i} front={false} />)}
          </g>
          <g className="pt-frontrow">
            {FRONT_ROW.map((f, i) => <Person key={i} fan={f} n={i} front />)}
          </g>
        </svg>
      </div>

      {/* Confettis (au toucher d'un canon) : devant tout le reste */}
      <div className="el-layer pt-fxlayer" style={vars({ top: '0px', '--k': 0.45, '--kx': 5 })}>
        <div className="pt-set">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="pt-conf"
              style={vars({ left: `${c.x}px`, width: c.w, height: c.h, background: c.c, '--tx': c.tx, '--py': c.py, '--fy': c.fy, '--ro': c.ro, '--dl': c.dl, '--d': c.d, '--fl': c.fl })}
            />
          ))}
        </div>
      </div>
    </>
  );
}
