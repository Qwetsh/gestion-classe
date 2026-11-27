import { vars } from '../shared';
import './theme.css';

/**
 * Thème « Sismographe » : une coupe du sol et l'appareil qui enregistre ses secousses.
 * Plans, du fond vers l'avant : papier millimétré, coupe du sol (deux blocs séparés par une faille,
 * le village sur le bloc de gauche, la station sur celui de droite, le foyer sur la faille),
 * bande de papier de l'enregistreur et son stylet.
 * Mouvement, sans que l'élève touche à rien : le papier défile et le stylet y trace les petites
 * vibrations du sol (le tracé passe exactement sous la pointe), une onde pâle part du foyer de
 * temps en temps, la cheminée fume, les arbres bougent, le voyant de l'appareil clignote.
 * Au toucher : le sol (un séisme : le bloc de gauche glisse d'un coup le long de la faille, les
 * ondes partent du foyer, le village tremble, le stylet s'affole et trace un grand train d'ondes
 * qui s'amortit), l'église (la cloche sonne, les oiseaux s'envolent).
 */

// Hauteur du tracé au repos, un point tous les 12 px ; le papier avance de 40 px par seconde, donc
// d'un point toutes les 0,3 s. Le stylet suit les mêmes valeurs (`se-pen` dans theme.css) : les deux
// listes doivent rester identiques.
const IDLE = [0, -2, 1, -1, 3, -4, 2, 0, -1, 1, -2, 5, -6, 3, -1, 0, 2, -2, 1, 0];
// Le train d'ondes d'un séisme, un point tous les 4 px (0,1 s) ; même règle avec `se-quake-pen`.
const BURST = [0, -3, 5, -4, 9, -7, 13, -10, 21, -27, 25, -29, 23, -27, 19, -23, 16, -19, 13, -15, 10, -12, 8, -9, 6, -7, 5, -4, 2, -1, 0];

const idlePath = Array.from({ length: 5 * IDLE.length + 1 }, (_, i) => `${i === 0 ? 'M' : 'L'}${i * 12} ${IDLE[i % IDLE.length] ?? 0}`).join('');
const burstPath = BURST.map((y, i) => `${i === 0 ? 'M' : 'L'}${i * 4} ${y}`).join('');

const INK = '#20242B';

export default function SeismeScene() {
  return (
    <>
      <div className="el-layer se-paper" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer se-ground" style={vars({ top: '0px', '--k': 0.55, '--kx': 7 })}>
        <div className="se-bedrock" />
        <div className="se-set">
          <svg viewBox="0 0 480 240" width="480">
            {/* Bloc de droite : déjà descendu de quelques pixels, d'où la petite marche en surface */}
            <g className="se-block se-block--right">
              <path d="M325.100 70H880V94H305.500Z" fill="#E9D9B4" />
              <path d="M305.500 94H880V118H285.900Z" fill="#D9C49A" />
              <path d="M285.900 118H880V140H268Z" fill="#C9B286" />
              <path d="M300 106H880M282 130H880" stroke="#B39C6C" strokeWidth="1" strokeDasharray="10 7" fill="none" />
              <path d="M325.100 70H880" stroke={INK} strokeWidth="1.600" fill="none" />
              {/* La station : un abri, une antenne, le câble qui descend à l'enregistreur */}
              <path d="M388 70V150" stroke={INK} strokeWidth="1" strokeDasharray="3 3" fill="none" />
              <rect x="376" y="56" width="22" height="14" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
              <path d="M373 56H401M394 56V40M389 44H399M391 48H397" stroke={INK} strokeWidth="1.400" fill="none" strokeLinecap="round" />
            </g>
            {/* Bloc de gauche : il porte le village et glisse au séisme */}
            <g className="se-block se-block--left" data-tap="seisme" data-tap-ms="6000">
              <rect x="60" y="26" width="270" height="114" fill="transparent" />
              <path d="M-400 64H330L310.400 88H-400Z" fill="#E9D9B4" />
              <path d="M-400 88H310.400L290.800 112H-400Z" fill="#D9C49A" />
              <path d="M-400 112H290.800L268 140H-400Z" fill="#C9B286" />
              <path d="M-400 100H298M-400 126H276" stroke="#B39C6C" strokeWidth="1" strokeDasharray="10 7" fill="none" />
              <path d="M-400 64H330" stroke={INK} strokeWidth="1.600" fill="none" />
              <g className="se-village">
                {/* Arbres */}
                <g className="se-tree"><path d="M80 64V52" stroke={INK} strokeWidth="1.600" /><circle cx="80" cy="46" r="9" fill="#9CC59A" stroke={INK} strokeWidth="1.400" /></g>
                <g className="se-tree se-tree--b"><path d="M258 64V54" stroke={INK} strokeWidth="1.600" /><circle cx="258" cy="49" r="7.500" fill="#9CC59A" stroke={INK} strokeWidth="1.400" /></g>
                {/* Maisons */}
                <g className="se-house">
                  <circle className="se-smoke" cx="141" cy="30" r="3" /><circle className="se-smoke se-smoke--b" cx="141" cy="30" r="3" />
                  <path d="M138 44V32H144V40" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
                  <rect x="118" y="44" width="26" height="20" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
                  <path d="M114 44L131 31L148 44Z" fill="#D9534A" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
                  <path d="M128 64V54H134V64M122 49H126V53H122Z" fill="#C9D8E6" stroke={INK} strokeWidth="1.100" />
                </g>
                <g className="se-house se-house--b">
                  <rect x="158" y="48" width="20" height="16" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
                  <path d="M155 48L168 38L181 48Z" fill="#7A8A99" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
                  <path d="M165 64V56H171V64" fill="#C9D8E6" stroke={INK} strokeWidth="1.100" />
                </g>
                {/* Église */}
                <g className="se-church" data-tap="cloche" data-tap-ms="3200">
                  <rect x="196" y="2" width="36" height="62" fill="transparent" />
                  <rect x="200" y="42" width="28" height="22" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
                  <rect x="208" y="24" width="12" height="18" fill="#FFFDF8" stroke={INK} strokeWidth="1.400" />
                  <path d="M205.500 24L214 7L222.500 24Z" fill="#7A8A99" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
                  <rect x="211" y="28" width="6" height="9" fill={INK} />
                  <g className="se-bell"><path d="M214 29.500C216.500 29.500 216.200 33.500 217 35H211C211.800 33.500 211.500 29.500 214 29.500Z" fill="#F2C230" /></g>
                  <path d="M211 64V54Q214 50 217 54V64" fill="#C9D8E6" stroke={INK} strokeWidth="1.100" />
                  <g className="se-chimes">
                    <path d="M224 28Q229 32 224 36M228 24Q236 32 228 40" /><path d="M204 28Q199 32 204 36M200 24Q192 32 200 40" />
                  </g>
                  <path className="se-bird" d="M202 40l3 -2l3 2" /><path className="se-bird se-bird--b" d="M221 40l3 -2l3 2" />
                </g>
              </g>
              {/* Épicentre : à la verticale du foyer */}
              <path d="M294 106V68" stroke="#C2261D" strokeWidth="1.200" strokeDasharray="3 3" fill="none" />
              <path d="M294 66L289.500 58H298.500Z" fill="#C2261D" />
              <text className="se-label" x="302" y="60">épicentre</text>
              <text className="se-label" x="226" y="131">faille</text>
            </g>
            {/* La faille, le foyer et ses ondes */}
            <path d="M330 64L268 140" stroke={INK} strokeWidth="2.200" fill="none" />
            <clipPath id="se-underground"><rect x="-400" y="66" width="1280" height="76" /></clipPath>
            <g clipPath="url(#se-underground)">
              <g transform="translate(294 108)">
                <circle className="se-ring se-ring--idle" r="10" />
                <circle className="se-ring se-ring--a" r="10" /><circle className="se-ring se-ring--b" r="10" /><circle className="se-ring se-ring--c" r="10" />
              </g>
            </g>
            <g transform="translate(294 108)">
              <path className="se-focus" d="M0 -8L2.300 -2.600L8 -2.600L3.400 1L5 6.800L0 3.400L-5 6.800L-3.400 1L-8 -2.600L-2.300 -2.600Z" />
            </g>
            <text className="se-label" x="306" y="112">foyer</text>
          </svg>
        </div>
      </div>

      <div className="el-layer se-recorder" style={vars({ top: '0px', '--k': 0.82, '--kx': 13 })}>
        <div className="se-under" />
        <div className="se-strip" />
        <div className="se-set">
          {/* Le tracé n'est visible qu'à gauche de la pointe du stylet */}
          <div className="se-clip">
            <svg className="se-trace" viewBox="0 -32 1200 64" width="1200" height="64"><path d={idlePath} /></svg>
            <svg className="se-burst" viewBox="0 -32 124 64" width="124" height="64"><path d={burstPath} /></svg>
          </div>
          <svg viewBox="0 0 480 240" width="480">
            <rect x="404" y="146" width="72" height="72" rx="6" fill="#2B3038" />
            <circle className="se-led" cx="416" cy="158" r="3" />
            <circle cx="446" cy="184" r="14" fill="none" stroke="#8E96A3" strokeWidth="1.600" /><path d="M446 184L453 175" stroke="#F5F1E8" strokeWidth="1.800" strokeLinecap="round" />
            <rect x="398" y="150" width="4" height="64" fill={INK} />
            <g className="se-pen">
              <g className="se-pen__quake">
                <path d="M389 182L396 177.500H408V186.500H396Z" fill={INK} />
                <circle cx="388" cy="182" r="2.200" fill="#C2261D" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
