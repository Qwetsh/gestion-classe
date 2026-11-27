import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Volcan » : la nuit, un volcan en éruption.
 * Plans, du fond vers l'avant : ciel rougi, crête lointaine, cône (fumée, cratère, coulées),
 * braises qui montent sur tout l'écran, roches du premier plan.
 * Mouvement : la lave coule (des reflets descendent le long des coulées), la fumée s'élève et se
 * dissipe, le cratère respire lentement, les braises montent. Aucun éclair, aucun clignotement.
 * Au toucher (sur le volcan) : une éruption. Une gerbe de lave jaillit du cratère et retombe en
 * cloche, un panache de gaz monte, le ciel rougeoie un instant, le cône tremble.
 */

const EMBERS = scatter(22, 7, (r) => ({
  x: `${Math.round(r() * 96 + 2)}%`,
  s: `${(r() * 3 + 2).toFixed(1)}px`,
  d: `${(r() * 9 + 10).toFixed(1)}s`,
  delay: `${(-r() * 18).toFixed(1)}s`,
  sway: `${Math.round(r() * 60 - 30)}px`,
}));

const PUFFS = [0, 1, 2, 3, 4, 5, 6];

/** La gerbe de lave : chaque éclat part du cratère, monte, puis retombe plus loin. */
const SHOTS = scatter(34, 41, (r) => ({
  dx: `${Math.round(r() * 190 - 95)}px`,
  up: `${Math.round(r() * 62 + 40)}px`,
  d: `${(r() * 0.9 + 1.5).toFixed(2)}s`,
  delay: `${(r() * 0.85).toFixed(2)}s`,
  r: (r() * 2 + 1.8).toFixed(1),
  hot: r() > 0.55,
}));

/** Le panache de gaz : de grosses volutes qui montent vite et s'élargissent. */
const GAS = scatter(8, 53, (r, i) => ({
  gx: `${Math.round(r() * 70 - 45)}px`,
  rise: `${Math.round(r() * 50 + 80)}px`,
  delay: `${(i * 0.16).toFixed(2)}s`,
  r: Math.round(r() * 6 + 11),
}));

const STREAMS = [
  'M198 64C188 92 174 112 166 142S150 184 138 214',
  'M216 64C224 98 242 122 252 152S266 192 274 214',
  'M207 64C207 86 199 102 205 128',
];

export default function VolcanScene() {
  return (
    <>
      <div className="vo-sky" />
      <div className="vo-floor" />
      <div className="vo-skyflash" />

      <div className="el-layer vo-ridge" style={vars({ top: '142px', '--k': 0.16, '--kx': 4 })}>
        <svg viewBox="0 0 400 90" preserveAspectRatio="none" width="100%" height="90">
          <path d="M0 90V52L34 32 62 46 104 16 142 44 176 30 214 50 262 22 306 46 352 28 400 44V90Z" fill="#20100D" />
          <path d="M104 16L118 40 96 34ZM262 22L276 44 252 38Z" fill="#2C1611" />
        </svg>
      </div>

      <div className="el-layer vo-cone" style={vars({ top: '0px', '--k': 0.3, '--kx': 9 })}>
        <div className="el-stage">
          <svg viewBox="0 0 340 214" className="vo-volcano" data-tap="eruption" data-tap-ms="3600">
            <defs>
              <radialGradient id="vo-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#FFD27A" stopOpacity="0.95" />
                <stop offset="0.35" stopColor="#FF6A2B" stopOpacity="0.7" />
                <stop offset="1" stopColor="#FF3A0A" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="vo-flank" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4A2218" />
                <stop offset="1" stopColor="#24110D" />
              </linearGradient>
              <filter id="vo-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
              <filter id="vo-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
            </defs>

            {/* Fumée : des volutes qui montent, grossissent et s'effacent */}
            <g filter="url(#vo-soft)">
              {PUFFS.map((i) => (
                <circle key={i} className="vo-puff" cx={207 + (i % 3) * 5 - 5} cy="54" r={13 + (i % 2) * 4} style={vars({ '--i': i })} />
              ))}
            </g>

            <ellipse className="vo-crater-glow" cx="207" cy="58" rx="66" ry="40" fill="url(#vo-glow)" />

            {/* Le cône : flanc gauche éclairé par la lave, flanc droit dans l'ombre */}
            <path d="M52 214L168 74Q178 60 192 62L224 62Q238 60 246 72L340 192V214Z" fill="#26120E" />
            <path d="M52 214L168 74Q178 60 192 62L204 64 150 214Z" fill="url(#vo-flank)" />
            <path d="M118 214L176 110 168 214ZM236 104L290 214H262ZM92 214L132 164 126 214Z" fill="#1B0C09" opacity="0.6" />
            <path d="M168 74Q178 60 192 62L224 62Q238 60 246 72" fill="none" stroke="#FF8A3D" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
            <ellipse cx="208" cy="64" rx="22" ry="4.5" fill="#FF7A2E" />
            <ellipse cx="208" cy="64" rx="13" ry="2.4" fill="#FFD98A" />

            {/* Coulées : un halo, la lave, puis des reflets clairs qui descendent */}
            <g fill="none" strokeLinecap="round">
              {STREAMS.map((d) => <path key={`h${d}`} d={d} stroke="#FF4A12" strokeWidth="13" opacity="0.4" filter="url(#vo-halo)" />)}
              {STREAMS.map((d) => <path key={`b${d}`} d={d} stroke="#FF6A2B" strokeWidth="5.5" />)}
              {STREAMS.map((d, i) => <path key={`c${d}`} d={d} className="vo-flow" stroke="#FFE0A0" strokeWidth="2" style={vars({ '--i': i })} />)}
            </g>

            {/* L'éruption, au toucher : éclair du cratère, panache de gaz, gerbe de lave */}
            <ellipse className="vo-blast" cx="207" cy="56" rx="120" ry="84" fill="url(#vo-glow)" />
            <path className="vo-jet" d="M197 64Q202 30 207 4Q212 30 217 64Z" fill="#FF8A3D" />
            <path className="vo-jet vo-jet--core" d="M202 64Q205 38 207 20Q209 38 212 64Z" fill="#FFE9A8" />
            <g filter="url(#vo-soft)">
              {GAS.map((g, i) => (
                <circle key={i} className="vo-gas" cx="207" cy="54" r={g.r} style={vars({ '--gx': g.gx, '--rise': g.rise, '--delay': g.delay })} />
              ))}
            </g>
            {SHOTS.map((p, i) => (
              <g key={i} className="vo-shot" style={vars({ '--dx': p.dx, '--up': p.up, '--d': p.d, '--delay': p.delay })}>
                <circle className={p.hot ? 'vo-shot__dot vo-shot__dot--hot' : 'vo-shot__dot'} cx="207" cy="62" r={p.r} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="vo-embers">
        {EMBERS.map((e, i) => (
          <span key={i} className="vo-ember" style={vars({ '--x': e.x, '--s': e.s, '--d': e.d, '--delay': e.delay, '--sway': e.sway })} />
        ))}
      </div>

      <div className="el-layer vo-rocks" style={vars({ bottom: '-40px', '--k': -0.06, '--kx': 16 })}>
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" width="100%" height="150">
          <path d="M0 120V64L22 40 48 58 70 30 104 62 132 44 160 70 196 36 228 66 262 48 296 72 330 34 362 60 400 42V120Z" fill="#0D0605" />
          <g className="vo-cracks" fill="none" stroke="#FF6A2B" strokeWidth="1.6" strokeLinecap="round">
            <path d="M70 34L78 60 70 84M196 40L204 70 192 96M330 38L322 66 334 92M132 48L126 78" />
          </g>
        </svg>
      </div>
    </>
  );
}
