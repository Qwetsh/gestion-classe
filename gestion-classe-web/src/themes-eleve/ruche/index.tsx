import type { CSSProperties } from 'react';
import { scatter, seeded, vars } from '../shared';
import './theme.css';

/**
 * Thème « Ruche » : une prairie en été, un rayon de miel, une ruche de paille.
 * Plans, du fond vers l'avant : ciel doré et soleil, collines, ruche et fleurs, abeilles, herbes,
 * rayon de miel qui pend en haut de l'écran, grains de pollen.
 * Mouvement, sans que l'élève touche à rien : les abeilles font la navette entre les fleurs et la
 * ruche (ailes qui vibrent), les fleurs se balancent, une goutte de miel se forme et tombe du rayon,
 * le pollen flotte.
 * Au toucher : la ruche (un essaim en sort en spirale, tourne, puis rentre), le rayon (ses alvéoles
 * brillent et le miel s'égoutte).
 */

const R = 12;
const LIMIT = [2, 3, 4, 4, 3, 3, 2, 1];
const pick = seeded(83);
const CELLS = LIMIT.flatMap((limit, col) =>
  Array.from({ length: limit + 1 }, (_, row) => {
    const cx = 16 + col * R * 1.5;
    const cy = 8 + row * R * 1.732 + (col % 2 ? R * 0.866 : 0);
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`;
    });
    const roll = pick();
    return { key: `${col}-${row}`, d: `M${pts.join('L')}Z`, cx, cy, kind: roll < 0.42 ? 'honey' : roll < 0.74 ? 'empty' : 'cap', i: col + row };
  }),
);

const POLLEN = scatter(11, 23, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${(r() * 86 + 6).toFixed(1)}%`,
  s: `${(r() * 3 + 3).toFixed(1)}px`,
  d: `${(r() * 8 + 10).toFixed(1)}s`,
  delay: `${(-r() * 18).toFixed(1)}s`,
}));

const SWARM = scatter(12, 37, (r, i) => ({
  a: `${Math.round(i * 30 + r() * 20)}deg`,
  rad: `${Math.round(40 + r() * 70)}px`,
  delay: `${(r() * 0.5).toFixed(2)}s`,
}));

function Bee({ className }: { className: string }) {
  return (
    <div className={`ru-bee ${className}`}>
      <svg viewBox="0 0 30 22" width="26">
        <ellipse className="ru-wing" cx="12" cy="6" rx="6" ry="4" /><ellipse className="ru-wing ru-wing--back" cx="18" cy="5.500" rx="5" ry="3.500" />
        <path d="M27 13L30 12 27 15Z" fill="#33240A" />
        <ellipse cx="16" cy="13" rx="10" ry="6.500" fill="#F7B32B" />
        <path d="M13 7.200Q11 13 13 18.800M19 7.200Q21 13 19 18.800" fill="none" stroke="#33240A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="6" cy="12" r="5" fill="#33240A" /><circle cx="4.500" cy="10.800" r="1.200" fill="#FFFDF5" />
      </svg>
    </div>
  );
}

function Flower({ style, color, center, delay }: { style: CSSProperties; color: string; center: string; delay: string }) {
  return (
    <svg viewBox="0 0 40 90" className="ru-flower" style={{ ...style, ...vars({ '--delay': delay }) }}>
      <path d="M20 90C18 66 22 44 20 24" fill="none" stroke="#4F8A2B" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 62C10 58 6 50 8 44C16 46 20 54 20 62ZM20 50C30 46 34 38 32 32C24 34 20 42 20 50Z" fill="#5FA033" />
      <g fill={color}>
        {[0, 60, 120, 180, 240, 300].map((a) => <ellipse key={a} cx="20" cy="9" rx="5.500" ry="9" transform={`rotate(${a} 20 20)`} />)}
      </g>
      <circle cx="20" cy="20" r="6.500" fill={center} />
    </svg>
  );
}

export default function RucheScene() {
  return (
    <>
      <div className="el-layer ru-sky" style={vars({ top: '0px', '--k': 0.3 })} />
      <div className="el-layer ru-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 2 })}>
        <div className="el-stage"><div className="ru-sun" /></div>
      </div>
      <div className="el-layer ru-hills" style={vars({ top: '132px', '--k': 0.46, '--kx': 5 })} />

      <div className="el-layer ru-meadow" style={vars({ top: '0px', '--k': 0.76, '--kx': 11 })}>
        <div className="ru-ground" />
        <div className="ru-set">
          <svg viewBox="0 0 120 120" className="ru-hive" style={{ left: 330, top: 92, width: 104 }} data-tap="essaim" data-tap-ms="4200">
            <path d="M14 108H106V116H14Z" fill="#8A5A2B" /><path d="M24 116V120M96 116V120" stroke="#8A5A2B" strokeWidth="6" />
            <path d="M18 108C12 86 20 60 34 44C44 28 76 28 86 44C100 60 108 86 102 108Z" fill="#E7B152" />
            <g fill="none" stroke="#C98A2B" strokeWidth="3" strokeLinecap="round">
              <path d="M36 46Q60 54 84 46M26 62Q60 72 94 62M20 78Q60 90 100 78M18 94Q60 106 102 94" />
            </g>
            <path d="M48 30C52 20 68 20 72 30Z" fill="#C98A2B" />
            <ellipse cx="60" cy="96" rx="11" ry="9" fill="#3A2408" />
            <g className="ru-swarm">
              {SWARM.map((b, i) => (
                <g key={i} className="ru-swarmbee" style={vars({ '--a': b.a, '--rad': b.rad, '--delay': b.delay })}>
                  <ellipse cx="60" cy="96" rx="4" ry="2.600" fill="#F7B32B" stroke="#33240A" strokeWidth="1" /><ellipse cx="60" cy="93" rx="2.600" ry="1.600" fill="#FFFDF5" fillOpacity="0.85" />
                </g>
              ))}
            </g>
          </svg>
          <Flower style={{ left: 62, top: 128, width: 34 }} color="#FFFFFF" center="#F7B32B" delay="0s" />
          <Flower style={{ left: 112, top: 146, width: 26 }} color="#E8503A" center="#3A2408" delay="-2s" />
          <Flower style={{ left: 176, top: 136, width: 30 }} color="#6C8CF0" center="#FFE08A" delay="-3.500s" />
          <Flower style={{ left: 250, top: 150, width: 24 }} color="#FFFFFF" center="#F7B32B" delay="-1.200s" />
          <Flower style={{ left: 290, top: 140, width: 28 }} color="#E8503A" center="#3A2408" delay="-4s" />
        </div>
      </div>

      <div className="el-layer ru-air" style={vars({ top: '0px', '--k': 0.66, '--kx': 9 })}>
        <div className="el-stage">
          <Bee className="ru-bee--a" /><Bee className="ru-bee--b" /><Bee className="ru-bee--c" /><Bee className="ru-bee--d" />
        </div>
      </div>

      <div className="el-layer ru-grass" style={vars({ top: '196px', '--k': 0.92, '--kx': 19 })} />

      <div className="el-layer ru-comb" style={vars({ top: '0px', '--k': 1, '--kx': 16 })}>
        <div className="ru-set">
          <svg viewBox="0 0 160 150" style={{ left: 40, top: -8, width: 160 }} data-tap="miel" data-tap-ms="2800">
            <path d="M0 -4H160" stroke="#8A5A2B" strokeWidth="8" />
            {CELLS.map((c) => (
              <g key={c.key} className={`ru-cell ru-cell--${c.kind}`} style={vars({ '--i': c.i })}>
                <path d={c.d} />
                {c.kind === 'honey' && <path d={`M${(c.cx - 5).toFixed(1)} ${(c.cy - 4).toFixed(1)}q4 -3 8 0`} className="ru-cell__shine" />}
              </g>
            ))}
            <g className="ru-drips">
              <ellipse className="ru-drip ru-drip--idle" cx="70" cy="100" rx="3.400" ry="4.600" />
              <ellipse className="ru-drip ru-drip--a" cx="34" cy="62" rx="3" ry="4.200" />
              <ellipse className="ru-drip ru-drip--b" cx="88" cy="80" rx="3.400" ry="4.600" />
              <ellipse className="ru-drip ru-drip--c" cx="124" cy="52" rx="3" ry="4.200" />
              <ellipse className="ru-drip ru-drip--d" cx="56" cy="92" rx="3.200" ry="4.400" />
            </g>
          </svg>
        </div>
      </div>

      <div className="ru-pollen">
        {POLLEN.map((p, i) => <span key={i} className="ru-mote" style={vars({ left: p.x, top: p.y, '--s': p.s, '--d': p.d, '--delay': p.delay })} />)}
      </div>
    </>
  );
}
