import type { CSSProperties, ReactNode } from 'react';
import { vars } from '../shared';
import './theme.css';

/**
 * Thème « Héros et monstres » : une frise de vase grec, en aplats couleur terre cuite.
 * Plans, du fond vers l'avant : ciel ocre et soleil en rosace, nuages à volutes, îles au loin, mer
 * Égée (une trière aux rames qui battent, l'Hydre aux têtes qui ondulent, un dauphin), la côte (à
 * gauche la falaise du Cyclope avec ses moutons, à droite le promontoire, un temple et un olivier),
 * Pégase dans le ciel, et pour finir le rivage bordé d'une frise de grecques, comme le bas d'un vase.
 * Mouvement, sans que l'élève touche à rien : les nuages passent, la rosace du soleil tourne, la mer
 * ondule, la trière tangue et ses rameurs rament, le fanion flotte, les têtes de l'Hydre se
 * balancent, le Cyclope cligne de son œil unique et suit la trière du regard, un mouton broute,
 * l'agneau sautille, l'olivier frémit, Pégase bat des ailes. De temps en temps : une troisième tête
 * de l'Hydre sort de l'eau devant la proue pour faire coucou (toutes les 17 s), un dauphin saute
 * au large, derrière la trière (toutes les 23 s).
 * Au toucher : l'Hydre (la grande tête plonge, deux petites têtes sortent à sa place et se regardent,
 * étonnées, puis replongent), le Cyclope (il soulève un rocher et le lance : gerbe d'eau à côté de la
 * trière, dont les rameurs accélèrent), Pégase (il se cabre et fait un grand tour du ciel en laissant
 * une traînée d'étoiles).
 */

const SKIN = '#C77A4A';
const DARK = '#2A1910';
const CREAM = '#FBEBD0';
const TERRA = '#C8662E';
const HYDRA = '#3E7D5E';

/** Les rames de la trière (abscisse du sabord). */
const OARS = [34, 46, 58, 70, 82, 94, 106];

/** Étoiles laissées par Pégase pendant son tour du ciel : position (cadre de 480 px) et instant. */
const TRAIL = [
  { x: 211, y: 30, t: 0.18 }, { x: 257, y: 26, t: 0.3 }, { x: 301, y: 38, t: 0.42 },
  { x: 313, y: 56, t: 0.49 }, { x: 293, y: 74, t: 0.56 }, { x: 241, y: 82, t: 0.67 },
  { x: 189, y: 78, t: 0.77 }, { x: 161, y: 62, t: 0.85 }, { x: 181, y: 46, t: 0.92 },
];

function Cloud({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 90 34" className="hm-cloud" style={style}>
      <path d="M8 31C1 31 1 20 10 20C10 12 20 8 28 13C32 4 46 2 52 10C58 6 70 8 70 18C80 16 89 24 83 31Z" fill="#FCEFDC" />
      <path d="M30 25C30 19 38 19 38 23.5C38 26.5 34 26.5 34 24M56 25C56 20 63 20 63 23.5C63 26 60 26 60 24" fill="none" stroke="#E8BF96" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Tête de l'Hydre, tournée vers la droite (ou la gauche avec `flip`), à l'origine du cou. */
function HydraHead({ flip, scale = 1, wide }: { flip?: boolean; scale?: number; wide?: boolean }) {
  return (
    <g transform={`scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M-6 -6L-12 -10L-5 -11L-8 -17L-1 -13L0 -19L4 -13Z" fill={TERRA} />
      <path d="M-7 -2C-8 -10 0 -14 9 -12C16 -11 22 -7 23 -2C24 3 18 6 9 6C1 6 -6 4 -7 -2Z" fill={HYDRA} />
      <path d="M2 3C8 6 16 5 22.5 0.5C21 5 14 7.5 8 7.5C4 7.5 2 5.5 2 3Z" fill="#A9C98A" />
      <ellipse cx="8" cy="1" rx="2.4" ry="1.3" fill="#E08A6A" opacity="0.75" />
      <circle cx="4" cy="-6" r={wide ? 5 : 4.2} fill="#FFFBF5" />
      <g className="hm-pupil">
        <circle cx="5.2" cy="-6" r={wide ? 1.6 : 2.1} fill={DARK} />
        <circle cx="6" cy="-7" r="0.7" fill="#FFFFFF" />
      </g>
      <circle cx="19" cy="-4" r="0.9" fill="#1E3F2F" />
      <path d={wide ? 'M13 2.5C15 4.5 18 4 19.5 1.5' : 'M12 2Q16 3.6 20 1'} fill="none" stroke="#1E3F2F" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

/** Un cou de l'Hydre : `d` part de la base (sous l'eau) et finit à la tête, en (hx, hy). */
function Neck({ cls, d, base, hx, hy, flip, scale, wide, width = 9, children }: {
  cls: string; d: string; base: number; hx: number; hy: number; flip?: boolean; scale?: number; wide?: boolean; width?: number; children?: ReactNode;
}) {
  return (
    <g className={`hm-rise ${cls}`}>
      <g className="hm-sway" style={{ transformOrigin: `${base}px 88px` }}>
        <path d={d} fill="none" stroke={HYDRA} strokeWidth={width} strokeLinecap="round" />
        <path d={d} fill="none" stroke="#2F6249" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 5.5" />
        <g transform={`translate(${hx} ${hy})`}>
          <g className="hm-head"><HydraHead flip={flip} scale={scale} wide={wide} /></g>
        </g>
        {children}
      </g>
    </g>
  );
}

function Sheep({ style, className }: { style: CSSProperties; className: string }) {
  return (
    <svg viewBox="0 0 30 22" className={`hm-sheep ${className}`} style={style}>
      <path d="M9 15V21.5M13 16V21.5M18 16V21.5M22 14V21.5" stroke="#3A2416" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 12C3 12 3 7 7 7C7 3 12 2 14 5C16 1 22 2 22 6C26 6 27 11 24 12C25 16 20 17 18 15C16 18 10 17 9 15C5 17 3 13 6 12Z" fill="#FBF4E6" />
      <path d="M10 9Q12 7 14 9M16 12Q18 10 20 12" fill="none" stroke="#E2D2B8" strokeWidth="1.2" strokeLinecap="round" />
      <g className="hm-sheep__head">
        <path d="M22 6C24 3 29 4 29.5 8C29.5 11 26.5 12 24.5 11C22.5 10 21 8 22 6Z" fill="#3A2416" />
        <path d="M23 6L19.5 4.5L21.5 8Z" fill="#3A2416" />
        <circle cx="26.3" cy="7" r="0.8" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

export default function HerosScene() {
  return (
    <>
      <div className="el-layer hm-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer hm-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 2 })}>
        <div className="hm-set">
          <svg viewBox="-40 -40 80 80" className="hm-sun">
            <g className="hm-sun__rays">
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d="M0 -37C3 -33 4 -28 0 -23C-4 -28 -3 -33 0 -37Z" fill="#E9A563" transform={`rotate(${i * 30})`} />
              ))}
            </g>
            <circle r="20" fill="#F2BC7A" />
            <circle r="15" fill="#FBE2B6" />
            <circle r="15" fill="none" stroke="#E9A563" strokeWidth="1.4" strokeDasharray="2 3" />
          </svg>
        </div>
      </div>

      <div className="el-layer hm-clouds" style={vars({ top: '6px', '--k': 0.36, '--kx': 3 })}>
        <div className="hm-drift">
          {[0, 1].map((set) => (
            <div key={set} className="hm-cloudset">
              <Cloud style={{ left: '4%', top: 8, width: 78 }} />
              <Cloud style={{ left: '40%', top: 34, width: 54 }} />
              <Cloud style={{ left: '70%', top: 2, width: 92 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="el-layer hm-far" style={vars({ top: '110px', '--k': 0.42, '--kx': 4 })}>
        <div className="hm-set">
          <svg viewBox="0 0 480 28" width="480">
            <path d="M-1500 28V24C-200 22 -120 20 -60 24L20 23C60 16 90 12 120 13C150 14 180 20 215 24C240 26 250 26 262 28Z" fill="#C3A9A6" />
            <path d="M240 28C262 22 280 16 300 17C318 18 330 22 350 26C380 25 420 22 470 24C560 20 700 22 1980 24V28Z" fill="#B59A99" />
            <path d="M296 18L299 14L302 18Z" fill="#B59A99" />
          </svg>
        </div>
      </div>

      <div className="el-layer hm-sea" style={vars({ top: '136px', '--k': 0.5, '--kx': 6 })}>
        <div className="hm-water" />
        <div className="hm-swell hm-swell--1" />
        <div className="hm-swell hm-swell--2" />
        <div className="hm-swell hm-swell--3" />
        <div className="hm-set">
          {/* Le dauphin qui saute au large, derrière la trière, de temps en temps */}
          <svg viewBox="0 0 90 50" className="hm-dolphin">
            <defs>
              <clipPath id="hm-clip-dolphin"><rect x="-40" y="-60" width="180" height="104" /></clipPath>
            </defs>
            <g clipPath="url(#hm-clip-dolphin)">
              <g className="hm-dolphin__x">
                <g className="hm-dolphin__y">
                  <g className="hm-dolphin__r">
                    <path d="M-15 1L-12 -4L-10 2Z" fill="#5F86A2" />
                    <path d="M-17 1C-11 -5 -1 -7 7 -4C10 -3 13 -2 15 0C12 1 10 1 8 1C3 4 -5 5 -11 3L-16 6L-15 2L-19 -1Z" fill="#7097B3" />
                    <path d="M-9 2C-3 3 3 2 7 1C3 4 -5 5 -9 2Z" fill="#D5E5EE" />
                    <path d="M-2 -5L1 -10L3 -4Z" fill="#5F86A2" />
                    <circle cx="9" cy="-2" r="0.9" fill={DARK} />
                  </g>
                </g>
              </g>
            </g>
            <g className="hm-dolphin__splash" fill="none" stroke="#FFF3E0" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 43L5 38M12 42V36M16 43L19 38" />
              <path d="M64 43L61 38M68 42V36M72 43L75 38" />
            </g>
          </svg>

          {/* La trière : coque noire, œil peint sur la proue, éperon de bronze, voile carrée */}
          <div className="hm-boat">
            <svg viewBox="0 0 140 100" className="hm-boat__svg">
              <path className="hm-wake" d="M10 88H-22M2 93H-30" fill="none" stroke="#FFF3E0" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M44 14L16 62M98 14L126 64M70 8L40 15M70 8L100 15" stroke={DARK} strokeWidth="0.8" opacity="0.65" />
              <path d="M70 76V7" stroke={DARK} strokeWidth="2.6" />
              <path className="hm-flag" d="M70 7L84 9.5L70 13Z" fill={TERRA} />
              <g className="hm-sail">
                <path d="M46 15H96C100 30 100 44 96 58H46C50 44 50 30 46 15Z" fill={CREAM} />
                <path d="M46.7 19.5H97.5L98.1 23.5H47.4ZM48.3 49.5H98.6L98 53.5H47.9Z" fill={TERRA} />
                <circle cx="72" cy="36.5" r="8.5" fill={TERRA} />
                <circle cx="72" cy="36.5" r="4.6" fill={CREAM} />
                <circle cx="72" cy="36.5" r="2" fill={DARK} />
              </g>
              <path d="M44 14H98" stroke={DARK} strokeWidth="2.4" strokeLinecap="round" />
              <g className="hm-rowers">
                {OARS.map((x) => <circle key={x} cx={x + 4} cy="67.5" r="3.4" fill={DARK} />)}
              </g>
              {OARS.slice(0, 6).map((x, i) => (
                <circle key={x} cx={x + 10} cy="71.5" r="4.4" fill={i % 2 ? CREAM : TERRA} stroke={DARK} strokeWidth="1.1" />
              ))}
              <path d="M14 72H118C124 72 128 68 130 62L134 64C132 72 128 80 120 86H30C20 86 14 80 14 72Z" fill={DARK} />
              <path d="M16 76C8 62 10 46 20 40C27 36 32 42 28 46C25 49 21 46 24 43" fill="none" stroke={DARK} strokeWidth="5" strokeLinecap="round" />
              <path d="M131.5 63C134 58 138.5 58 137.5 62" fill="none" stroke={DARK} strokeWidth="3" strokeLinecap="round" />
              <path d="M19 76.5H124" stroke={TERRA} strokeWidth="2.2" />
              <path d="M24 81H100" stroke={CREAM} strokeWidth="1.6" strokeDasharray="1.6 4.4" strokeLinecap="round" />
              <path d="M105 80Q112 74.5 119 80Q112 84.5 105 80Z" fill={CREAM} />
              <circle cx="113" cy="79.7" r="2.2" fill={DARK} />
              <path d="M126 80L143 83L124 86Z" fill="#C9923E" />
              {OARS.map((x) => (
                <g key={x} className="hm-oar" style={{ transformOrigin: `${x}px 79px` }}>
                  <path d={`M${x} 79L${x - 13} 97`} stroke="#7A4524" strokeWidth="1.8" strokeLinecap="round" />
                  <path d={`M${x - 11.5} 95L${x - 17.5} 102L${x - 13} 102.5Z`} fill="#7A4524" />
                </g>
              ))}
              <path className="hm-foam" d="M12 86.5Q20 84 28 86.5T44 86.5T60 86.5T76 86.5T92 86.5T108 86.5T124 86.5M126 87Q136 82 148 87" fill="none" stroke="#FFF3E0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* L'Hydre : trois cous qui sortent de l'eau près des rochers */}
          <svg viewBox="0 0 80 90" className="hm-hydra" data-tap="hydre" data-tap-ms="4800">
            <defs>
              <clipPath id="hm-clip-hydra"><rect x="-50" y="-70" width="180" height="152" /></clipPath>
            </defs>
            <g clipPath="url(#hm-clip-hydra)">
              <path d="M18 84C22 72 34 67 44 70C51 72 56 78 59 84Z" fill="#2F6249" />
              <path d="M28 76Q31 73 34 76M39 74Q42 71 45 74" fill="none" stroke="#A9C98A" strokeWidth="1.3" strokeLinecap="round" />
              <Neck cls="hm-neck--a" d="M20 88C16 76 23 66 17 57C15 53 11 50 8 49" base={20} hx={6} hy={48} flip />
              <Neck cls="hm-neck--c" d="M56 88C52 76 61 68 58 58C57 52 58 46 60 42" base={56} hx={60} hy={40} scale={0.92} />
              <Neck cls="hm-neck--b" d="M38 88C42 68 32 56 36 40C38 32 38 26 35 22" base={38} hx={34} hy={20} flip width={10} />
              <Neck cls="hm-neck--d" d="M8 90C6 82 10 76 6 70" base={8} hx={4} hy={68} flip scale={0.75} width={7} />
              <Neck cls="hm-twin hm-twin--1" d="M34 90C30 70 21 52 19 30" base={34} hx={18} hy={28} scale={0.88} wide width={8}>
                <path className="hm-startle" d="M8 9L4 4M14 7V0M20 9L24 4" fill="none" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />
              </Neck>
              <Neck cls="hm-twin hm-twin--2" d="M44 90C48 70 57 52 59 30" base={44} hx={60} hy={28} flip scale={0.88} wide width={8}>
                <path className="hm-startle" d="M56 9L52 4M62 7V0M68 9L72 4" fill="none" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />
              </Neck>
            </g>
            <g fill="none" stroke="#FFF3E0" strokeWidth="1.4">
              <ellipse className="hm-ring" cx="20" cy="83" rx="6" ry="1.5" />
              <ellipse className="hm-ring hm-ring--b" cx="38" cy="83" rx="7" ry="1.7" />
              <ellipse className="hm-ring" cx="56" cy="83" rx="6" ry="1.5" />
              <ellipse className="hm-ring hm-ring--d" cx="8" cy="83" rx="5" ry="1.3" />
            </g>
          </svg>

        </div>
      </div>

      <div className="el-layer hm-coast" style={vars({ top: '30px', '--k': 0.6, '--kx': 8 })}>
        <div className="hm-set">
          <svg viewBox="0 0 480 214" width="480" className="hm-coast__svg">
            {/* Falaise du Cyclope, à gauche : un replat, puis des blocs arrondis jusqu'à la mer */}
            <path d="M-1500 214V90C-200 84 -80 86 20 84C60 80 96 80 114 84C126 87 131 96 128 106C135 112 139 124 136 136C143 146 147 162 144 176C151 186 156 200 160 214Z" fill="#B9693F" />
            <path d="M114 84C126 87 131 96 128 106C135 112 139 124 136 136C143 146 147 162 144 176C151 186 156 200 160 214H116C123 196 125 180 119 166C127 150 125 132 117 120C121 108 119 96 108 90Z" fill="#934D2C" />
            <path d="M-1500 90C-200 84 -80 86 20 84C60 80 96 80 114 84C121 86 125 89 127 94C110 89 70 88 20 90C-80 92 -200 91 -1500 97Z" fill="#DB9663" />
            <path d="M30 116C56 112 84 114 104 120M10 146C44 142 76 144 112 152M44 182C68 178 92 180 120 186" fill="none" stroke="#A55B36" strokeWidth="2" strokeLinecap="round" />
            <path d="M118 106C124 110 128 116 128 124M124 140C130 146 134 156 134 166" fill="none" stroke="#7E3F22" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M142 182C143 172 154 168 162 173C168 177 168 183 163 186H143Z" fill="#934D2C" />
            <path d="M160 188C162 182 170 181 174 185C176 188 174 191 170 191H160Z" fill="#B9693F" />
            <path d="M28 84L31 78L33 84M36 84L40 77L42 84M96 82L99 76L102 82M104 83L106 78L109 83" fill="#7D8A4A" />
            {/* Promontoire, à droite */}
            <path d="M1980 214V100C700 96 600 92 480 90L388 88C378 90 372 100 374 110C366 118 364 132 366 144C360 154 358 170 360 184C356 194 354 204 354 214Z" fill="#B9693F" />
            <path d="M388 88C378 90 372 100 374 110C366 118 364 132 366 144C360 154 358 170 360 184C356 194 354 204 354 214H396C388 190 386 166 392 146C384 130 386 112 396 98Z" fill="#934D2C" />
            <path d="M388 88L480 90C600 92 700 96 1980 100V106C700 102 600 98 480 96L384 94C385 91 386 89 388 88Z" fill="#DB9663" />
            <path d="M404 130C420 126 440 128 462 134M398 168C420 164 450 166 476 172" fill="none" stroke="#A55B36" strokeWidth="2" strokeLinecap="round" />
            <path d="M342 194C344 186 354 184 360 189C363 192 362 196 358 198H342Z" fill="#934D2C" />
            {/* Le rocher lancé par le Cyclope et la gerbe d'eau */}
            <g className="hm-throw">
              <g className="hm-throw__x">
                <g className="hm-throw__y">
                  <g className="hm-throw__r">
                    <path d="M-18 3C-20 -5 -12 -12 -2 -12C8 -13 18 -8 19 -1C20 6 13 10 3 10C-8 11 -16 9 -18 3Z" fill="#8C7D70" />
                    <path d="M5 -12C13 -11 18 -7 19 -1C20 6 13 10 3 10C10 7 13 -2 5 -12Z" fill="#6E6157" />
                  </g>
                </g>
              </g>
            </g>
            <g className="hm-splash">
              <path d="M-14 0C-18 -8 -16 -18 -10 -24C-10 -16 -8 -12 -6 -8C-7 -18 -4 -30 2 -38C2 -26 3 -18 4 -10C6 -18 10 -26 16 -30C14 -20 13 -10 14 0Z" fill="#FFF3E0" />
              <circle cx="-12" cy="-22" r="2.2" fill="#FFF3E0" /><circle cx="13" cy="-26" r="2" fill="#FFF3E0" />
              <circle cx="-6" cy="-36" r="1.8" fill="#FFF3E0" /><circle cx="15" cy="-12" r="1.6" fill="#FFF3E0" />
              <ellipse className="hm-splash__ring" cx="0" cy="1" rx="10" ry="2.4" fill="none" stroke="#FFF3E0" strokeWidth="1.5" />
            </g>
          </svg>

          <Sheep className="hm-sheep--graze" style={{ left: 34, top: 64, width: 28 }} />
          <Sheep className="hm-sheep--lamb" style={{ left: 108, top: 70, width: 19 }} />

          {/* Le Cyclope, debout sur sa falaise */}
          <svg viewBox="0 -14 60 94" className="hm-cyclops" data-tap="rocher" data-tap-ms="4400">
            <g className="hm-cy-body">
              <path d="M20 64H28V78H18ZM32 64H40L42 78H32Z" fill={SKIN} />
              <path d="M16 77H29V80H15ZM31 77H44L45 80H31Z" fill="#5A3320" />
              <g className="hm-cy-arm hm-cy-arm--l">
                <path d="M15 32C8 38 7 48 10 56" fill="none" stroke={SKIN} strokeWidth="7" strokeLinecap="round" />
                <circle cx="10" cy="57.5" r="4.2" fill={SKIN} />
              </g>
              <g className="hm-cy-arm hm-cy-arm--r">
                <path d="M45 32C52 38 53 48 50 56" fill="none" stroke={SKIN} strokeWidth="7" strokeLinecap="round" />
                <circle cx="50" cy="57.5" r="4.2" fill={SKIN} />
              </g>
              <path d="M13 42C11 30 19 25 30 25C41 25 49 30 47 42L49 66C42 70 18 70 11 66Z" fill="#EFE2CC" />
              <path d="M18 46q3 -3 6 0M30 51q3 -3 6 0M19 59q3 -3 6 0M36 41q3 -3 6 0M38 60q3 -3 6 0M24 37q3 -3 6 0" fill="none" stroke="#CDB592" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M12 55Q30 59 48 55" fill="none" stroke="#8A4A26" strokeWidth="2.4" />
              <g className="hm-cy-head">
                <circle cx="17.5" cy="16" r="3" fill={SKIN} /><circle cx="42.5" cy="16" r="3" fill={SKIN} />
                <circle cx="30" cy="15" r="12.5" fill={SKIN} />
                <path d="M18 12C17 3 25 -1 31 0C38 0 44 4 42 12C40 7 34 5 30 6C25 5 20 7 18 12Z" fill="#3A2416" />
                <path d="M18 17C17 28 23 35 30 35C37 35 43 28 42 17C40 22 36 24 30 24C24 24 20 22 18 17Z" fill="#3A2416" />
                <ellipse className="hm-cy-mouth" cx="30" cy="27" rx="3.2" ry="1.5" fill="#8A3B22" />
                <path d="M28.5 15Q31.5 19 28 20.5" fill="none" stroke="#9A5530" strokeWidth="1.4" strokeLinecap="round" />
                <ellipse cx="30" cy="10.5" rx="6.6" ry="5.6" fill="#FFFBF5" />
                <g className="hm-cy-pupil">
                  <circle cx="30" cy="10.8" r="3.3" fill="#4B7A9A" />
                  <circle cx="30" cy="10.8" r="1.7" fill={DARK} />
                  <circle cx="31" cy="9.7" r="0.8" fill="#FFFFFF" />
                </g>
                <ellipse className="hm-cy-lid" cx="30" cy="10.5" rx="7" ry="6" fill={SKIN} />
                <path className="hm-cy-brow" d="M22.5 4.6Q30 1.4 37.5 4.6" fill="none" stroke="#3A2416" strokeWidth="2.6" strokeLinecap="round" />
              </g>
              <g className="hm-cy-rock">
                <path d="M7 0C5 -10 14 -18 27 -19C40 -20 52 -14 53 -5C55 4 46 9 33 9C19 10 9 8 7 0Z" fill="#8C7D70" />
                <path d="M36 -19C46 -17 52 -12 53 -5C55 4 46 9 33 9C42 5 46 -6 36 -19Z" fill="#6E6157" />
                <path d="M16 -6Q20 -10 25 -9M30 1Q35 -1 38 2" fill="none" stroke="#A89A8C" strokeWidth="1.4" strokeLinecap="round" />
              </g>
            </g>
          </svg>

          {/* Olivier et temple sur le promontoire */}
          <svg viewBox="0 0 30 40" className="hm-olive">
            <g className="hm-olive__all">
              <path d="M15 40C16 32 12 28 15 22C17 18 14 14 16 10M15 26C19 24 21 21 22 18" fill="none" stroke="#6B4A2E" strokeWidth="2.6" strokeLinecap="round" />
              <ellipse cx="10" cy="14" rx="8" ry="5.5" fill="#7E8B55" />
              <ellipse cx="20" cy="10" rx="8.5" ry="6" fill="#93A06A" />
              <ellipse cx="14" cy="6" rx="7" ry="4.5" fill="#A3AF7A" />
              <ellipse cx="23" cy="18" rx="6" ry="4" fill="#7E8B55" />
              <circle cx="9" cy="15" r="1" fill="#3A2416" /><circle cx="21" cy="12" r="1" fill="#3A2416" /><circle cx="24" cy="19" r="1" fill="#3A2416" />
            </g>
          </svg>
          <svg viewBox="0 0 52 56" className="hm-temple">
            <path d="M5 21H47V46H5Z" fill="#D8BC98" />
            {[7, 16, 25, 34, 43].map((x) => (
              <g key={x}>
                <path d={`M${x - 0.2} 22H${x + 4.7}V46H${x - 0.2}Z`} fill="#FFF4E2" />
                <path d={`M${x + 3} 22H${x + 4.2}V46H${x + 3}Z`} fill="#E9D3B4" />
                <path d={`M${x - 1.2} 19.5H${x + 5.7}V22.2H${x - 1.2}Z`} fill="#FFF4E2" />
              </g>
            ))}
            <path d="M3 14.5H49V19.6H3Z" fill="#FFF4E2" />
            <path d="M3 14.5H49V17.4H3Z" fill={TERRA} />
            <path d="M6 15.2V16.8M12 15.2V16.8M18 15.2V16.8M24 15.2V16.8M30 15.2V16.8M36 15.2V16.8M42 15.2V16.8" stroke={DARK} strokeWidth="1.6" />
            <path d="M1 14.6L26 3L51 14.6Z" fill="#FFF4E2" />
            <path d="M8 13L26 5.4L44 13Z" fill="#EFD9BA" />
            <circle cx="26" cy="10" r="2" fill={TERRA} />
            <circle cx="1.5" cy="13" r="1.8" fill={TERRA} /><circle cx="26" cy="2" r="1.8" fill={TERRA} /><circle cx="50.5" cy="13" r="1.8" fill={TERRA} />
            <path d="M3 46H49V50H3Z" fill="#FFF4E2" />
            <path d="M0 50H52V56H0Z" fill="#E9D3B4" />
          </svg>
        </div>
      </div>

      <div className="el-layer hm-peglayer" style={vars({ top: '0px', '--k': 0.62, '--kx': 9 })}>
        <div className="hm-set">
          <svg viewBox="0 0 480 120" width="480" className="hm-trail">
            {TRAIL.map((s, i) => (
              <path
                key={i}
                className="hm-star"
                style={vars({ '--t': `${(s.t * 3.8).toFixed(2)}s`, transformOrigin: `${s.x}px ${s.y}px` })}
                d={`M${s.x} ${s.y - 7}L${s.x + 1.9} ${s.y - 1.9}L${s.x + 7} ${s.y}L${s.x + 1.9} ${s.y + 1.9}L${s.x} ${s.y + 7}L${s.x - 1.9} ${s.y + 1.9}L${s.x - 7} ${s.y}L${s.x - 1.9} ${s.y - 1.9}Z`}
                fill={i % 2 ? '#F6C65B' : '#FFF3D6'}
              />
            ))}
          </svg>
          {/* Pégase : il plane en battant des ailes */}
          <div className="hm-peg" data-tap="envol" data-tap-ms="4600">
            <div className="hm-peg__fly">
              <div className="hm-peg__turn">
                <svg viewBox="0 -10 70 54" className="hm-peg__svg">
                  <g className="hm-wing hm-wing--far">
                    <path d="M30 20C25 9 28 -3 38 -8C38 -4 42 -4 44 -7C44 -3 48 -3 51 -6C50 4 44 13 36 20Z" fill="#E7D2B6" />
                    <path d="M30 20C25 9 28 -3 38 -8C35 -2 33 5 33 11C33 15 33 18 34 20Z" fill="#B65A28" />
                  </g>
                  <path d="M40 33L43 40L47 41M22 31L17 37L13 36" fill="none" stroke="#E7D2B6" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 24C10 21 6 26 1 23C4 30 11 31 17 28Z" fill={TERRA} />
                  <path d="M16 26C16 18 26 15 38 16C46 16 50 20 50 26C50 32 44 34 34 34C24 34 16 32 16 26Z" fill="#FFFBF5" />
                  <path d="M44 20C46 12 50 6 56 4C60 3 64 6 66 10C67 12 65 14 62 13.5C60 13.5 58 14.5 57 17C55 22 52 26 48 27Z" fill="#FFFBF5" />
                  <path d="M46 19C47 11 52 4 58 3C55 6 53 10 52 14C51 16 49 18 47 21Z" fill={TERRA} />
                  <path d="M56 4.5L57.5 0L59.5 4.5Z" fill="#FFFBF5" />
                  <circle cx="60.5" cy="8" r="1.2" fill={DARK} />
                  <path d="M44 32L48 38L52.5 36.5M26 32L22 39.5L17.5 40.5" fill="none" stroke="#FFFBF5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M51.5 35L54 36.2L53 38.3ZM16.5 39L18 41.8L15.6 42.4Z" fill={DARK} />
                  <g className="hm-wing hm-wing--near">
                    <path d="M30 20C25 9 28 -3 38 -8C38 -4 42 -4 44 -7C44 -3 48 -3 51 -6C50 4 44 13 36 20Z" fill="#FFFBF5" />
                    <path d="M37 9C39 4 41 0 44 -7M37 15C41 10 45 4 51 -6" fill="none" stroke="#D9B48A" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M30 20C25 9 28 -3 38 -8C35 -2 33 5 33 11C33 15 33 18 34 20Z" fill={TERRA} />
                    <circle cx="30.8" cy="6" r="0.8" fill={CREAM} /><circle cx="31.4" cy="12" r="0.8" fill={CREAM} /><circle cx="32.6" cy="0.5" r="0.8" fill={CREAM} />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="el-layer hm-shore" style={vars({ top: '204px', '--k': 0.8, '--kx': 12 })} />
    </>
  );
}
