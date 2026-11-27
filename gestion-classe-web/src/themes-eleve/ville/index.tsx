import { scatter, seeded, vars } from '../shared';
import './theme.css';

/**
 * Thème « Ville la nuit » : les toits, les néons et le métro aérien.
 * Plans, du fond vers l'avant : ciel et étoiles, lune, avion, immeubles lointains, immeubles aux
 * fenêtres éclairées (antenne, enseigne au néon), viaduc et métro, toits du premier plan avec un
 * chat.
 * Mouvement, sans que l'élève touche à rien : des fenêtres s'allument et s'éteignent, le néon
 * grésille, le feu de l'antenne clignote, un avion traverse le ciel, le métro passe sur le viaduc,
 * le chat remue la queue et cligne des yeux, les étoiles scintillent.
 * Au toucher : le ciel (un feu d'artifice : trois fusées montent et éclatent), le viaduc (un métro
 * express file dans l'autre sens).
 */

const STARS = scatter(16, 53, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${Math.round(r() * 110 + 4)}px`,
  s: `${(r() * 1.6 + 1.2).toFixed(1)}px`,
  d: `${(r() * 3 + 2.2).toFixed(1)}s`,
  delay: `${(-r() * 5).toFixed(1)}s`,
}));

const BUILDINGS = [
  { x: -30, w: 70, top: 122 }, { x: 44, w: 60, top: 88 }, { x: 108, w: 52, top: 134 }, { x: 164, w: 72, top: 102 },
  { x: 240, w: 46, top: 146 }, { x: 290, w: 62, top: 78 }, { x: 356, w: 54, top: 120 }, { x: 414, w: 62, top: 98 }, { x: 480, w: 60, top: 132 },
];

const pick = seeded(11);
const WINDOWS = BUILDINGS.flatMap((b, bi) => {
  const cols = Math.floor((b.w - 8) / 12);
  const rows = Math.min(7, Math.floor((204 - b.top - 8) / 14));
  const x0 = b.x + (b.w - (cols * 12 - 6)) / 2;
  return Array.from({ length: cols * rows }, (_, i) => {
    const v = pick();
    const kind = v < 0.36 ? 'lit' : v < 0.42 ? 'cyan' : v < 0.52 ? 'blink' : 'off';
    return { key: `${bi}-${i}`, x: x0 + (i % cols) * 12, y: b.top + 10 + Math.floor(i / cols) * 14, kind, d: `${(pick() * 9 + 5).toFixed(1)}s`, delay: `${(-pick() * 12).toFixed(1)}s` };
  });
});

const SPARKS = Array.from({ length: 12 }, (_, i) => i * 30);
const FIREWORKS = [
  { x: '24%', y: 58, color: '#FF5FA8', r: 60, t: '0s' },
  { x: '70%', y: 40, color: '#5EEAD4', r: 70, t: '0.55s' },
  { x: '47%', y: 84, color: '#FFD98A', r: 52, t: '1.15s' },
];

function Train({ className, stripe }: { className: string; stripe: string }) {
  return (
    <g className={className}>
      {[0, 64, 128].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <rect x="0" y="0" width="60" height="17" rx="4" fill="#5247B4" />
          <rect x="0" y="11" width="60" height="2.200" fill={stripe} />
          {[5, 16, 27, 38, 49].map((w) => <rect key={w} x={w} y="3" width="7" height="6" rx="1" fill="#FFE9A8" />)}
        </g>
      ))}
      <path d="M-4 17H192" stroke="#0E0B22" strokeWidth="2" />
    </g>
  );
}

export default function VilleScene() {
  return (
    <>
      <div className="vi-sky" />

      <div className="el-layer vi-heaven" style={vars({ top: '0px', '--k': 0.3, '--kx': 2 })}>
        {STARS.map((s, i) => (
          <span key={i} className="vi-star" style={vars({ left: s.x, top: s.y, width: s.s, height: s.s, '--d': s.d, '--delay': s.delay })} />
        ))}
        <div className="el-stage">
          <div className="vi-moon" />
          <svg viewBox="0 0 30 10" className="vi-plane">
            <path d="M2 6H24L28 4M10 6L6 9M20 6L18 2" fill="none" stroke="#8E86C8" strokeWidth="1.600" strokeLinecap="round" />
            <circle className="vi-plane__light" cx="15" cy="7.500" r="1.600" />
          </svg>
          {/* Feu d'artifice : éteint tant qu'on ne touche pas le ciel */}
          <div className="vi-skytap" data-tap="feu" data-tap-ms="3800" />
          {FIREWORKS.map((f, i) => (
            <div key={i} className="vi-fw" style={vars({ left: f.x, top: `${f.y}px`, '--c': f.color, '--r': `${f.r}px`, '--t': f.t })}>
              <span className="vi-fw__rocket" />
              <div className="vi-fw__burst">
                <span className="vi-fw__flash" />
                {SPARKS.map((a) => <span key={a} className="vi-fw__spark" style={vars({ '--a': `${a}deg` })} />)}
                {SPARKS.map((a) => <span key={`in${a}`} className="vi-fw__spark vi-fw__spark--in" style={vars({ '--a': `${a + 15}deg` })} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="el-layer vi-far" style={vars({ top: '58px', '--k': 0.4, '--kx': 4 })} />

      <div className="el-layer vi-mid" style={vars({ top: '0px', '--k': 0.55, '--kx': 8 })}>
        <div className="vi-midfill" />
        <div className="vi-set">
          <svg viewBox="0 0 480 250" width="480">
            <g fill="#1B1545">
              {BUILDINGS.map((b) => <rect key={b.x} x={b.x} y={b.top} width={b.w} height={250 - b.top} />)}
              <rect x="304" y="66" width="34" height="14" /><rect x="314" y="56" width="14" height="12" />
              <rect x="-400" y="160" width="1280" height="90" />
            </g>
            <path d="M321 56V36M74 88V62M66 70H82M70 76H78" stroke="#1B1545" strokeWidth="2.400" strokeLinecap="round" />
            <circle className="vi-beacon" cx="74" cy="61" r="2.600" />
            <circle className="vi-beacon vi-beacon--b" cx="321" cy="35" r="2.200" />
            {WINDOWS.map((w) => (
              <rect key={w.key} className={`vi-win vi-win--${w.kind}`} x={w.x} y={w.y} width="6" height="8" rx="1" style={w.kind === 'blink' ? vars({ '--d': w.d, '--delay': w.delay }) : undefined} />
            ))}
            {/* Enseigne au néon sur le toit */}
            <g className="vi-neon" transform="translate(200 82)">
              <path d="M-12 20V-6M12 20V-6" stroke="#1B1545" strokeWidth="2" />
              <path className="vi-neon__tube" d="M0 5C-6 -4 -14 2 -8 9L0 17L8 9C14 2 6 -4 0 5Z" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer vi-rail" style={vars({ top: '0px', '--k': 0.72, '--kx': 12 })}>
        <div className="vi-railtap" data-tap="metro" data-tap-ms="3000" />
        <div className="vi-set">
          <svg viewBox="0 0 480 250" width="480">
            <Train className="vi-train" stripe="#FF5FA8" />
            <Train className="vi-train vi-train--express" stripe="#5EEAD4" />
            <rect x="-400" y="196" width="1280" height="7" fill="#0E0B22" />
            <path d="M-400 196H880" stroke="#6258C0" strokeWidth="1.600" />
            <path className="vi-raillights" d="M-400 199.500H880" />
            {Array.from({ length: 16 }, (_, i) => <rect key={i} x={-396 + i * 84} y="203" width="8" height="50" fill="#0E0B22" />)}
          </svg>
        </div>
      </div>

      <div className="el-layer vi-roofs" style={vars({ top: '0px', '--k': 0.92, '--kx': 18 })}>
        <div className="vi-rooffill" />
        <div className="vi-set">
          <svg viewBox="0 0 480 250" width="480">
            <path d="M-400 250V228H-20V216H64V228H96V208H168V228H214V220H258V232H318V212H372V226H386V206H470V230H880V250Z" fill="#0A0818" />
            {/* Réservoir d'eau, antenne râteau */}
            <path d="M112 208V198M146 208V198M108 198H150V180H108ZM106 180L129 170L152 180Z" fill="#0A0818" stroke="#0A0818" strokeWidth="2" />
            <path d="M344 212V184M334 188H354M337 193H351M340 198H348" fill="none" stroke="#0A0818" strokeWidth="2" strokeLinecap="round" />
            {/* Le chat */}
            <g className="vi-cat" transform="translate(418 206)">
              <path className="vi-cat__tail" d="M9 -3C17 -3 20 -9 17 -15" />
              <path d="M-9 0C-10 -9 -5 -14 1 -14C8 -14 11 -8 10 0Z" fill="#0A0818" />
              <path d="M-9 -15C-10 -20 -8 -23 -7 -24L-4 -20H1L4 -24C5 -23 7 -20 6 -15C6 -11 2 -9 -1.500 -9C-5 -9 -9 -11 -9 -15Z" fill="#0A0818" />
              <g className="vi-cat__eyes"><circle cx="-4.500" cy="-15.500" r="1.300" /><circle cx="1.500" cy="-15.500" r="1.300" /></g>
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
