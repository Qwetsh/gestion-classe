import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Stade » : un soir de match, sous les projecteurs.
 * Plans, du fond vers l'avant : ciel de nuit, tribunes et leur foule, quatre mâts de projecteurs et
 * leurs faisceaux, tableau d'affichage, pelouse tondue en bandes, but et ballon.
 * Mouvement, sans que l'élève touche à rien : dans la foule des flashs crépitent, les faisceaux
 * respirent, les deux points de l'horloge clignotent, le ballon tressaute.
 * Au toucher : le ballon (il part en cloche dans la lucarne, le filet se gonfle, la foule s'illumine,
 * le tableau affiche « BUT ! »), les tribunes (une ola traverse la foule).
 */

/** La foule : des points répartis dans la courbe des tribunes. `--u` (0 à 1) = position de gauche à droite. */
const CROWD = scatter(84, 67, (r) => {
  const u = r();
  const x = 8 + u * 464;
  const rim = 44 - 30 * Math.sin(Math.PI * u);
  const y = rim + 8 + r() * 46;
  return { x: x.toFixed(1), y: y.toFixed(1), u: u.toFixed(3), d: `${(r() * 5 + 2.5).toFixed(1)}s`, delay: `${(-r() * 7).toFixed(1)}s`, tone: Math.floor(r() * 3) };
});

function Mast({ x, flip }: { x: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} 0)${flip ? ' scale(-1 1)' : ''}`}>
      <path className="st-beam" d="M0 12L150 190H40Z" />
      <path d="M-2 14V110" stroke="#1C3A2C" strokeWidth="4" fill="none" />
      <rect x="-15" y="0" width="30" height="16" rx="2" fill="#16302A" />
      <g className="st-lamps">
        <circle cx="-9" cy="5" r="2.600" /><circle cx="0" cy="5" r="2.600" /><circle cx="9" cy="5" r="2.600" />
        <circle cx="-9" cy="11" r="2.600" /><circle cx="0" cy="11" r="2.600" /><circle cx="9" cy="11" r="2.600" />
      </g>
    </g>
  );
}

export default function StadeScene() {
  return (
    <>
      <div className="st-sky" />

      <div className="el-layer st-stands" style={vars({ top: '48px', '--k': 0.4, '--kx': 4 })}>
        <div className="st-set">
          <svg viewBox="0 0 480 130" width="480" data-tap="ola" data-tap-ms="3200">
            <path d="M-20 130V46C80 20 180 12 240 12C300 12 400 20 500 46V130Z" fill="#0F2B20" />
            <path d="M-20 46C80 20 180 12 240 12C300 12 400 20 500 46" fill="none" stroke="#2A5C44" strokeWidth="2" />
            <path d="M-20 76C80 52 180 44 240 44C300 44 400 52 500 76M-20 104C80 82 180 74 240 74C300 74 400 82 500 104" fill="none" stroke="#163A2B" strokeWidth="1.400" />
            {CROWD.map((c, i) => (
              <circle key={i} className={`st-fan st-fan--${c.tone}`} cx={c.x} cy={c.y} r="1.700" style={vars({ '--u': c.u, '--d': c.d, '--delay': c.delay })} />
            ))}
          </svg>
        </div>
      </div>

      <div className="el-layer st-lights" style={vars({ top: '10px', '--k': 0.48, '--kx': 7 })}>
        <div className="st-set">
          <svg viewBox="0 0 480 200" width="480">
            <Mast x={76} /><Mast x={404} flip />
            <g className="st-board">
              <rect x="186" y="6" width="108" height="30" rx="4" fill="#0A1712" stroke="#2A5C44" strokeWidth="1.400" />
              <text className="st-board__score" x="240" y="20" textAnchor="middle">LOCAUX 2 – 1 VISIT.</text>
              <text className="st-board__clock" x="240" y="31" textAnchor="middle">67<tspan className="st-board__colon">:</tspan>12</text>
              <text className="st-board__goal" x="240" y="27" textAnchor="middle">BUT !</text>
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer st-pitch" style={vars({ top: '150px', '--k': 0.8, '--kx': 12 })}>
        <div className="st-grass" />
        <div className="st-set">
          <svg viewBox="0 0 480 90" width="480" className="st-lines">
            <path d="M0 12H480" /><path d="M130 12V90" /><ellipse cx="130" cy="52" rx="46" ry="22" />
            <path d="M330 12V70H480" /><path d="M410 12V42H480" />
            <g className="st-goal">
              <path className="st-net" d="M396 -34H440V12H396Z" />
              <path d="M396 12V-34H440V12" />
            </g>
            <ellipse className="st-shadow" cx="216" cy="62" rx="9" ry="2.600" />
            <g className="st-ballx" data-tap="but" data-tap-ms="3800">
              <rect x="190" y="26" width="52" height="46" fill="transparent" stroke="none" />
              <g className="st-bally">
                <g className="st-ball">
                  <circle cx="216" cy="52" r="9" fill="#FFFFFF" stroke="#10160F" strokeWidth="1.200" />
                  <path d="M216 47.500L220.300 50.600L218.600 55.600H213.400L211.700 50.600Z" fill="#10160F" stroke="none" />
                  <path d="M216 47.500V43.200M220.300 50.600L224.300 49.300M218.600 55.600L221.200 59.200M213.400 55.600L210.800 59.200M211.700 50.600L207.700 49.300" stroke="#10160F" strokeWidth="1.100" />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
