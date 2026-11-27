import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Sommets » : un matin de grand beau en montagne.
 * Plans, du fond vers l'avant : ciel, crêtes lointaines, grand sommet et son téléphérique, aigle,
 * piste enneigée avec ses sapins, son tremplin et ses skieurs, flocons.
 * Mouvement, sans que l'élève touche à rien : la cabine du téléphérique monte et redescend le long
 * de son câble en se balançant, l'aigle plane en cercles, un skieur descend la piste en godille,
 * quelques flocons tombent.
 * Au toucher : le tremplin (un skieur s'élance du haut de la piste, décolle, fait un salto arrière
 * et se réceptionne), la cabine (elle se balance comme un pendule).
 */

const FLAKES = scatter(14, 71, (r) => ({
  x: `${(r() * 104 - 2).toFixed(1)}%`,
  s: `${(r() * 4 + 3).toFixed(1)}px`,
  d: `${(r() * 9 + 10).toFixed(1)}s`,
  delay: `${(-r() * 19).toFixed(1)}s`,
  dx: `${Math.round(r() * 80 - 40)}px`,
}));

function Fir({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-2 0V8H2V0Z" fill="#5A3E2B" />
      <path d="M0 -40L11 -22H6L14 -8H-14L-6 -22H-11Z" fill="#1F5A47" />
      <path d="M0 -40L6 -30L1 -32L-5 -29ZM-11 -22L-3 -22L-8 -17ZM6 -22L11 -22L9 -18Z" fill="#FFFFFF" />
    </g>
  );
}

/** Un skieur de profil, tourné vers la gauche, en position de descente. */
function Skier({ className, jacket }: { className: string; jacket: string }) {
  return (
    <g className={className}>
      <g className="so-skier__pose">
        <path d="M-13 9H12" stroke="#14243A" strokeWidth="2.200" strokeLinecap="round" fill="none" />
        <path d="M-3 8L-1 1L4 -2L8 8" stroke="#14243A" strokeWidth="3.200" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M3 -3L-3 -11" stroke={jacket} strokeWidth="5.600" strokeLinecap="round" fill="none" />
        <path d="M-2 -9L-9 -3L-12 5" stroke="#14243A" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="-5" cy="-15" r="3.600" fill={jacket} /><path d="M-8.400 -15.500H-5" stroke="#14243A" strokeWidth="1.600" />
      </g>
    </g>
  );
}

export default function SommetsScene() {
  return (
    <>
      <div className="el-layer so-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer so-range" style={vars({ top: '74px', '--k': 0.42, '--kx': 4 })} />

      <div className="el-layer so-peak" style={vars({ top: '-6px', '--k': 0.55, '--kx': 7 })}>
        <div className="so-set">
          <svg viewBox="0 0 480 200" width="480">
            <path d="M210 200L300 70L330 44L352 20L378 52L410 60L500 200Z" fill="#8FA9C8" />
            <path d="M352 20L378 52L410 60L500 200H400L372 110Z" fill="#6C8AB0" />
            <path d="M300 70L330 44L352 20L378 52L410 60L396 82L378 70L360 92L344 66L322 88Z" fill="#FFFFFF" />
            <path d="M352 20L378 52L410 60L396 82L378 70L366 50Z" fill="#DCE9F6" />
            {/* Téléphérique : deux pylônes, un câble, une cabine qui fait la navette */}
            <path d="M96 176V132M90 132H102M404 96V54M398 54H410" stroke="#3B4E66" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M-10 150L96 132L404 54L490 34" stroke="#3B4E66" strokeWidth="1.400" fill="none" />
            <g className="so-cabin" data-tap="cabine" data-tap-ms="3600">
              <g className="so-cabin__swing">
                <rect x="-18" y="6" width="36" height="30" fill="transparent" />
                <path d="M0 0V12" stroke="#3B4E66" strokeWidth="1.800" />
                <rect x="-13" y="12" width="26" height="20" rx="5" fill="#C2410C" />
                <rect x="-10" y="15" width="8.500" height="8" rx="1.500" fill="#DFF0FF" /><rect x="1.500" y="15" width="8.500" height="8" rx="1.500" fill="#DFF0FF" />
                <path d="M-13 26H13" stroke="#9A3209" strokeWidth="1.600" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer so-skylife" style={vars({ top: '14px', '--k': 0.36, '--kx': 5 })}>
        <div className="el-stage">
          <svg viewBox="0 0 60 20" className="so-eagle">
            <path d="M0 8Q14 0 26 9L30 12L34 9Q46 0 60 8Q46 6 34 13L30 17L26 13Q14 6 0 8Z" />
          </svg>
        </div>
      </div>

      <div className="el-layer so-slope" style={vars({ top: '0px', '--k': 0.8, '--kx': 13 })}>
        <div className="so-snow" />
        <div className="so-set">
          <svg viewBox="0 0 480 240" width="480">
            <path d="M-20 240V206C60 196 150 176 240 150C330 124 420 100 500 86V240Z" fill="#FFFFFF" />
            <path d="M-20 222C70 212 160 194 250 168C340 142 420 120 500 106" fill="none" stroke="#DCE9F6" strokeWidth="2" />
            <path d="M-20 236C80 228 170 212 260 188C350 164 430 142 500 128" fill="none" stroke="#E7F0F9" strokeWidth="2" />
            <Fir x={54} y={200} s={1.1} /><Fir x={98} y={190} s={0.8} /><Fir x={396} y={108} s={0.9} /><Fir x={438} y={98} s={1.15} /><Fir x={146} y={176} s={0.7} />
            {/* Le tremplin */}
            <g data-tap="saut" data-tap-ms="3800">
              <rect x="206" y="126" width="100" height="54" fill="transparent" />
              <path d="M232 152L266 132L272 146Z" fill="#FFFFFF" stroke="#C9DCEE" strokeWidth="1.600" strokeLinejoin="round" />
              <path d="M264 133L266 124M266 124L274 127L266 129" stroke="#C2410C" strokeWidth="1.600" fill="#C2410C" strokeLinejoin="round" />
            </g>
            <Skier className="so-skier so-skier--cruise" jacket="#1F6FD0" />
            <Skier className="so-skier so-skier--jumper" jacket="#C2410C" />
          </svg>
        </div>
      </div>

      <div className="so-flakes">
        {FLAKES.map((f, i) => (
          <span key={i} className="so-flake" style={vars({ '--x': f.x, '--s': f.s, '--d': f.d, '--delay': f.delay, '--dx': f.dx })} />
        ))}
      </div>
    </>
  );
}
