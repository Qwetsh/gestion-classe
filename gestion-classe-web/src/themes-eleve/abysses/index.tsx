import type { CSSProperties } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Abysses » : en plongée, là où la lumière s'éteint.
 * Plans, du fond vers l'avant : eau et rais de lumière, une baleine au loin, un banc de poissons,
 * rochers et algues lointains, méduses et baudroie, rochers, coraux et algues proches, bulles.
 * Mouvement, sans que l'élève touche à rien : les rais ondulent, la baleine traverse très lentement,
 * le banc passe, les algues se balancent, les méduses pulsent et dérivent, le leurre de la baudroie
 * palpite, des bulles montent.
 * Au toucher : une méduse (toutes s'illuminent et filent vers le haut), la baudroie (elle ouvre
 * grand la gueule et bondit, son leurre flamboie).
 */

const BUBBLES = scatter(14, 31, (r) => ({
  x: `${(r() * 96 + 2).toFixed(1)}%`,
  s: `${(r() * 8 + 4).toFixed(1)}px`,
  d: `${(r() * 9 + 9).toFixed(1)}s`,
  delay: `${(-r() * 18).toFixed(1)}s`,
  sway: `${Math.round(r() * 40 - 20)}px`,
}));

const SCHOOL = scatter(9, 47, (r, i) => ({
  x: (i % 3) * 22 + r() * 10,
  y: Math.floor(i / 3) * 13 + r() * 8,
  s: 0.8 + r() * 0.5,
  delay: `${(-r() * 0.6).toFixed(2)}s`,
}));

/** Algues : des brins ondulés plantés sur une ligne de fond. */
function kelp(count: number, seed: number, width: number, base: number, minH: number, maxH: number) {
  return scatter(count, seed, (r, i) => {
    const x = Math.round((width / count) * (i + 0.2 + r() * 0.6));
    const h = Math.round(minH + r() * (maxH - minH));
    const b = 8 + r() * 6;
    const top = base - h;
    return {
      x,
      d: `M${x} ${base}C${x - b} ${base - h * 0.25} ${x + b} ${base - h * 0.5} ${x} ${base - h * 0.72}S${x + b * 0.6} ${top + 6} ${x + 2} ${top}`,
      w: (5 + r() * 4).toFixed(1),
      delay: `${(-r() * 6).toFixed(1)}s`,
      tone: i % 2,
    };
  });
}
const KELP_FAR = kelp(9, 5, 480, 86, 30, 66);
const KELP_NEAR = kelp(7, 13, 480, 74, 34, 70);

function Jelly({ style, delay, far }: { style: CSSProperties; delay: string; far?: boolean }) {
  return (
    <svg viewBox="0 0 60 96" className={far ? 'ab-jelly ab-jelly--far' : 'ab-jelly'} style={{ ...style, ...vars({ '--delay': delay }) }} data-tap="meduse" data-tap-ms="3200">
      <g className="ab-jelly__swim">
        <circle className="ab-jelly__ring" cx="30" cy="26" r="26" />
        <circle className="ab-jelly__ring ab-jelly__ring--late" cx="30" cy="26" r="26" />
        <g className="ab-tent">
          <path d="M14 34C10 48 18 58 13 72C10 80 14 88 12 94" /><path d="M22 36C20 50 26 60 22 76C20 84 23 90 22 95" />
          <path d="M38 36C40 50 34 60 38 76C40 84 37 90 38 95" /><path d="M46 34C50 48 42 58 47 72C50 80 46 88 48 94" />
        </g>
        <path className="ab-arm" d="M27 34C24 46 31 54 28 66C27 72 30 76 29 80M33 34C36 46 29 54 32 66" />
        <g className="ab-bell">
          <path className="ab-bell__body" d="M6 34C6 14 18 4 30 4C42 4 54 14 54 34C46 30 38 32 30 32C22 32 14 30 6 34Z" />
          <path className="ab-bell__shine" d="M14 24C16 14 22 9 30 8C22 12 18 18 17 26Z" />
          <ellipse className="ab-bell__core" cx="30" cy="22" rx="10" ry="7" />
        </g>
      </g>
    </svg>
  );
}

/** Baudroie tapie derrière les rochers, tournée vers la gauche, son leurre au bout d'une tige. */
function Angler({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 156 100" className="ab-angler" style={style} data-tap="baudroie" data-tap-ms="2800">
      <g className="ab-angler__body">
        <path d="M130 52L152 32L146 54L152 74Z" fill="#0C2244" />
        <path d="M66 22L74 8L82 20L92 8L98 22L108 12L112 26Z" fill="#0C2244" />
        <path d="M132 52C132 76 108 92 80 92C52 92 28 78 24 58C22 44 32 30 52 24C78 16 132 26 132 52Z" fill="#0A1B36" stroke="#1F4478" strokeWidth="1.400" />
        <path d="M84 60C96 58 106 66 104 78C96 76 88 70 84 60Z" fill="#12305C" />
        <g className="ab-jaw">
          <path d="M24 58C32 74 54 84 76 78L72 66C56 70 38 66 26 54Z" fill="#0A1B36" stroke="#1F4478" strokeWidth="1.400" />
          <path d="M30 59L33 51L36 61ZM40 64L43 55L46 66ZM50 67L53 58L56 68ZM60 68L63 60L66 68Z" fill="#EAF6FF" />
        </g>
        <path d="M28 50L31 59L34 51ZM38 54L41 63L44 55ZM48 57L51 66L54 58ZM58 58L61 66L64 59Z" fill="#EAF6FF" />
        <circle cx="50" cy="42" r="6.500" fill="#DFFBFF" /><circle className="ab-angler__pupil" cx="48.500" cy="42.500" r="2.800" fill="#06142B" />
        <path d="M56 24C48 4 28 0 16 13" fill="none" stroke="#1F4478" strokeWidth="2.200" strokeLinecap="round" />
        <circle className="ab-lure__halo" cx="15" cy="15" r="13" />
        <circle className="ab-lure" cx="15" cy="15" r="4.600" />
      </g>
    </svg>
  );
}

function Fish({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 22 10" className="ab-fish" style={style}>
      <path className="ab-fish__tail" d="M6 5L0 0.500V9.500Z" /><ellipse cx="13" cy="5" rx="8" ry="4" /><circle cx="17" cy="4" r="0.900" fill="#06142B" />
    </svg>
  );
}

export default function AbyssesScene() {
  return (
    <>
      <div className="ab-water" />

      <div className="el-layer ab-shafts" style={vars({ top: '0px', '--k': 0.1, '--kx': 2 })}>
        <span className="ab-shaft" style={vars({ left: '12%', width: '60px', '--d': '9s', '--delay': '0s' })} />
        <span className="ab-shaft" style={vars({ left: '44%', width: '42px', '--d': '7s', '--delay': '-3s' })} />
        <span className="ab-shaft" style={vars({ left: '70%', width: '74px', '--d': '11s', '--delay': '-6s' })} />
      </div>

      <div className="el-layer ab-deep" style={vars({ top: '26px', '--k': 0.2, '--kx': 3 })}>
        <svg viewBox="0 0 310 110" className="ab-whale">
          <path d="M10 62C40 30 120 18 190 30C230 36 262 50 280 46C292 42 298 30 296 22C306 34 304 56 290 66C270 78 220 86 170 86C110 86 50 84 10 62Z" />
          <path d="M110 80C104 96 116 104 130 100C126 92 122 86 122 80Z" />
          <path d="M14 64C30 66 46 64 58 58" fill="none" stroke="#06142B" strokeOpacity="0.5" strokeWidth="1.600" /><circle cx="52" cy="50" r="2" fill="#06142B" fillOpacity="0.6" />
        </svg>
      </div>

      <div className="el-layer ab-mid" style={vars({ top: '52px', '--k': 0.3, '--kx': 6 })}>
        <div className="ab-school">
          {SCHOOL.map((f, i) => <Fish key={i} style={vars({ left: `${f.x.toFixed(0)}px`, top: `${f.y.toFixed(0)}px`, width: `${(20 * f.s).toFixed(0)}px`, '--delay': f.delay })} />)}
        </div>
      </div>

      <div className="el-layer ab-reef ab-reef--far" style={vars({ top: '148px', '--k': 0.5, '--kx': 6 })}>
        <div className="ab-set">
          <svg viewBox="0 0 480 90" width="480">
            {KELP_FAR.map((k) => <path key={k.x} className={`ab-kelp ab-kelp--far${k.tone}`} d={k.d} strokeWidth={k.w} style={vars({ transformOrigin: `${k.x}px 86px`, '--delay': k.delay })} />)}
            <path d="M0 90V70Q30 52 64 66Q90 44 130 62Q170 48 200 68Q244 50 280 66Q320 46 356 64Q396 50 430 66Q456 56 480 70V90Z" fill="#0B2448" />
          </svg>
        </div>
      </div>

      <div className="el-layer ab-life" style={vars({ top: '0px', '--k': 0.65, '--kx': 11 })}>
        <div className="ab-set">
          <Jelly style={{ left: 96, top: 44, width: 54 }} delay="0s" />
          <Jelly style={{ left: 232, top: 78, width: 40 }} delay="-2.500s" />
          <Jelly style={{ left: 356, top: 22, width: 30 }} delay="-4s" far />
          <Angler style={{ left: 296, top: 122, width: 124 }} />
        </div>
      </div>

      <div className="el-layer ab-reef ab-reef--near" style={vars({ top: '172px', '--k': 0.9, '--kx': 18 })}>
        <div className="ab-set">
          <svg viewBox="0 0 480 80" width="480">
            {KELP_NEAR.map((k) => <path key={k.x} className={`ab-kelp ab-kelp--near${k.tone}`} d={k.d} strokeWidth={k.w} style={vars({ transformOrigin: `${k.x}px 74px`, '--delay': k.delay })} />)}
            <g className="ab-coral">
              <path d="M150 62V40M150 52C142 48 140 40 142 32M150 48C158 44 162 36 160 28M150 42C146 36 148 28 152 22" fill="none" stroke="#E0557F" strokeWidth="4.500" strokeLinecap="round" />
              <path d="M342 64V46M342 56C334 52 332 46 334 40M342 52C350 48 352 42 350 36" fill="none" stroke="#F0A040" strokeWidth="4" strokeLinecap="round" />
            </g>
            <path d="M0 80V60Q24 40 60 56Q96 34 140 54Q176 44 210 60Q250 38 292 56Q330 42 364 58Q410 36 446 56Q466 48 480 58V80Z" fill="#071A36" />
          </svg>
        </div>
      </div>

      <div className="ab-bubbles">
        {BUBBLES.map((b, i) => (
          <span key={i} className="ab-bubble" style={vars({ '--x': b.x, '--s': b.s, '--d': b.d, '--delay': b.delay, '--sway': b.sway })} />
        ))}
      </div>
    </>
  );
}
