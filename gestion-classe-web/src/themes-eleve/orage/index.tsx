import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Orage » : une station météo sur sa colline, sous un ciel d'orage.
 * Plans, du fond vers l'avant : ciel, lueurs d'éclairs lointains, nuages du fond, crête et ses
 * éoliennes sous un rideau de pluie, colline et sa
 * station (abri météo, anémomètre, girouette, pluviomètre, manche à air), éclair, banc de nuages,
 * pré avec son arbre et sa flaque, pluie.
 * Mouvement, sans que l'élève touche à rien : les nuages défilent, la pluie tombe en biais, les
 * éoliennes et les coupelles de l'anémomètre tournent, la girouette hésite, la manche à air bat, l'arbre se balance,
 * des ronds se forment dans la flaque, un éclair lointain illumine les nuages de temps en temps.
 * Au toucher : les nuages (la foudre tombe sur la colline), la station (une rafale : l'anémomètre
 * s'emballe, la manche à air se tend, l'arbre plie et perd des feuilles, la pluie se couche).
 */

const RAIN = scatter(30, 97, (r) => ({
  x: `${(r() * 132).toFixed(1)}%`,
  h: `${Math.round(r() * 14 + 16)}px`,
  d: `${(r() * 0.5 + 0.7).toFixed(2)}s`,
  delay: `${(-r() * 1.2).toFixed(2)}s`,
  o: (r() * 0.4 + 0.3).toFixed(2),
}));

const LEAVES = scatter(11, 41, (r) => ({
  x: `${Math.round(94 + r() * 50)}px`,
  y: `${Math.round(118 + r() * 40)}px`,
  dy: `${Math.round(r() * 110 - 80)}px`,
  rot: `${Math.round(r() * 540 + 240)}deg`,
  delay: `${(0.35 + r() * 1.5).toFixed(2)}s`,
  s: `${(r() * 4 + 6).toFixed(1)}px`,
}));

export default function OrageScene() {
  return (
    <>
      <div className="or-sky" />

      <div className="el-layer or-sheetlayer" style={vars({ top: '0px', '--k': 0.3, '--kx': 2 })}>
        <div className="el-stage"><div className="or-sheet" /></div>
      </div>

      <div className="el-layer or-far" style={vars({ top: '0px', '--k': 0.34, '--kx': 3 })} />

      <div className="el-layer or-ridge" style={vars({ top: '128px', '--k': 0.44, '--kx': 5 })}>
        <div className="or-veil" />
        <div className="or-set">
          <svg viewBox="0 0 480 70" width="480">
            {[{ x: 172, y: 28, s: 1 }, { x: 216, y: 28, s: 0.8 }, { x: 254, y: 22, s: 0.7 }].map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
                <path d="M0 0V-34" stroke="#C9D4EA" strokeWidth="1.800" strokeLinecap="round" />
                <g className="or-blades" style={vars({ '--delay': `${-i * 1.3}s` })}>
                  <path d="M0 -34V-50M0 -34L13.900 -26M0 -34L-13.900 -26" stroke="#E6ECF8" strokeWidth="2" strokeLinecap="round" />
                </g>
                <circle cx="0" cy="-34" r="1.800" fill="#E6ECF8" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="el-layer or-hills" style={vars({ top: '0px', '--k': 0.55, '--kx': 7 })}>
        <div className="or-hillfill" />
        <div className="or-flash" />
        <div className="or-set">
          <svg viewBox="0 0 480 240" width="480">
            <path d="M-400 240V176C-300 168 -220 182 -140 178C-60 174 0 190 60 184C140 176 220 150 300 146C360 143 420 150 480 162C560 178 640 170 720 176C800 182 840 174 880 176V240Z" fill="#1B2644" />
            {/* La station météo */}
            <g data-tap="rafale" data-tap-ms="3800">
              <rect x="282" y="84" width="146" height="72" fill="transparent" />
              {/* Abri météo et pluviomètre */}
              <path d="M296 150V136M312 150V136" stroke="#8FA0C4" strokeWidth="1.600" />
              <rect x="292" y="120" width="24" height="17" fill="#E6ECF8" />
              <path d="M294 124H314M294 128H314M294 132H314" stroke="#9FB0D0" strokeWidth="1" />
              <path d="M289 120L304 114L319 120Z" fill="#C9D4EA" />
              <path d="M324 148V139H331V148ZM322.500 139H332.500" fill="#C9D4EA" stroke="#C9D4EA" strokeWidth="1.200" />
              {/* Mât : anémomètre à coupelles et girouette */}
              <path d="M350 149V94" stroke="#8FA0C4" strokeWidth="2.400" strokeLinecap="round" />
              {[0, -0.4, -0.8].map((delay) => (
                <g key={delay} className="or-cup" style={vars({ '--delay': `${delay}s` })}>
                  <path d="M350 94H363" stroke="#8FA0C4" strokeWidth="1.600" />
                  <circle cx="365.500" cy="94" r="3.600" fill="#E6ECF8" />
                </g>
              ))}
              <circle cx="350" cy="94" r="2.200" fill="#C9D4EA" />
              <g className="or-vane">
                <path d="M337 109H364" stroke="#FFD84A" strokeWidth="1.800" />
                <path d="M331 109L339 104.500V113.500Z" fill="#FFD84A" />
                <path d="M364 109L372 103V115Z" fill="#FFD84A" />
              </g>
              {/* Manche à air */}
              <path d="M410 153V110" stroke="#8FA0C4" strokeWidth="2" strokeLinecap="round" />
              <g className="or-sock">
                <path d="M410 110L401 111V121L410 122Z" fill="#FF7A3D" />
                <path d="M401 111L392 112.100V119.900L401 121Z" fill="#F4F6FB" />
                <path d="M392 112.100L384 113V119L392 119.900Z" fill="#FF7A3D" />
              </g>
            </g>
            {/* La foudre */}
            <g className="or-bolt">
              <path className="or-bolt__glow" d="M236 66L218 104L232 102L206 136L220 134L198 160M218 104L196 120L202 121L186 138" />
              <path className="or-bolt__core" d="M236 66L218 104L232 102L206 136L220 134L198 160M218 104L196 120L202 121L186 138" />
              <ellipse className="or-bolt__hit" cx="198" cy="161" rx="26" ry="7" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer or-bank" style={vars({ top: '-8px', '--k': 0.4, '--kx': 9 })}>
        <div className="or-bank__clouds" data-tap="eclair" data-tap-ms="2600" />
      </div>

      <div className="el-layer or-ground" style={vars({ top: '0px', '--k': 0.82, '--kx': 14 })}>
        <div className="or-groundfill" />
        <div className="or-set">
          <svg viewBox="0 0 480 240" width="480">
            <path d="M-400 240V212C-280 204 -160 214 -40 208C60 203 150 216 250 214C350 212 430 202 520 206C640 211 760 204 880 210V240Z" fill="#0F1626" />
            {/* Flaque et ses ronds */}
            <ellipse cx="258" cy="225" rx="40" ry="5.500" fill="#22335A" />
            <ellipse className="or-ripple" cx="244" cy="225" rx="10" ry="2" style={vars({ '--delay': '0s' })} />
            <ellipse className="or-ripple" cx="272" cy="226" rx="10" ry="2" style={vars({ '--delay': '-0.7s' })} />
            <ellipse className="or-ripple" cx="258" cy="224" rx="10" ry="2" style={vars({ '--delay': '-1.3s' })} />
            {/* Touffes d'herbe */}
            <g className="or-grass">
              <path d="M174 214l-4 -10M174 214l1 -13M174 214l5 -9M352 211l-4 -10M352 211l1 -12M352 211l5 -9M420 206l-3 -9M420 206l2 -11M196 215l-3 -8M196 215l3 -10" />
            </g>
            {/* L'arbre */}
            <g className="or-tree">
              <path d="M114 209C116 192 115 178 118 160M118 182L131 166" fill="none" stroke="#4A3A33" strokeWidth="5" strokeLinecap="round" />
              <g className="or-tree__crown">
                <circle cx="98" cy="150" r="16" fill="#184034" /><circle cx="139" cy="150" r="17" fill="#184034" />
                <circle cx="118" cy="138" r="24" fill="#1E4D3C" />
                <circle cx="107" cy="124" r="15" fill="#2A6A50" /><circle cx="132" cy="127" r="14" fill="#245C46" />
              </g>
            </g>
            {/* Volutes de vent (rafale) */}
            <g className="or-gusts">
              <path pathLength="1" d="M470 126C410 116 350 130 300 122C276 118 268 102 282 98C294 95 300 108 288 112" />
              <path pathLength="1" d="M440 176C370 168 300 182 230 172C204 168 198 152 212 149C223 147 228 159 217 162" />
              <path pathLength="1" d="M300 96C250 88 200 100 150 94" />
            </g>
          </svg>
          {LEAVES.map((l, i) => (
            <span key={i} className="or-leaf" style={vars({ left: l.x, top: l.y, '--dy': l.dy, '--rot': l.rot, '--delay': l.delay, '--s': l.s })} />
          ))}
        </div>
      </div>

      <div className="or-rain">
        {RAIN.map((d, i) => (
          <span key={i} className="or-drop" style={vars({ left: d.x, height: d.h, '--d': d.d, '--delay': d.delay, '--o': d.o })} />
        ))}
      </div>
    </>
  );
}
