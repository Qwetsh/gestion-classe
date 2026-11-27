import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Microscope » : une goutte d'eau de mare vue à l'oculaire.
 * Plans, du fond vers l'avant : fond coloré, cellules d'épiderme d'oignon, êtres vivants (amibe,
 * cellule ronde, paramécie, euglène, diatomée, bactéries), halos flous du premier plan.
 * Mouvement, sans que l'élève touche à rien : l'amibe se déforme et rampe, la paramécie nage en
 * battant des cils, ses vacuoles se vident et se remplissent, l'euglène traverse l'écran en
 * fouettant son flagelle, les bactéries s'agitent, des poussières dérivent.
 * Au toucher : la cellule ronde (elle se divise en deux, une cellule fille s'éloigne), la paramécie
 * (elle file à travers la goutte, fait demi-tour et revient).
 */

const MOTES = scatter(10, 19, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${(r() * 90 + 4).toFixed(1)}%`,
  s: `${Math.round(r() * 26 + 10)}px`,
  d: `${(r() * 14 + 16).toFixed(1)}s`,
  delay: `${(-r() * 30).toFixed(1)}s`,
  dx: `${Math.round(r() * 60 - 30)}px`,
  dy: `${Math.round(r() * 60 - 30)}px`,
}));

const RODS = scatter(9, 67, (r) => ({
  x: Math.round(20 + r() * 440),
  y: Math.round(14 + r() * 190),
  a: Math.round(r() * 180),
  w: Math.round(10 + r() * 8),
  delay: `${(-r() * 2).toFixed(2)}s`,
}));

function Cell({ className }: { className: string }) {
  return (
    <g className={className}>
      <circle r="26" fill="#F9CFE2" stroke="#E38AB8" strokeWidth="2.200" />
      <circle cx="-9" cy="10" r="3" fill="#FBE4EE" /><circle cx="12" cy="-12" r="2.400" fill="#FBE4EE" /><circle cx="13" cy="11" r="2" fill="#F3B3D0" />
      <g className="mi-nucleus">
        <circle cx="-3" cy="-3" r="9" fill="#C2478F" /><circle cx="-5.500" cy="-5.500" r="2.800" fill="#8E2A66" />
      </g>
    </g>
  );
}

export default function MicroscopeScene() {
  return (
    <>
      <div className="el-layer mi-bg" style={vars({ top: '0px', '--k': 0.3 })} />
      <div className="el-layer mi-tissue" style={vars({ top: '0px', '--k': 0.4, '--kx': 4 })} />

      <div className="el-layer mi-life" style={vars({ top: '0px', '--k': 0.62, '--kx': 9 })}>
        <div className="mi-set">
          <div className="mi-amoeba">
            <span className="mi-amoeba__foot" />
            <span className="mi-amoeba__nucleus" /><span className="mi-amoeba__vac" /><span className="mi-amoeba__vac mi-amoeba__vac--b" />
          </div>
          <svg viewBox="0 0 480 240" width="480">
            {/* Bactéries : des bâtonnets qui s'agitent sur place */}
            {RODS.map((b, i) => (
              <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.a})`}>
                <rect className="mi-rod" x={-b.w / 2} y="-2.500" width={b.w} height="5" rx="2.500" style={vars({ '--delay': b.delay })} />
              </g>
            ))}
            {/* Un chapelet de coques */}
            <g className="mi-chain" transform="translate(246 186)">
              <circle cx="0" cy="0" r="3.400" /><circle cx="6.500" cy="-2" r="3.400" /><circle cx="13" cy="-2.500" r="3.400" /><circle cx="19.500" cy="-1" r="3.400" /><circle cx="25.500" cy="2" r="3.400" />
            </g>
            {/* Diatomée */}
            <g transform="translate(118 44)">
              <g className="mi-diatom">
                <path d="M-30 0C-16 -9 16 -9 30 0C16 9 -16 9 -30 0Z" fill="#F2DC9A" stroke="#B8923A" strokeWidth="1.600" />
                <path d="M-26 0H26M-16 -5V5M-8 -6.500V6.500M0 -7V7M8 -6.500V6.500M16 -5V5" stroke="#B8923A" strokeWidth="1" fill="none" />
              </g>
            </g>
            {/* Euglène : elle traverse la goutte en fouettant son flagelle */}
            <g className="mi-euglena">
              <path className="mi-flagellum" d="M-22 0C-29 -6 -33 5 -40 -1C-44 -5 -49 1 -54 -2" />
              <g className="mi-euglena__body">
                <path d="M-22 0C-14 -9 8 -10 22 0C8 9 -14 10 -22 0Z" fill="#A7DA72" stroke="#5E9E33" strokeWidth="1.600" />
                <ellipse cx="2" cy="0" rx="6" ry="3.200" fill="#6FB13F" /><circle cx="12" cy="1" r="1.800" fill="#6FB13F" />
                <circle cx="-13" cy="-1" r="2.200" fill="#E0533A" />
              </g>
            </g>
            {/* La cellule ronde : deux cellules confondues, qui se séparent au toucher */}
            <g transform="translate(206 76)" data-tap="mitose" data-tap-ms="5200">
              <circle r="30" fill="transparent" />
              <g className="mi-cellpulse">
                <Cell className="mi-cell mi-cell--b" />
                <Cell className="mi-cell mi-cell--a" />
              </g>
            </g>
            {/* La paramécie */}
            <g className="mi-para" data-tap="nage" data-tap-ms="3600">
              <g className="mi-para__dash">
                <ellipse rx="50" ry="24" fill="transparent" />
                <path className="mi-cilia" d="M-44 2C-44 -12 -24 -18 -2 -17C20 -16 44 -12 46 0C47 10 28 17 4 17C-20 17 -44 14 -44 2Z" />
                <path d="M-44 2C-44 -12 -24 -18 -2 -17C20 -16 44 -12 46 0C47 10 28 17 4 17C-20 17 -44 14 -44 2Z" fill="#CDEBDF" stroke="#5FAF95" strokeWidth="2" />
                <path d="M-8 16C-3 7 4 4 11 6" fill="none" stroke="#5FAF95" strokeWidth="1.600" strokeLinecap="round" />
                <ellipse cx="6" cy="-3" rx="12" ry="6" fill="#6FB9A1" /><circle cx="-9" cy="2" r="2.600" fill="#4E9A82" />
                <circle cx="-17" cy="-7" r="3" fill="#9BD3C0" /><circle cx="24" cy="6" r="3" fill="#9BD3C0" /><circle cx="26" cy="-7" r="2.400" fill="#9BD3C0" />
                <circle className="mi-vacuole" cx="-30" cy="1" r="5" /><circle className="mi-vacuole mi-vacuole--b" cx="35" cy="-1" r="4.400" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer mi-front" style={vars({ top: '0px', '--k': 1, '--kx': 17 })}>
        <div className="mi-fade" />
        <div className="el-stage">
          <span className="mi-halo" style={vars({ left: '-46px', top: '128px', width: '130px', '--d': '13s' })} />
          <span className="mi-halo" style={vars({ left: '72%', top: '-30px', width: '160px', '--d': '17s' })} />
          <span className="mi-halo mi-halo--pink" style={vars({ left: '34%', top: '150px', width: '90px', '--d': '11s' })} />
        </div>
      </div>

      <div className="mi-motes">
        {MOTES.map((m, i) => (
          <span key={i} className="mi-mote" style={vars({ left: m.x, top: m.y, width: m.s, height: m.s, '--d': m.d, '--delay': m.delay, '--dx': m.dx, '--dy': m.dy })} />
        ))}
      </div>
    </>
  );
}
