import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Parquet » : un gymnase de basket, un après-midi de match.
 * Plans, du fond vers l'avant : mur et hautes fenêtres, rayons de soleil, guirlande de fanions et
 * tableau d'affichage, gradins et spectateurs, parquet avec le panier et le ballon, poussières.
 * Mouvement, sans que l'élève touche à rien : le ballon dribble tout seul, les fanions se balancent,
 * les rayons de soleil respirent, quelques spectateurs s'agitent, les deux points de l'horloge
 * clignotent, la poussière danse dans la lumière.
 * Au toucher : le ballon (un tir en cloche, le filet claque, le score monte, le ballon retombe,
 * rebondit et revient en roulant), le tableau d'affichage (compte à rebours 3-2-1-0, sirène, les
 * gradins se lèvent, des confettis tombent).
 */

const FLAG_COLORS = ['#1D4ED8', '#F08A3C', '#FFFFFF'];
const FLAGS = Array.from({ length: 15 }, (_, i) => {
  const t = (i + 0.5) / 15;
  return { x: -20 + 520 * t, y: 8 + 104 * t * (1 - t), color: FLAG_COLORS[i % 3] ?? '#FFFFFF', delay: `${(-i * 0.37).toFixed(2)}s` };
});

const SHIRTS = ['#1D4ED8', '#F08A3C', '#E7503A', '#2E9C6A', '#F2C230', '#7A4EC2'];
const SKINS = ['#F2C9A0', '#C98D5E', '#8A5A3A', '#E8B48A'];
const FANS = scatter(24, 29, (r, i) => ({
  x: Math.round(14 + (i % 8) * 60 + r() * 34),
  y: 122 + Math.floor(i / 8) * 26,
  shirt: SHIRTS[Math.floor(r() * SHIRTS.length)] ?? '#1D4ED8',
  skin: SKINS[Math.floor(r() * SKINS.length)] ?? '#F2C9A0',
  delay: `${(-r() * 4).toFixed(2)}s`,
  lively: r() > 0.6,
  u: (r() * 0.5).toFixed(2),
}));

const CONFETTI = scatter(28, 13, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  color: ['#1D4ED8', '#F08A3C', '#FFFFFF', '#F2C230'][Math.floor(r() * 4)] ?? '#FFFFFF',
  delay: `${(1.35 + r() * 1.1).toFixed(2)}s`,
  d: `${(1.5 + r() * 0.9).toFixed(2)}s`,
  dx: `${Math.round(r() * 70 - 35)}px`,
  rot: `${Math.round(r() * 900 + 360)}deg`,
}));

const DUST = scatter(9, 77, (r) => ({
  x: `${(r() * 92 + 4).toFixed(1)}%`,
  y: `${Math.round(r() * 150 + 30)}px`,
  d: `${(r() * 6 + 7).toFixed(1)}s`,
  delay: `${(-r() * 12).toFixed(1)}s`,
}));

export default function ParquetScene() {
  return (
    <>
      <div className="el-layer pq-wall" style={vars({ top: '0px', '--k': 0.3 })}>
        <div className="el-stage">
          <span className="pq-window" style={{ left: '2%' }} /><span className="pq-window" style={{ left: '38%' }} /><span className="pq-window" style={{ left: '74%' }} />
          <span className="pq-beam" style={vars({ left: '2%', '--delay': '0s' })} /><span className="pq-beam" style={vars({ left: '38%', '--delay': '-2.5s' })} /><span className="pq-beam" style={vars({ left: '74%', '--delay': '-5s' })} />
        </div>
      </div>

      <div className="el-layer pq-stands" style={vars({ top: '118px', '--k': 0.45, '--kx': 6 })} />

      <div className="el-layer pq-deco" style={vars({ top: '0px', '--k': 0.45, '--kx': 6 })}>
        <div className="pq-set">
          <svg viewBox="0 0 480 250" width="480">
            {/* Spectateurs */}
            {FANS.map((f, i) => (
              <g key={i} className={`pq-fan${f.lively ? ' pq-fan--lively' : ''}`} style={vars({ '--delay': f.delay, '--u': f.u })}>
                <rect x={f.x - 5} y={f.y + 4} width="10" height="9" rx="3" fill={f.shirt} />
                <circle cx={f.x} cy={f.y} r="4.200" fill={f.skin} />
              </g>
            ))}
            {/* Guirlande de fanions */}
            <path d="M-20 8Q240 60 500 8" fill="none" stroke="#B89868" strokeWidth="1.400" />
            {FLAGS.map((f, i) => (
              <path key={i} className="pq-flag" d={`M${(f.x - 9).toFixed(1)} ${f.y.toFixed(1)}H${(f.x + 9).toFixed(1)}L${f.x.toFixed(1)} ${(f.y + 20).toFixed(1)}Z`} fill={f.color} stroke="#B89868" strokeWidth="0.800" style={vars({ '--delay': f.delay })} />
            ))}
            {/* Tableau d'affichage */}
            <g className="pq-board" data-tap="buzzer" data-tap-ms="4200">
              <rect className="pq-board__case" x="166" y="58" width="148" height="46" rx="7" />
              <text className="pq-board__label" x="194" y="70" textAnchor="middle">LOCAUX</text>
              <text className="pq-board__label" x="286" y="70" textAnchor="middle">VISITEURS</text>
              <text className="pq-board__score pq-board__score--old" x="194" y="96" textAnchor="middle">68</text>
              <text className="pq-board__score pq-board__score--new" x="194" y="96" textAnchor="middle">71</text>
              <text className="pq-board__score" x="286" y="96" textAnchor="middle">66</text>
              <text className="pq-board__clock" x="240" y="88" textAnchor="middle">0<tspan className="pq-board__colon">:</tspan>24</text>
              {['3', '2', '1', '0'].map((n, i) => (
                <text key={n} className="pq-board__count" x="240" y="92" textAnchor="middle" style={vars({ '--n': i })}>{n}</text>
              ))}
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer pq-court" style={vars({ top: '0px', '--k': 0.82, '--kx': 13 })}>
        <div className="pq-boards" />
        <div className="pq-set">
          <svg viewBox="0 0 480 250" width="480">
            {/* Raquette peinte, sous le panier */}
            <path d="M256 201H440V207H256Z" fill="#1D4ED8" /><path d="M-400 201H880" stroke="#FFFFFF" strokeWidth="1.600" strokeOpacity="0.850" />
            {/* Poteau, planche, cercle */}
            <path d="M406 201V98C406 86 398 82 386 82H370" fill="none" stroke="#5B5772" strokeWidth="6" strokeLinecap="round" />
            <path d="M398 201H414" stroke="#5B5772" strokeWidth="6" strokeLinecap="round" />
            <rect x="362" y="60" width="8" height="66" rx="2" fill="#FFFFFF" stroke="#B9B4CC" strokeWidth="1.400" />
            <path d="M362 112H326" stroke="#C23E1C" strokeWidth="2.600" strokeLinecap="round" />
            {/* Le ballon */}
            <g className="pq-ballx" data-tap="tir" data-tap-ms="4600">
              <rect x="110" y="138" width="40" height="66" fill="transparent" />
              <ellipse className="pq-shadow" cx="130" cy="201.500" rx="13" ry="3" />
              <g className="pq-bally">
                <g className="pq-ball">
                  <circle cx="130" cy="187" r="13" fill="#F08A3C" stroke="#8A3F12" strokeWidth="1.600" />
                  <path d="M117 187H143M130 174V200M120.800 177.800C127 183 127 191 120.800 196.200M139.200 177.800C133 183 133 191 139.200 196.200" fill="none" stroke="#8A3F12" strokeWidth="1.200" />
                </g>
              </g>
            </g>
            {/* Devant le ballon : le bord du cercle et le filet */}
            <g className="pq-net">
              <path d="M327 113L332 139H356L361 113M327 113L340 139M336 113L348 139M345 113L356 139M361 113L348 139M352 113L340 139M343 113L332 139M329 123H359M331 132H357" fill="none" stroke="#8E88A8" strokeWidth="1.100" />
            </g>
            <ellipse className="pq-rim" cx="344" cy="112" rx="18" ry="3.200" />
          </svg>
        </div>
      </div>

      <div className="pq-air">
        {DUST.map((m, i) => <span key={i} className="pq-dust" style={vars({ left: m.x, top: m.y, '--d': m.d, '--delay': m.delay })} />)}
        {CONFETTI.map((c, i) => (
          <span key={i} className="pq-confetti" style={vars({ left: c.x, background: c.color, '--delay': c.delay, '--d': c.d, '--dx': c.dx, '--rot': c.rot })} />
        ))}
      </div>
    </>
  );
}
