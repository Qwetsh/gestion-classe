import { vars } from '../shared';
import { Rider } from './Rider';
import './theme.css';

/**
 * Thème « Skatepark » : une rampe en bois devant un mur de graffs, un après-midi de beau temps.
 * Plans, du fond vers l'avant : ciel, soleil et nuages, immeubles lointains, arbres et cerf-volant,
 * mur peint, rampe avec le skateur, le copain sur la plateforme, le sol.
 * Mouvement, sans que l'élève touche à rien : le skateur va et vient dans la rampe (une vraie
 * physique, voir Rider.tsx), décolle à chaque bord et retombe ; le cerf-volant se balance, les
 * nuages passent, le fanion claque, les arbres bougent, les pigeons picorent sur le mur.
 * Au toucher : le skateur ou la rampe (il prend de l'élan, sort plus haut et fait un tour complet
 * en l'air, le copain applaudit), le mur (une bombe de peinture s'agite puis trace un graff d'un
 * seul trait, la peinture coule, les pigeons s'envolent et reviennent).
 */

const INK = '#1B1D2A';

/** Une étoile à pointes arrondies : `n` pointes, rayons extérieur et intérieur. */
function burst(cx: number, cy: number, outer: number, inner: number, n: number): string {
  return `${Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join('')}Z`;
}

/** Le graff tracé au toucher : une étoile d'un seul trait, puis une boucle qui la souligne. Même tracé dans theme.css (`sk-can`). */
const TAG = 'M240 98L257.600 152.300L211.500 118.700L268.500 118.700L222.400 152.300L240 98C206 94 190 146 208 164Q240 178 284 160';

function Pigeon({ x, delay }: { x: number; delay: string }) {
  return (
    <g transform={`translate(${x} 80)`}>
      <g className="sk-pigeon" style={vars({ '--delay': delay })}>
        <path d="M-3 0V-2.500M1 0V-2.500" stroke="#D9675A" strokeWidth="1" />
        <path d="M-6 -5.500L-11 -3L-6 -3.500Z" fill="#6E7688" />
        <ellipse cx="0" cy="-5.500" rx="6" ry="4" fill="#8D95A6" />
        <path className="sk-pigeon__wing" d="M-4.500 -6.500Q-1 -9.500 3 -6Q-1 -2.500 -4.500 -6.500Z" fill="#6E7688" />
        <g className="sk-pigeon__head">
          <circle cx="5" cy="-9.500" r="2.700" fill="#8D95A6" />
          <path d="M7.300 -10L10 -9.200L7.300 -8.600Z" fill="#F2A03D" />
          <circle cx="5.700" cy="-10" r="0.600" fill={INK} />
        </g>
      </g>
    </g>
  );
}

export default function SkateScene() {
  return (
    <>
      <div className="el-layer sk-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        <div className="el-stage"><span className="sk-sun" /></div>
        <span className="sk-cloud" style={vars({ top: '12px', '--d': '74s', '--delay': '-20s', '--s': 1 })} />
        <span className="sk-cloud" style={vars({ top: '40px', '--d': '96s', '--delay': '-62s', '--s': 0.72 })} />
        <span className="sk-cloud" style={vars({ top: '26px', '--d': '118s', '--delay': '-101s', '--s': 0.56 })} />
      </div>

      <div className="el-layer sk-city" style={vars({ top: '0px', '--k': 0.4, '--kx': 4 })}>
        <div className="sk-skyline" />
        <div className="sk-set">
          <svg viewBox="0 0 480 250" width="480">
            {/* Arbres derrière le mur */}
            <g className="sk-tree"><circle cx="58" cy="72" r="17" fill="#57A877" /><circle cx="80" cy="66" r="13" fill="#6DBE8A" /><circle cx="66" cy="60" r="10" fill="#6DBE8A" /></g>
            <g className="sk-tree sk-tree--b"><circle cx="414" cy="70" r="16" fill="#57A877" /><circle cx="434" cy="74" r="13" fill="#6DBE8A" /><circle cx="424" cy="60" r="9" fill="#6DBE8A" /></g>
            {/* Le cerf-volant, tenu par quelqu'un derrière le mur */}
            <g className="sk-kite">
              <path d="M372 40Q350 96 336 150" fill="none" stroke="#6C7488" strokeWidth="0.800" />
              <path d="M372 58Q366 66 371 73Q376 80 369 88" fill="none" stroke="#6C7488" strokeWidth="0.900" />
              <path className="sk-kite__bow" d="M364 64L372 67L364 70ZM372 67L380 64V70Z" fill="#19B5C8" style={vars({ '--delay': '0s' })} />
              <path className="sk-kite__bow" d="M366 78L373 80.500L366 83ZM373 80.500L380 78V83Z" fill="#FFC93C" style={vars({ '--delay': '-0.4s' })} />
              <path d="M372 18L386 36L372 58L358 36Z" fill="#E0218A" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
              <path d="M372 18L386 36L372 36Z" fill="#FFC93C" /><path d="M372 36L372 58L358 36Z" fill="#19B5C8" />
              <path d="M372 18V58M358 36H386M372 18L386 36L372 58L358 36Z" fill="none" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer sk-wall" style={vars({ top: '0px', '--k': 0.5, '--kx': 8 })}>
        <div className="sk-bricks" />
        <div className="sk-set">
          <svg viewBox="0 0 480 250" width="480">
            {/* Graffs de gauche : une flèche, une étoile, des pois */}
            <path d="M116 160V140Q118 118 142 114V103L168 122L142 141V130Q132 132 132 142V160Z" fill="#19B5C8" stroke={INK} strokeWidth="2.200" strokeLinejoin="round" />
            <path d="M121.500 144Q122 126 138 120.500" fill="none" stroke="#FFFFFF" strokeWidth="1.800" strokeLinecap="round" strokeOpacity="0.850" />
            <path d="M120 161V169M127 161V165" fill="none" stroke="#19B5C8" strokeWidth="3.200" strokeLinecap="round" />
            <path d={burst(176, 100, 14, 7, 8)} fill="#FFC93C" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <circle cx="178" cy="142" r="5" fill="#E0218A" stroke={INK} strokeWidth="1.600" /><circle cx="187" cy="156" r="3" fill="#9BD63A" stroke={INK} strokeWidth="1.400" />
            {/* Graffs de droite : un éclair, une vague, un bonhomme soleil */}
            <path d="M332 90L306 130H322L310 166L350 120H331L346 90Z" fill="#E0218A" stroke={INK} strokeWidth="2.200" strokeLinejoin="round" />
            <path d="M330.500 95L314 124" fill="none" stroke="#FFFFFF" strokeWidth="1.800" strokeLinecap="round" strokeOpacity="0.850" />
            <path d="M294 100q5 -9 10 0t10 0" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" /><path d="M294 100q5 -9 10 0t10 0" fill="none" stroke="#9BD63A" strokeWidth="3" strokeLinecap="round" />
            <circle cx="352" cy="148" r="12" fill="#FFC93C" stroke={INK} strokeWidth="2" />
            <path d="M347.500 145V148M356.500 145V148M346.500 152.500Q352 157.500 357.500 152.500" fill="none" stroke={INK} strokeWidth="1.800" strokeLinecap="round" />
            <circle cx="366" cy="96" r="4" fill="#19B5C8" stroke={INK} strokeWidth="1.400" />
            {/* Le graff tracé au toucher */}
            <g data-tap="graff" data-tap-ms="5200">
              <rect x="150" y="84" width="180" height="96" fill="transparent" />
              <g className="sk-tag">
                <path className="sk-tag__out sk-tag__main" d={TAG} pathLength="1" /><path className="sk-tag__in sk-tag__main" d={TAG} pathLength="1" />
                <path className="sk-tag__out sk-tag__drip" d="M226 173V187" pathLength="1" /><path className="sk-tag__in sk-tag__drip" d="M226 173V187" pathLength="1" />
                <path className="sk-tag__out sk-tag__drip sk-tag__drip--b" d="M264 169V178" pathLength="1" /><path className="sk-tag__in sk-tag__drip sk-tag__drip--b" d="M264 169V178" pathLength="1" />
              </g>
            </g>
            <Pigeon x={228} delay="0s" /><Pigeon x={250} delay="-1.7s" />
          </svg>
          <span className="sk-can">
            <svg viewBox="0 0 20 34" width="20" height="34">
              <circle className="sk-can__mist" cx="0" cy="5" r="6" />
              <rect x="3" y="4" width="4" height="2.400" fill="#F4F1E8" stroke={INK} strokeWidth="0.800" />
              <rect x="6" y="2" width="9" height="6.500" rx="1.500" fill="#2B3350" />
              <rect x="4" y="8" width="13" height="24" rx="2.500" fill="#19B5C8" stroke={INK} strokeWidth="1.400" />
              <rect x="4.700" y="15" width="11.600" height="8" fill="#FFC93C" />
            </svg>
          </span>
        </div>
      </div>

      <div className="el-layer sk-park" style={vars({ top: '0px', '--k': 0.82, '--kx': 13 })}>
        <div className="sk-floor" />
        <div className="sk-set">
          <svg viewBox="0 0 480 250" width="480">
            {/* La rampe, vue de côté : deux flancs en bois, le plat, les plateformes */}
            <g data-tap="figure" data-tap-ms="5000">
              <path d="M58 132H106A70 70 0 0 0 176 202V208H58Z" fill="#E7C08A" stroke={INK} strokeWidth="1.600" strokeLinejoin="round" />
              <path d="M422 132H374A70 70 0 0 1 304 202V208H422Z" fill="#E7C08A" stroke={INK} strokeWidth="1.600" strokeLinejoin="round" />
              <path d="M72 133V207M90 133V207M63 206L104 140M408 133V207M390 133V207M417 206L376 140" fill="none" stroke="#C99E63" strokeWidth="1.600" />
            </g>
            <rect x="176" y="202" width="128" height="6" fill="#D7AC72" stroke={INK} strokeWidth="1.600" />
            <path d="M56 132H106A70 70 0 0 0 176 202H304A70 70 0 0 0 374 132H424" fill="none" stroke="#3A3F52" strokeWidth="3.200" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="106" cy="132" r="3" fill="#C9CED9" stroke={INK} strokeWidth="1.200" /><circle cx="374" cy="132" r="3" fill="#C9CED9" stroke={INK} strokeWidth="1.200" />
            {/* Plateforme de gauche : le fanion, le copain et sa planche */}
            <path d="M61 131V94" stroke="#3A3F52" strokeWidth="2" strokeLinecap="round" />
            <path className="sk-flag" d="M61 95L78 100L61 106Z" fill="#E0218A" stroke={INK} strokeWidth="1.200" strokeLinejoin="round" />
            <g transform="translate(86 130.400)">
              <g className="sk-friend">
                <path d="M9.500 0V-25" stroke={INK} strokeWidth="4.400" strokeLinecap="round" /><path d="M9.500 0V-25" stroke="#9BD63A" strokeWidth="2.400" strokeLinecap="round" />
                <circle cx="12.400" cy="-5" r="2.200" fill="#F4F1E8" stroke={INK} strokeWidth="1" /><circle cx="12.400" cy="-20" r="2.200" fill="#F4F1E8" stroke={INK} strokeWidth="1" />
                <path d="M-3 0V-12M3 0V-12" stroke="#2B3350" strokeWidth="4.400" strokeLinecap="round" />
                <path d="M0 -13V-23" stroke="#19B5C8" strokeWidth="9" strokeLinecap="round" />
                <path className="sk-friend__down" d="M-4 -23L-7.500 -13M4 -23L8 -15" fill="none" stroke="#19B5C8" strokeWidth="3.600" strokeLinecap="round" />
                <path className="sk-friend__up" d="M-4 -24L-10 -35M4 -24L10 -35" fill="none" stroke="#19B5C8" strokeWidth="3.600" strokeLinecap="round" />
                <circle cx="0" cy="-30.500" r="4.800" fill="#C98D5E" />
                <path d="M-5.200 -31.500A5.200 5.200 0 0 1 5.200 -31.500H9.500V-30H-5.200Z" fill="#E0218A" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
              </g>
            </g>
            {/* Plateforme de droite : un sac et une gourde */}
            <rect x="392" y="115" width="15" height="16" rx="4" fill="#7A4EC2" stroke={INK} strokeWidth="1.400" /><path d="M395 124H404M396 115Q399.500 109 403 115" fill="none" stroke={INK} strokeWidth="1.300" />
            <rect x="411" y="120" width="5" height="11" rx="1.500" fill="#19B5C8" stroke={INK} strokeWidth="1.100" /><rect x="412" y="117.500" width="3" height="3" fill="#2B3350" />
            {/* Au sol : un cône, une planche posée, quelques herbes */}
            <path d="M181 224L188 206L195 224Z" fill="#F2702C" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" /><path d="M184.300 215.500H191.700" stroke="#FFFFFF" strokeWidth="2.400" /><rect x="177" y="223" width="22" height="3.600" rx="1.400" fill="#F2702C" stroke={INK} strokeWidth="1.200" />
            <path d="M318 220Q321 222.500 324 222.500H344Q347 222.500 350 220" fill="none" stroke={INK} strokeWidth="4.200" strokeLinecap="round" /><path d="M318 220Q321 222.500 324 222.500H344Q347 222.500 350 220" fill="none" stroke="#FFC93C" strokeWidth="2.200" strokeLinecap="round" />
            <circle cx="325" cy="226" r="2.600" fill="#F4F1E8" stroke={INK} strokeWidth="1" /><circle cx="343" cy="226" r="2.600" fill="#F4F1E8" stroke={INK} strokeWidth="1" />
            <path className="sk-weed" d="M64 208Q62 200 59 198M64 208Q65 199 68 196M64 208V199" /><path className="sk-weed" d="M418 208Q416 201 413 199M418 208Q420 200 423 198" /><path className="sk-weed" d="M246 208Q244 203 242 202M246 208Q248 203 250 202" />
            <Rider />
          </svg>
        </div>
      </div>
    </>
  );
}
