import type { CSSProperties } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Crépuscule » : un ciel de fin de journée comme dans un dessin animé japonais d'aujourd'hui.
 * Dégradé indigo, rose, orange ; gros cumulus en aplats (lumière, corps, ombre) ; toits, poteau et
 * fils électriques en ombres chinoises ; pétales qui traversent l'écran.
 * Mouvement : deux rangées de nuages dérivent à des vitesses différentes, les étoiles scintillent
 * doucement, une étoile filante passe de temps en temps, les pétales tombent en tournant.
 * Au défilement, la scène s'en va par le haut, les plans proches plus vite que les lointains : le
 * soleil se couche derrière les collines. Chaque plan sombre porte son aplat, qui recouvre le ciel.
 * Au toucher : sur les toits, les oiseaux posés sur le fil s'envolent puis reviennent se poser ;
 * sur le ciel, une rafale de pétales traverse l'écran.
 * Aucun personnage, aucun décor repris d'une œuvre existante.
 */

const STARS = scatter(18, 11, (r) => ({
  left: `${(r() * 96 + 2).toFixed(1)}%`,
  top: `${(r() * 120 + 6).toFixed(0)}px`,
  s: `${(r() * 1.6 + 1.4).toFixed(1)}px`,
  d: `${(r() * 4 + 3.5).toFixed(1)}s`,
  delay: `${(-r() * 6).toFixed(1)}s`,
}));

const PETALS = scatter(14, 23, (r) => ({
  x: `${(r() * 110 - 5).toFixed(1)}%`,
  s: `${(r() * 5 + 7).toFixed(1)}px`,
  d: `${(r() * 9 + 13).toFixed(1)}s`,
  delay: `${(-r() * 22).toFixed(1)}s`,
  dx: `${Math.round(r() * 120 - 150)}px`,
  spin: `${Math.round(r() * 500 + 260)}deg`,
}));

/** La rafale du toucher : des pétales qui traversent l'écran de gauche à droite. */
const GUST = scatter(22, 37, (r) => ({
  y: `${Math.round(r() * 330 + 10)}px`,
  s: `${(r() * 6 + 7).toFixed(1)}px`,
  d: `${(r() * 1.4 + 1.6).toFixed(2)}s`,
  delay: `${(r() * 1.2).toFixed(2)}s`,
  dy: `${Math.round(r() * 160 - 60)}px`,
  spin: `${Math.round(r() * 700 + 360)}deg`,
}));

/** Les oiseaux posés sur le fil de gauche (points pris sur la courbe du fil), et où ils s'envolent. */
const WIRE_BIRDS = [
  { x: 202.4, y: 40.3, fx: -70, fy: -150, delay: '0.25s' },
  { x: 218, y: 38.7, fx: 40, fy: -170, delay: '0s' },
  { x: 237.1, y: 36.6, fx: 120, fy: -140, delay: '0.4s' },
  { x: 264.7, y: 32.5, fx: 170, fy: -165, delay: '0.12s' },
];

/** Un cumulus en trois aplats : le corps, l'ombre du dessous, la lumière du dessus. */
function Cloud({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 160 72" className="cr-cloud" style={style}>
      <path className="cr-cloud__body" d="M14 66Q2 66 4 54Q6 42 22 44Q22 24 44 24Q52 6 76 10Q98 4 106 26Q130 20 136 42Q156 42 154 58Q154 66 142 66Z" />
      <path className="cr-cloud__shade" d="M14 66Q2 66 4 54Q34 61 80 56Q128 61 154 58Q154 66 142 66Z" />
      <path className="cr-cloud__light" d="M22 44Q22 24 44 24Q52 6 76 10Q98 4 106 26Q96 15 78 18Q59 14 51 30Q35 30 29 46ZM106 26Q130 20 136 42Q126 31 111 34Z" />
    </svg>
  );
}

/** Une rangée de nuages, répétée deux fois : elle peut défiler sans raccord visible. */
function CloudRow({ clouds }: { clouds: { left: string; top: number; width: number }[] }) {
  return (
    <div className="cr-drift">
      {[0, 1].map((set) => (
        <div key={set} className="cr-set">
          {clouds.map((c, i) => <Cloud key={i} style={{ left: c.left, top: c.top, width: c.width }} />)}
        </div>
      ))}
    </div>
  );
}

export default function CrepusculeScene() {
  return (
    <>
      <div className="el-layer cr-sky" data-tap="rafale" data-tap-ms="4400" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="cr-stars">
        {STARS.map((s, i) => (
          <span key={i} className="cr-star" style={vars({ left: s.left, top: s.top, '--s': s.s, '--d': s.d, '--delay': s.delay })} />
        ))}
        <span className="cr-shoot" />
      </div>

      <div className="el-layer cr-sunlayer" style={vars({ top: '0px', '--k': 0.35, '--kx': 3 })}>
        <div className="el-stage"><div className="cr-sun" /></div>
      </div>

      <div className="el-layer cr-clouds cr-clouds--far" style={vars({ top: '34px', '--k': 0.42, '--kx': 5 })}>
        <CloudRow clouds={[{ left: '4%', top: 34, width: 92 }, { left: '38%', top: 8, width: 70 }, { left: '70%', top: 44, width: 104 }]} />
      </div>
      <div className="el-layer cr-clouds cr-clouds--near" style={vars({ top: '56px', '--k': 0.5, '--kx': 10 })}>
        <CloudRow clouds={[{ left: '-6%', top: 40, width: 176 }, { left: '52%', top: 6, width: 150 }]} />
      </div>

      <div className="el-layer cr-hills" style={vars({ top: '192px', '--k': 0.62, '--kx': 12 })}>
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" width="100%" height="40">
          <path d="M0 40V20Q50 6 100 16T200 12T300 20T400 8V40Z" />
        </svg>
      </div>

      <div className="el-layer cr-town" style={vars({ top: '138px', '--k': 0.78, '--kx': 16 })}>
        <div className="el-stage">
          <svg viewBox="0 0 480 100" className="cr-roofs" data-tap="envol" data-tap-ms="9000">
            <g fill="none" strokeWidth="1.3">
              <path d="M-10 30Q170 62 340 16M-10 40Q170 72 344 24M364 16Q424 46 490 28M364 24Q424 54 490 38" />
            </g>
            {WIRE_BIRDS.map((b) => (
              <g key={b.x} transform={`translate(${b.x} ${b.y})`}>
                <g className="cr-perch">
                  <ellipse cx="0" cy="-3.4" rx="2.7" ry="3.4" /><circle cx="1.7" cy="-7" r="1.8" /><path d="M-1.6 -1.400L-5.500 1.600 -0.600 -0.200Z" />
                </g>
                <g className="cr-fly" style={vars({ '--fx': `${b.fx}px`, '--fy': `${b.fy}px`, '--delay': b.delay })}>
                  <path className="cr-fly__wings" d="M-6.500 -4Q-3 -9.500 0 -5Q3 -9.500 6.500 -4" fill="none" strokeWidth="1.7" strokeLinecap="round" />
                </g>
              </g>
            ))}
            <path d="M0 100V70H30V58L62 44 94 58V66H130V50H150V40H186V62H214L236 46 262 62V72H300V56H330V76H372V60L398 46 424 60V70H456V54H480V100Z" />
            <path d="M345 6h5v94h-5zM330 14h36v3h-36zM334 24h28v3h-28zM350 36h10v15h-10zM332 10h3v4h-3zM346 10h3v4h-3zM360 10h3v4h-3zM310 44h14v12h-14zM312 56h2v6h-2zM320 56h2v6h-2z" />
            <path d="M168 40V22M161 26h14M163 31h10" fill="none" strokeWidth="1.4" />
            <g className="cr-windows">
              <rect x="40" y="64" width="6" height="6" /><rect x="106" y="72" width="5" height="6" /><rect x="160" y="47" width="6" height="5" />
              <rect x="240" y="66" width="5" height="5" /><rect x="404" y="62" width="6" height="6" /><rect x="466" y="60" width="5" height="6" />
            </g>
            <rect className="cr-window-pink" x="312" y="62" width="5" height="6" />
          </svg>
        </div>
      </div>

      <div className="cr-gust">
        {GUST.map((p, i) => (
          <span key={i} className="cr-gp" style={vars({ top: p.y, '--s': p.s, '--d': p.d, '--delay': p.delay, '--dy': p.dy, '--spin': p.spin })} />
        ))}
      </div>

      <div className="cr-petals">
        {PETALS.map((p, i) => (
          <span key={i} className="cr-petal" style={vars({ '--x': p.x, '--s': p.s, '--d': p.d, '--delay': p.delay, '--dx': p.dx, '--spin': p.spin })} />
        ))}
      </div>
    </>
  );
}
