import type { CSSProperties } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Jungle » : sous la canopée, en fin de matinée.
 * Plans, du fond vers l'avant : ciel et rayons de soleil, canopée lointaine, canopée proche et
 * palmier, branches avec un toucan et un caméléon, papillons, buissons en deux rangs, feuillage et
 * lianes qui pendent du haut de l'écran, feuilles qui tombent.
 * Mouvement, sans que l'élève touche à rien : les rayons respirent, les lianes et les grandes
 * feuilles se balancent, le toucan bouge la tête et cligne de l'œil, l'œil du caméléon tourne, une
 * mouche bourdonne devant lui, les papillons volent, des feuilles tombent.
 * Au toucher : le toucan (il sautille, bat des ailes, claque du bec), le caméléon (il change de
 * couleur et attrape la mouche d'un coup de langue), le feuillage du haut (il s'ébroue et laisse
 * tomber sa rosée).
 */

const FALLING = scatter(9, 19, (r) => ({
  x: `${(r() * 104 - 2).toFixed(1)}%`,
  s: `${(r() * 6 + 10).toFixed(1)}px`,
  d: `${(r() * 10 + 16).toFixed(1)}s`,
  delay: `${(-r() * 26).toFixed(1)}s`,
  dx: `${Math.round(r() * 140 - 70)}px`,
  spin: `${Math.round(r() * 420 + 200)}deg`,
  tone: Math.floor(r() * 3),
}));

const DROPS = scatter(16, 43, (r) => ({
  x: `${(r() * 96 + 2).toFixed(1)}%`,
  y: `${Math.round(r() * 100 + 16)}px`,
  s: `${(r() * 3 + 5).toFixed(1)}px`,
  d: `${(r() * 0.5 + 0.8).toFixed(2)}s`,
  delay: `${(r() * 0.7).toFixed(2)}s`,
}));

const BEAMS = [
  { left: '8%', w: 54, d: '9s', delay: '0s' },
  { left: '30%', w: 38, d: '7s', delay: '-3s' },
  { left: '52%', w: 66, d: '11s', delay: '-5s' },
  { left: '78%', w: 44, d: '8s', delay: '-2s' },
];

/** Toucan perché, tourné vers la gauche. */
function Toucan({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 90 84" className="ju-toucan" style={style} data-tap="toucan" data-tap-ms="2600">
      <g className="ju-toucan__body">
        <path d="M62 60L80 80 68 77 59 66Z" fill="#1B2620" />
        <path d="M57 64L63 73 54 71Z" fill="#E23E3E" />
        <path d="M48 26C63 23 73 35 71 50C69 63 59 71 49 71C41 71 37 63 37 53C37 40 39 30 48 26Z" fill="#1F2A24" />
        <path d="M42 32C37 38 36 48 39 57C44 52 48 44 48 34Z" fill="#FFF3C4" />
        <path d="M39 51C40 54 42 56 45 57" fill="none" stroke="#F2A531" strokeWidth="2.4" strokeLinecap="round" />
        <path className="ju-wing" d="M53 36C65 38 69 50 63 60C55 58 49 48 53 36Z" fill="#33443A" />
        <path d="M46 71V77M54 70V77" fill="none" stroke="#60717B" strokeWidth="2.6" strokeLinecap="round" />
        <g className="ju-toucan__head">
          <path className="ju-jaw" d="M38 30C26 29 14 29 6 31C16 36 28 36 38 33Z" fill="#E8791A" />
          <path d="M38 19C24 13 8 17 2 30C12 28 26 28 38 30Z" fill="#FF9F1C" />
          <path d="M38 19C24 13 8 17 2 30C10 23 24 21 38 23Z" fill="#FFD23F" />
          <path d="M2 30C5 25 9 23 13 23L10 29Z" fill="#B8301A" />
          <circle cx="47" cy="26" r="11.500" fill="#1F2A24" />
          <circle cx="43" cy="24" r="4.600" fill="#5EC8F0" />
          <g className="ju-eye"><circle cx="43" cy="24" r="2" fill="#10160F" /><circle cx="42.300" cy="23.300" r="0.700" fill="#FFFFFF" /></g>
        </g>
      </g>
    </svg>
  );
}

/** Caméléon sur sa branche, tourné vers la droite, et la mouche qui tourne devant lui. */
function Chameleon({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 130 72" className="ju-cham" style={style} data-tap="cameleon" data-tap-ms="3800">
      <g className="ju-fly">
        <ellipse cx="174" cy="25" rx="3.400" ry="1.800" fill="#DDEFF7" /><ellipse cx="179" cy="25" rx="3.400" ry="1.800" fill="#DDEFF7" />
        <circle cx="176.500" cy="28" r="2.200" fill="#1F2A24" />
      </g>
      <g className="ju-tongue">
        <path d="M124 43C140 41 156 35 173 30" fill="none" stroke="#E2557A" strokeWidth="2.800" strokeLinecap="round" />
        <circle cx="174" cy="29.500" r="3.200" fill="#E2557A" />
      </g>
      <path className="ju-cham__line" d="M30 46C14 44 4 52 8 62C12 70 24 68 23 60C22 55 16 55 16 59" fill="none" strokeWidth="6" strokeLinecap="round" />
      <path className="ju-cham__line" d="M86 54L88 66M92 54L96 65M42 56L40 66M48 57L52 66" fill="none" strokeWidth="4.600" strokeLinecap="round" />
      <path className="ju-cham__fill" d="M26 48C24 28 44 14 66 16C80 17 92 24 98 34L96 52C84 58 60 60 40 58C32 57 27 54 26 48Z" />
      <path className="ju-cham__fill" d="M40 25l3-7 4 6ZM52 19l3-7 4 6ZM64 16l3-7 4 7ZM76 19l3-7 4 7Z" />
      <path className="ju-cham__fill" d="M90 30L100 12L110 24C120 26 126 34 124 42C122 48 114 52 104 52L92 52Z" />
      <path d="M50 24C48 34 50 46 54 56M64 20C62 32 64 46 68 57M78 22C77 32 78 44 82 54" fill="none" stroke="rgba(255, 255, 255, 0.34)" strokeWidth="3" strokeLinecap="round" />
      <path d="M106 46L124 42.500" fill="none" stroke="rgba(15, 50, 25, 0.5)" strokeWidth="1.400" strokeLinecap="round" />
      <circle cx="108" cy="32" r="7" fill="#C9ECB4" stroke="rgba(15, 50, 25, 0.35)" strokeWidth="1" />
      <circle className="ju-cham__pupil" cx="108" cy="32" r="2.500" fill="#10160F" />
    </svg>
  );
}

function Butterfly({ className, color }: { className: string; color: string }) {
  return (
    <div className={`ju-bfly ${className}`}>
      <svg viewBox="0 0 28 22" width="22">
        <g className="ju-bfly__wing">
          <path d="M14 11C8 0 0 2 1 9C2 15 9 16 14 11Z" fill={color} stroke="#1F2A24" strokeWidth="1" />
          <path d="M14 11C9 14 4 16 5 20C8 22 12 18 14 11Z" fill={color} stroke="#1F2A24" strokeWidth="1" />
        </g>
        <g className="ju-bfly__wing ju-bfly__wing--right">
          <path d="M14 11C20 0 28 2 27 9C26 15 19 16 14 11Z" fill={color} stroke="#1F2A24" strokeWidth="1" />
          <path d="M14 11C19 14 24 16 23 20C20 22 16 18 14 11Z" fill={color} stroke="#1F2A24" strokeWidth="1" />
        </g>
        <path d="M14 5V17" stroke="#1F2A24" strokeWidth="1.800" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Une liane : une tige qui pend du haut, des feuilles alternées, parfois une fleur au bout. */
function Liana({ x, length, flower, delay }: { x: number; length: number; flower?: boolean; delay: string }) {
  const leaves = Array.from({ length: Math.floor(length / 22) }, (_, i) => {
    const y = 16 + i * 22;
    const side = i % 2 ? 1 : -1;
    const lx = x + Math.sin(i * 1.3) * 4;
    return `M${lx.toFixed(1)} ${y}c${6 * side} -8 ${16 * side} -8 ${20 * side} 0c${-6 * side} 7 ${-14 * side} 7 ${-20 * side} 0Z`;
  }).join('');
  return (
    <g className="ju-liana" style={vars({ transformOrigin: `${x}px 0px`, '--delay': delay })}>
      <path d={`M${x} -6C${x + 7} ${length * 0.3} ${x - 7} ${length * 0.65} ${x + 2} ${length}`} fill="none" stroke="#4E7F45" strokeWidth="2.600" strokeLinecap="round" />
      <path d={leaves} fill="#3F9A52" />
      {flower && <path d={`M${x + 2} ${length}c-7 2 -9 10 -4 15c2 -5 4 -6 4 -6c0 0 2 1 4 6c5 -5 3 -13 -4 -15Z`} fill="#FF6B4A" />}
    </g>
  );
}

export default function JungleScene() {
  return (
    <>
      <div className="el-layer ju-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer ju-rays" style={vars({ top: '0px', '--k': 0.32, '--kx': 2 })}>
        {BEAMS.map((b) => (
          <span key={b.left} className="ju-beam" style={vars({ left: b.left, width: `${b.w}px`, '--d': b.d, '--delay': b.delay })} />
        ))}
      </div>

      <div className="el-layer ju-far" style={vars({ top: '66px', '--k': 0.42, '--kx': 4 })}>
        <div className="ju-set">
          <svg viewBox="0 0 480 130" width="480">
            <g fill="#9CCF94">
              <path d="M118 70V10M372 66V4" fill="none" stroke="#93C58B" strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="118" cy="12" rx="36" ry="13" /><ellipse cx="100" cy="20" rx="22" ry="9" /><ellipse cx="140" cy="20" rx="20" ry="8" />
              <ellipse cx="372" cy="6" rx="42" ry="14" /><ellipse cx="350" cy="16" rx="22" ry="9" /><ellipse cx="398" cy="15" rx="24" ry="9" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer ju-mid" style={vars({ top: '104px', '--k': 0.56, '--kx': 8 })}>
        <div className="ju-set">
          <svg viewBox="0 0 480 150" width="480">
            <path d="M70 150C66 110 74 70 84 36" fill="none" stroke="#4E7F45" strokeWidth="7" strokeLinecap="round" />
            <g className="ju-palm" fill="#3F9A52">
              <path d="M84 36C60 14 30 12 8 30C34 24 58 26 84 36Z" /><path d="M84 36C108 14 138 12 160 30C134 24 110 26 84 36Z" />
              <path d="M84 36C70 12 48 0 24 2C46 8 64 18 84 36Z" /><path d="M84 36C98 12 120 0 144 2C122 8 104 18 84 36Z" />
              <path d="M84 36C62 36 40 46 26 64C46 50 64 44 84 36Z" /><path d="M84 36C106 36 128 46 142 64C122 50 104 44 84 36Z" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer ju-near" style={vars({ top: '0px', '--k': 0.72, '--kx': 12 })}>
        <div className="ju-set">
          <svg viewBox="0 0 480 240" width="480" className="ju-branches">
            <g fill="none" stroke="#6B4A2B" strokeLinecap="round">
              <path d="M490 138C440 146 380 150 318 164" strokeWidth="9" />
              <path d="M400 148C392 132 384 124 372 120" strokeWidth="4" />
              <path d="M-10 186C40 180 100 180 168 170" strokeWidth="8" />
            </g>
            <g fill="#2F8F4E">
              <path d="M372 120C360 108 344 110 338 120C350 126 362 126 372 120Z" /><path d="M384 126C380 110 368 104 358 106C362 118 372 126 384 126Z" />
              <path d="M318 164C304 154 288 156 282 166C294 174 306 174 318 164Z" /><path d="M168 170C182 158 198 160 204 170C192 178 180 178 168 170Z" />
            </g>
          </svg>
          <Toucan style={{ left: 335, top: 85, width: 72 }} />
          <Chameleon style={{ left: 52, top: 125, width: 104 }} />
        </div>
      </div>

      <div className="el-layer ju-air" style={vars({ top: '0px', '--k': 0.64, '--kx': 10 })}>
        <div className="el-stage">
          <Butterfly className="ju-bfly--a" color="#2E9BFF" />
          <Butterfly className="ju-bfly--b" color="#FF8A3D" />
          <Butterfly className="ju-bfly--c" color="#FFD23F" />
        </div>
      </div>

      <div className="el-layer ju-bush ju-bush--back" style={vars({ top: '192px', '--k': 0.8, '--kx': 14 })} />
      <div className="el-layer ju-bush ju-bush--front" style={vars({ top: '200px', '--k': 0.92, '--kx': 20 })} />

      <div className="el-layer ju-top" style={vars({ top: '0px', '--k': 1, '--kx': 18 })}>
        <div className="ju-set">
          <svg viewBox="0 0 480 170" width="480" className="ju-hang">
            <Liana x={214} length={112} delay="-1s" />
            <Liana x={296} length={78} flower delay="-4s" />
            <Liana x={262} length={40} delay="-2.500s" />
            <g className="ju-fronds" data-tap="rosee" data-tap-ms="2400">
              <path d="M470 -6C420 -10 372 6 336 38C380 24 426 16 470 16Z" fill="#4FA85A" />
              <path d="M484 -6C434 4 384 34 354 90C396 64 440 38 484 24Z" fill="#2F8F4E" />
              <path d="M484 -6C454 24 434 64 432 118C452 80 470 50 484 38Z" fill="#237A40" />
              <path d="M484 -6C434 4 384 34 354 90M484 -6C454 24 434 64 432 118" fill="none" stroke="#5CB86A" strokeWidth="1.600" strokeLinecap="round" />
            </g>
            <g className="ju-monstera" data-tap="rosee" data-tap-ms="2400">
              <path d="M30 26C70 8 130 18 180 58C130 68 70 58 30 26Z" fill="#4FA85A" transform="rotate(14 30 26)" />
              <path fillRule="evenodd" fill="#2F8F4E" d="M68 -8C104 -6 140 6 164 28L148 42 174 38C186 52 194 68 194 84L172 82 190 100C188 116 178 130 164 138C148 142 132 138 118 130L128 112 108 124C94 114 82 100 74 84L94 78 70 72C62 48 62 20 68 -8ZM108 44a8 4.500 30 1 0 15 8a8 4.500 30 1 0 -15 -8ZM132 78a8 4.500 40 1 0 14 10a8 4.500 40 1 0 -14 -10Z" />
              <path d="M68 -8C100 32 136 88 164 138M92 26L148 42M84 52L172 82M114 88L128 112M106 74L94 78" fill="none" stroke="#1F7A3A" strokeWidth="2.200" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </div>

      <div className="ju-fall">
        {FALLING.map((l, i) => (
          <span key={i} className={`ju-leaf ju-leaf--${l.tone}`} style={vars({ '--x': l.x, '--s': l.s, '--d': l.d, '--delay': l.delay, '--dx': l.dx, '--spin': l.spin })} />
        ))}
      </div>

      <div className="ju-dew">
        {DROPS.map((d, i) => (
          <span key={i} className="ju-drop" style={vars({ left: d.x, top: d.y, '--s': d.s, '--d': d.d, '--delay': d.delay })} />
        ))}
      </div>
    </>
  );
}
