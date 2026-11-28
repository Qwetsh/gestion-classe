import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Voyage » : cap vers l'inconnu, en fin d'après-midi, sous une lumière dorée.
 * Plans, du fond vers l'avant : ciel d'abricot et soleil bas, nuages, page de carnet de bord (rose
 * des vents et itinéraire en pointillés), mouettes, montgolfière rayée, île lointaine avec palmiers
 * et phare, mer, trois-mâts (et un dauphin), houle du premier plan, plage de sable avec un crabe,
 * une étoile de mer, un coquillage et une bouteille à la mer.
 * Mouvement, sans que l'élève touche à rien : les nuages passent, la montgolfière dérive et le
 * voyageur scrute l'horizon à la longue-vue, le trois-mâts tangue sur la houle et sa flamme
 * claque au vent, les palmiers se balancent, le soleil scintille sur l'eau, deux mouettes planent,
 * l'aiguille de la boussole frémit, l'écume va et vient, le crabe se promène.
 * De temps en temps : un dauphin saute, un vol d'oiseaux en V traverse le ciel, le phare balaie la
 * mer de son faisceau.
 * Au toucher : le trois-mâts (il hisse son pavillon et tire une salve… de confettis), la
 * montgolfière (elle lâche un sac de sable, monte d'un coup, le voyageur salue avec sa
 * longue-vue, puis elle redescend), la rose des vents (elle tourne, l'aiguille s'affole puis
 * retrouve le nord).
 */

const CLOUDS = [
  { left: '4%', top: 34, w: 96, flat: true },
  { left: '30%', top: 8, w: 70, flat: false },
  { left: '58%', top: 46, w: 120, flat: true },
  { left: '80%', top: 14, w: 64, flat: false },
];

/** Reflets du soleil sur l'eau, en colonne sous le soleil. */
const GLINTS = scatter(9, 23, (r, i) => ({
  x: `${(392 + r() * 40 - 20 + (i % 2) * 6).toFixed(0)}px`,
  y: `${(3 + i * 3.4).toFixed(1)}px`,
  w: `${(8 + r() * 18 + i * 1.5).toFixed(0)}px`,
  d: `${(1.8 + r() * 1.6).toFixed(2)}s`,
  delay: `${(-r() * 3).toFixed(2)}s`,
}));

/** Petites étincelles éparses sur la mer. */
const SPARKS = scatter(7, 37, (r) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${(14 + r() * 36).toFixed(0)}px`,
  d: `${(3 + r() * 3).toFixed(1)}s`,
  delay: `${(-r() * 6).toFixed(1)}s`,
}));

const CONFETTI_COLORS = ['#C8553D', '#E3B04B', '#1B5E8A', '#3E9C8C', '#FFFFFF', '#E07A9A'];
const PORTS = [34, 52, 70, 88, 106];
const CONFETTI = scatter(26, 61, (r, i) => ({
  x: PORTS[i % 5] + 2 + r() * 3,
  dx: `${Math.round(r() * 84 - 42)}px`,
  dy: `${Math.round(-56 - r() * 50)}px`,
  rot: `${Math.round(r() * 720 - 360)}deg`,
  delay: `${(1.05 + (i % 5) * 0.09 + r() * 0.25).toFixed(2)}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  w: r() > 0.5 ? 4.6 : 3.2,
}));

/** Pointe d'étoile de la rose des vents : un losange en deux moitiés (claire et foncée). */
function point(angle: number, length: number, width: number) {
  const a = (angle * Math.PI) / 180;
  const p = (r: number, da: number) => `${(35 + r * Math.cos(a + da)).toFixed(2)} ${(35 + r * Math.sin(a + da)).toFixed(2)}`;
  const tip = p(length, 0);
  return { light: `M${tip}L${p(width, -Math.PI / 4)}L35 35Z`, dark: `M${tip}L${p(width, Math.PI / 4)}L35 35Z` };
}
const LONG_POINTS = [-90, 0, 90, 180].map((a) => point(a, 29, 6));
const SHORT_POINTS = [-45, 45, 135, 225].map((a) => point(a, 18, 4.5));

function Rose() {
  return (
    <svg viewBox="0 -9 70 79" className="vy-rose" data-tap="boussole" data-tap-ms="3600">
      <circle cx="35" cy="35" r="33" fill="#FFF7E6" stroke="#7A5230" strokeWidth="1.3" />
      <circle cx="35" cy="35" r="27.5" fill="none" stroke="#7A5230" strokeWidth="2.6" strokeDasharray="0.9 3.42" opacity="0.7" />
      <g className="vy-rose__spin">
        {SHORT_POINTS.map((pt, i) => (
          <g key={i}><path d={pt.light} fill="#E7CC97" /><path d={pt.dark} fill="#B48B52" /></g>
        ))}
        {LONG_POINTS.map((pt, i) => (
          <g key={i}><path d={pt.light} fill="#9DBFD6" /><path d={pt.dark} fill="#1B5E8A" /></g>
        ))}
        <text x="35" y="-1.5" textAnchor="middle" className="vy-rose__n">N</text>
      </g>
      <g className="vy-needle">
        <path d="M35 13L37.8 35H32.2Z" fill="#C8553D" />
        <path d="M35 57L37.8 35H32.2Z" fill="#2E3B4A" />
        <circle cx="35" cy="35" r="2.6" fill="#E3B04B" stroke="#7A5230" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function Balloon() {
  return (
    <div className="vy-balloon" data-tap="lest" data-tap-ms="4600">
      <svg viewBox="0 0 60 104">
        <defs>
          <clipPath id="vy-envelope">
            <path d="M30 2C48 2 58 16 58 32C58 48 46 58 38.5 68H21.5C14 58 2 48 2 32C2 16 12 2 30 2Z" />
          </clipPath>
        </defs>
        <g className="vy-balloon__body">
          <g clipPath="url(#vy-envelope)">
            <rect x="0" y="0" width="60" height="70" fill="#C8553D" />
            <path d="M30 2C18 8 14 20 14 32C14 46 22 58 25.5 68H28.5C26 58 24 46 24 32C24 20 27 8 30 2Z" fill="#FFF1D6" />
            <path d="M30 2C33 8 36 20 36 32C36 46 34 58 31.5 68H34.5C38 58 46 46 46 32C46 20 42 8 30 2Z" fill="#FFF1D6" />
            <path d="M0 50C18 55 42 55 60 50V56C42 61 18 61 0 56Z" fill="#1B5E8A" />
            <path d="M44 4C56 12 60 28 56 44C52 56 44 62 38.5 68H60V0Z" fill="#7A2E20" opacity="0.18" />
            <ellipse cx="17" cy="20" rx="4" ry="9" fill="#FFFFFF" opacity="0.28" transform="rotate(18 17 20)" />
          </g>
          <path d="M21.5 68L24 80M38.5 68L36 80M27 68.5L28 80M33 68.5L32 80" stroke="#5A3B22" strokeWidth="0.8" />
          <rect x="22" y="66.5" width="16" height="3" rx="1.2" fill="#2E3B4A" />
          {/* Le voyageur et sa longue-vue */}
          <g className="vy-traveler">
            <circle cx="28" cy="76.6" r="3.1" fill="#E8B48A" />
            <path d="M24.6 75.2C24.8 72.4 31.2 72.4 31.4 75.2Z" fill="#2E3B4A" />
            <path d="M23.4 75.4H32.6" stroke="#2E3B4A" strokeWidth="1.2" strokeLinecap="round" />
            <g className="vy-scope">
              <path d="M29.5 78.4L40.5 75.6L41.2 78.2L30.2 81Z" fill="#C9973A" />
              <path d="M38.6 75.9L41.6 75.1L42.6 78.6L39.5 79.4Z" fill="#8C6538" />
            </g>
          </g>
          <path d="M23 80H37L35.6 92.5H24.4Z" fill="#9A6B3E" />
          <path d="M23.4 83.6H36.6M23.8 87.4H36.2M28 80.4V92M32 80.4V92" stroke="#6E4A27" strokeWidth="0.7" />
          <path d="M22.4 79.2H37.6V81H22.4Z" fill="#6E4A27" />
          <path d="M20.5 81v4.6" stroke="#5A3B22" strokeWidth="0.8" />
          <path d="M18 86.5C18 85 23 85 23 86.5L23.8 91.5C23.8 93.5 17.2 93.5 17.2 91.5Z" fill="#C79A5E" />
          <path d="M18.2 87.4H22.8" stroke="#8C6538" strokeWidth="0.8" />
        </g>
        {/* Sac de sable lâché au toucher : il tombe pendant que le ballon monte */}
        <g className="vy-sandbag">
          <path d="M39.5 81v4.6" stroke="#5A3B22" strokeWidth="0.8" />
          <path d="M37 86.5C37 85 42 85 42 86.5L42.8 91.5C42.8 93.5 36.2 93.5 36.2 91.5Z" fill="#C79A5E" />
          <path d="M37.2 87.4H41.8" stroke="#8C6538" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  );
}

function Ship() {
  return (
    <svg viewBox="-14 0 166 128" className="vy-ship" data-tap="salve" data-tap-ms="3800">
      <g className="vy-ship__all">
        {/* Gréement */}
        <path d="M44 18L-6 80M76 8L44 18M108 26L76 10M108 26L141 80M44 20L16 90M76 10L52 92M108 28L96 86" stroke="#4A2E1C" strokeWidth="0.7" opacity="0.55" fill="none" />
        {/* Mâts et vergues */}
        <path d="M44 92V16M76 92V6M108 84V24" stroke="#4A2E1C" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M-12 83L16 90" stroke="#4A2E1C" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M27 30H61M21 54H67M57 20H95M50 46H102" stroke="#4A2E1C" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M108 30L131 26M108 80L139 79" stroke="#4A2E1C" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M70 41H82V44H70Z" fill="#4A2E1C" />
        {/* Voiles gonflées */}
        <path className="vy-sail" d="M41 23C30 42 15 62 -4 80C10 81 22 80 31 79C34 62 38 42 41 23Z" />
        <path className="vy-sail" d="M28 31H60C63.5 38 64.5 45 64 52C51 55.5 37 55.5 24 52C23.5 45 25 38 28 31Z" />
        <path className="vy-sail" d="M22 55H66C69.5 63 70.5 71 68.5 80C53 84.5 36 84.5 20.5 80C18 71 19 63 22 55Z" />
        <path className="vy-sail" d="M58 21H94C97.5 28 98.5 36 98 44C83 47.5 68 47.5 54 44C53.5 36 55 28 58 21Z" />
        <path className="vy-sail" d="M51 47H101C105 55 106 65 103 76C86 81 66 81 49.5 76C47 65 47.5 55 51 47Z" />
        <path className="vy-sail" d="M110 32L130 28C134 46 136 62 137 77L110 79Z" />
        <path className="vy-sail-shade" d="M50 31H60C63.5 38 64.5 45 64 52C59 53.3 54 54 49 54.2C52 46 52 38 50 31ZM56 55H66C69.5 63 70.5 71 68.5 80C63 81.6 58 82.4 52.5 82.8C57 74 57.6 64 56 55ZM85 21H94C97.5 28 98.5 36 98 44C93 45.3 88 46 83 46.2C86 38 86.6 29 85 21ZM89 47H101C105 55 106 65 103 76C97 77.8 91 79 85 79.4C90 69 91 57 89 47ZM124 29L130 28C134 46 136 62 137 77L126 77.6C127 61 126.6 44 124 29Z" />
        <path d="M24 42C38 45 50 45 63 42M20 67C36 71 52 71 69 67M54 33C68 36 82 36 97 33M48 61C66 65 86 65 104 61" stroke="#D9C29A" strokeWidth="0.7" fill="none" />
        {/* Flamme au sommet du grand mât */}
        <path className="vy-pennant" d="M76 6L98 9.5L76 13Z" fill="#C8553D" />
        {/* Pavillon hissé au toucher */}
        <g className="vy-flag">
          <path d="M108 26H126C124 30 124 34 126 38H108Z" fill="#1B5E8A" />
          <path d="M116 27.5L117.3 30.8L120.8 31L118.1 33.2L119 36.6L116 34.7L113 36.6L113.9 33.2L111.2 31L114.7 30.8Z" fill="#FFF6E2" />
        </g>
        {/* Coque */}
        <path d="M10 90C30 95 100 95 124 89L126 80L142 78L141 92C138 108 126 118 108 118H42C26 117 14 106 10 90Z" fill="#6B4128" />
        <path d="M124 80L142 78L141.5 83L124.5 85Z" fill="#4A2C1A" />
        <path d="M12 96C34 101 100 101 141 95V99C100 105 34 105 13 100Z" fill="#E3B04B" />
        <path d="M22 110C40 113 110 113 136 107C132 114 122 118 108 118H42C33 117.5 27 114.5 22 110Z" fill="#4A2C1A" />
        {PORTS.map((x) => <rect key={x} x={x} y="103.5" width="7" height="4.6" rx="1" fill="#2E1B10" />)}
        <rect x="129" y="84" width="5" height="4" rx="1" fill="#FFD27A" />
        <circle cx="140" cy="76" r="2" fill="#FFD27A" />
        {/* Sillage, derrière la poupe */}
        <path className="vy-wake" d="M136 113C142 112 148 113 152 115M132 116C140 116 148 117 156 120" />
        {/* Écume à la proue */}
        <path className="vy-bowfoam" d="M6 110C12 104 19 104 24 111C18 110 12 111 6 110Z" fill="#FFF8EA" />
        {/* La salve : fumée et confettis */}
        {[37.5, 73.5, 109.5].map((x, i) => (
          <g key={x} className="vy-puff" style={vars({ '--pd': `${0.95 + i * 0.16}s` })}>
            <circle cx={x} cy="108" r="5.4" /><circle cx={x - 5.5} cy="111.5" r="4" /><circle cx={x + 5.5} cy="112" r="3.8" /><circle cx={x + 1} cy="103.5" r="3.4" />
          </g>
        ))}
        {CONFETTI.map((c, i) => (
          <rect
            key={i}
            className="vy-confetto"
            x={c.x}
            y="104"
            width={c.w}
            height={c.w * 1.6}
            fill={c.color}
            style={vars({ '--dx': c.dx, '--dy': c.dy, '--rot': c.rot, '--cd': c.delay })}
          />
        ))}
      </g>
    </svg>
  );
}

/** Palmier de l'île : tronc courbé, couronne de palmes qui se balance. */
function Palm({ x, y, h, lean, className }: { x: number; y: number; h: number; lean: number; className: string }) {
  const tx = x + lean;
  const ty = y - h;
  const mx = x + lean * 0.2;
  return (
    <g>
      <path d={`M${x - 1.6} ${y}Q${mx} ${y - h * 0.5} ${tx - 1} ${ty}H${tx + 1}Q${mx + 2.4} ${y - h * 0.5} ${x + 1.6} ${y}Z`} fill="#8A6A48" />
      <g className={className} style={{ transformOrigin: `${tx}px ${ty}px` }}>
        <path d={`M${tx} ${ty}C${tx - 6} ${ty - 5} ${tx - 13} ${ty - 3} ${tx - 16} ${ty + 4}C${tx - 11} ${ty} ${tx - 6} ${ty} ${tx} ${ty + 1}Z`} fill="#4F6B3A" />
        <path d={`M${tx} ${ty}C${tx + 6} ${ty - 5} ${tx + 13} ${ty - 3} ${tx + 16} ${ty + 4}C${tx + 11} ${ty} ${tx + 6} ${ty} ${tx} ${ty + 1}Z`} fill="#5E7D45" />
        <path d={`M${tx} ${ty}C${tx - 3} ${ty - 7} ${tx - 9} ${ty - 9} ${tx - 13} ${ty - 7}C${tx - 8} ${ty - 6} ${tx - 4} ${ty - 3} ${tx} ${ty}Z`} fill="#6E8E4F" />
        <path d={`M${tx} ${ty}C${tx + 3} ${ty - 7} ${tx + 9} ${ty - 9} ${tx + 13} ${ty - 7}C${tx + 8} ${ty - 6} ${tx + 4} ${ty - 3} ${tx} ${ty}Z`} fill="#4F6B3A" />
        <path d={`M${tx} ${ty + 1}C${tx - 4} ${ty + 4} ${tx - 6} ${ty + 9} ${tx - 6} ${ty + 12}C${tx - 3} ${ty + 8} ${tx - 1} ${ty + 5} ${tx} ${ty + 1}Z`} fill="#5E7D45" />
        <circle cx={tx - 1.2} cy={ty + 1.6} r="1.3" fill="#6B4A2A" /><circle cx={tx + 1.2} cy={ty + 1.8} r="1.3" fill="#6B4A2A" />
      </g>
    </g>
  );
}

function Gull({ className }: { className: string }) {
  return (
    <span className={`vy-gull ${className}`}>
      <svg viewBox="0 0 24 10">
        <path className="vy-gull__wings" d="M1 5C4 1 8 1 12 6C16 1 20 1 23 5C20 3.6 16 4 12 8.4C8 4 4 3.6 1 5Z" />
      </svg>
    </span>
  );
}

export default function VoyageScene() {
  return (
    <>
      <div className="el-layer vy-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer vy-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 2 })}>
        <div className="vy-set"><div className="vy-sun" /></div>
      </div>

      <div className="el-layer vy-clouds" style={vars({ top: '6px', '--k': 0.36, '--kx': 3 })}>
        <div className="vy-drift">
          {[0, 1].map((set) => (
            <div key={set} className="vy-cloudset">
              {CLOUDS.map((c, i) => (
                <span key={i} className={`vy-cloud${c.flat ? ' vy-cloud--flat' : ''}`} style={{ left: c.left, top: c.top, width: c.w }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="el-layer vy-log" style={vars({ top: '0px', '--k': 0.35, '--kx': 2.5 })}>
        <div className="vy-set">
          <svg viewBox="0 0 480 100" width="480" className="vy-route">
            <path d="M128 54C168 30 246 18 300 30S388 46 420 30" fill="none" stroke="#7A5230" strokeWidth="1.8" strokeDasharray="1 6" strokeLinecap="round" opacity="0.75" />
            <path d="M420 25L430 35M430 25L420 35" stroke="#C8553D" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <Rose />
        </div>
      </div>

      <div className="el-layer vy-birds" style={vars({ top: '0px', '--k': 0.4, '--kx': 4 })}>
        <div className="vy-set">
          <Gull className="vy-gull--a" />
          <Gull className="vy-gull--b" />
          <div className="vy-flock">
            {[0, 1, 2, 3, 4].map((i) => <Gull key={i} className={`vy-gull--v vy-gull--v${i}`} />)}
          </div>
        </div>
      </div>

      <div className="el-layer vy-balloonlayer" style={vars({ top: '0px', '--k': 0.42, '--kx': 4.5 })}>
        <div className="vy-set"><Balloon /></div>
      </div>

      <div className="el-layer vy-isle" style={vars({ top: '76px', '--k': 0.46, '--kx': 5 })}>
        <div className="vy-set">
          <svg viewBox="0 0 480 64" width="480">
            <defs>
              <linearGradient id="vy-beam-grad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#FFF0B8" stopOpacity="0.9" />
                <stop offset="1" stopColor="#FFF0B8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Côte lointaine, à peine visible dans la brume dorée */}
            <path d="M262 64C290 58 312 57 336 59C360 55 392 54 420 58C446 56 466 58 480 60V64Z" fill="#DDB99A" />
            {/* Faisceau du phare (de temps en temps) */}
            <g className="vy-beam"><path d="M172 12L330 -8V32Z" fill="url(#vy-beam-grad)" /></g>
            <path d="M34 64C56 46 84 36 114 37C142 38 168 48 196 64Z" fill="#7C8C55" />
            <path d="M114 37C142 38 168 48 196 64H150C146 52 132 42 114 37Z" fill="#66784A" />
            <path d="M58 52C70 46 84 44 96 46C86 48 74 52 66 58Z" fill="#8D9D63" />
            <Palm x={72} y={52} h={22} lean={-5} className="vy-palm vy-palm--a" />
            <Palm x={92} y={46} h={27} lean={3} className="vy-palm vy-palm--b" />
            <Palm x={108} y={44} h={20} lean={6} className="vy-palm vy-palm--c" />
            <path d="M150 64L156 50L164 45H180L186 52L192 64Z" fill="#9A8574" />
            <path d="M172 45H180L186 52L192 64H178C178 56 176 50 172 45Z" fill="#7F6B5C" />
            {/* Le phare */}
            <path d="M166.5 46L168.4 17H175.6L177.5 46Z" fill="#FFF8EC" />
            <path d="M167.4 32.5L167.9 25H176.1L176.6 32.5ZM166.6 45.5L167 39H177L177.4 45.5Z" fill="#C8553D" />
            <path d="M173 17H175.6L177.5 46H175C175 36 174.4 26 173 17Z" fill="#000000" opacity="0.1" />
            <rect x="165.6" y="15" width="12.8" height="2.4" rx="0.8" fill="#2E3B4A" />
            <rect x="168" y="8.6" width="8" height="6.6" fill="#FFE7A0" />
            <path d="M168 8.6H176V15.2H168ZM172 8.6V15.2" fill="none" stroke="#2E3B4A" strokeWidth="1" />
            <path d="M166.8 8.8L172 3.4L177.2 8.8Z" fill="#C8553D" />
            <circle className="vy-lamp" cx="172" cy="11.8" r="5" fill="#FFF3C4" />
            <path d="M28 64C60 58 160 58 204 64Z" fill="#EBCB92" />
          </svg>
        </div>
      </div>

      <div className="el-layer vy-sea" style={vars({ top: '139px', '--k': 0.5, '--kx': 6 })}>
        <div className="vy-water" />
        <div className="vy-ripples" />
        <div className="vy-set">
          {GLINTS.map((g, i) => (
            <span key={i} className="vy-glint" style={vars({ '--x': g.x, '--y': g.y, '--w': g.w, '--d': g.d, '--delay': g.delay })} />
          ))}
        </div>
        {SPARKS.map((s, i) => (
          <span key={i} className="vy-spark" style={vars({ '--x': s.x, '--y': s.y, '--d': s.d, '--delay': s.delay })} />
        ))}
      </div>

      <div className="el-layer vy-shiplayer" style={vars({ top: '50px', '--k': 0.56, '--kx': 8 })}>
        <div className="vy-set">
          <div className="vy-dolphin">
            <svg viewBox="0 0 44 22">
              <path d="M30 6C33 2 36 1 38 1C36 3 35.6 5 36 8Z" fill="#4C6E82" />
              <path d="M2 13C8 7 18 5 28 6.4C33 7 37 6.6 41 4.4C40 8 38 10.6 35 11.6C38 13.4 40.4 16.2 41.6 19C37.6 18 34 16 31 13.8C24 15.6 14 16.4 7 14.6L1.6 14.4Z" fill="#5C7F92" />
              <path d="M7 14.6C14 16.4 24 15.6 31 13.8C24 13.6 14 13.2 6 12.6Z" fill="#C9DCE3" />
              <path d="M18 14C17 17 15 19 12.4 19.6C14 17.6 14.6 15.6 14.6 14Z" fill="#4C6E82" />
              <circle cx="8" cy="10.8" r="0.9" fill="#1F2B38" />
            </svg>
          </div>
          <span className="vy-splash vy-splash--in" />
          <span className="vy-splash vy-splash--out" />
          <Ship />
        </div>
      </div>

      <div className="el-layer vy-waves" style={vars({ top: '160px', '--k': 0.64, '--kx': 10 })}>
        <div className="vy-swell" />
      </div>

      <div className="el-layer vy-beach" style={vars({ top: '198px', '--k': 0.82, '--kx': 13 })}>
        <div className="vy-foam" />
        <div className="vy-set">
          <svg viewBox="0 0 24 24" className="vy-star">
            <path d="M12 1.5L14.6 8.6L22.4 8.9L16.2 13.6L18.4 21.2L12 16.8L5.6 21.2L7.8 13.6L1.6 8.9L9.4 8.6Z" fill="#E07A4F" />
            <path d="M12 5L13.4 9.8L18.6 10L14.4 13.2L15.9 18.1L12 15.2L8.1 18.1L9.6 13.2L5.4 10L10.6 9.8Z" fill="#EE9A6A" />
          </svg>
          <svg viewBox="0 0 22 14" className="vy-shell">
            <path d="M11 13C5 13 1 9 2 5C4 2 8 1 11 1C14 1 18 2 20 5C21 9 17 13 11 13Z" fill="#F6D6C2" />
            <path d="M11 13L6 2.4M11 13L11 1M11 13L16 2.4M11 13L3 6M11 13L19 6" stroke="#D9A88E" strokeWidth="0.9" />
          </svg>
          <div className="vy-crab">
            <svg viewBox="0 0 30 18">
              <path className="vy-crab__legs" d="M8 11L3 13L1 16M8 12.6L4 15.4L3 17.6M22 11L27 13L29 16M22 12.6L26 15.4L27 17.6" stroke="#B5432C" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path className="vy-crab__claw vy-crab__claw--l" d="M8 8L4 4.6M4 4.6C1.6 4.2 0.8 1.6 2.4 0.6C3 2 4.4 2.4 5.6 2C5.8 3.4 5.2 4.4 4 4.6Z" stroke="#C9503A" strokeWidth="1.4" fill="#D2553A" strokeLinecap="round" />
              <path className="vy-crab__claw vy-crab__claw--r" d="M22 8L26 4.6M26 4.6C28.4 4.2 29.2 1.6 27.6 0.6C27 2 25.6 2.4 24.4 2C24.2 3.4 24.8 4.4 26 4.6Z" stroke="#C9503A" strokeWidth="1.4" fill="#D2553A" strokeLinecap="round" />
              <ellipse cx="15" cy="10.6" rx="8.4" ry="5.2" fill="#D2553A" />
              <path d="M8 11.4C11 13.6 19 13.6 22 11.4C21 15 9 15 8 11.4Z" fill="#B5432C" />
              <path d="M12.4 6.2V3.4M17.6 6.2V3.4" stroke="#B5432C" strokeWidth="1" />
              <circle cx="12.4" cy="3" r="1.4" fill="#FFFFFF" /><circle cx="17.6" cy="3" r="1.4" fill="#FFFFFF" />
              <circle cx="12.6" cy="3.1" r="0.7" fill="#1F2B38" /><circle cx="17.8" cy="3.1" r="0.7" fill="#1F2B38" />
            </svg>
          </div>
          <svg viewBox="0 0 40 16" className="vy-bottle">
            <path d="M4 5.4C4 3.6 5.6 2.4 7.6 2.4H22C25 2.4 26.6 4 28.6 4.8H33.6V11.2H28.6C26.6 12 25 13.6 22 13.6H7.6C5.6 13.6 4 12.4 4 10.6Z" fill="#6FA98F" opacity="0.92" />
            <path d="M8 6C11 5 18 5 23 6.2C23.4 8 23.4 9 23 10C18 11.2 11 11.2 8 10.2C7.6 8.8 7.6 7.4 8 6Z" fill="#FFF4DC" />
            <path d="M8 8H23" stroke="#C9A46A" strokeWidth="0.8" />
            <path d="M33.6 4.6H37.6C38.4 4.6 38.8 5.4 38.8 8C38.8 10.6 38.4 11.4 37.6 11.4H33.6Z" fill="#B48B52" />
            <path d="M7 4.2H21" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>
      </div>
    </>
  );
}
