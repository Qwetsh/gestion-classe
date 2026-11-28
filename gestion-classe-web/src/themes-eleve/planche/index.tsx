import type { CSSProperties, ReactNode } from 'react';
import { vars } from '../shared';
import './theme.css';

/**
 * Thème « Planche » : une page de bande dessinée, encrée en noir sur papier blanc, avec une seule
 * touche de rouge. On y suit Milo, un collégien à grosse mèche et écharpe rouge, en retard pour le
 * collège, son chien Pataud et son amie Lou.
 * Plans, du fond vers l'avant : le papier ; la bande de trois cases (titre de la série au-dessus,
 * cartouches « CE MATIN-LÀ… », « SOUDAIN… », « 8 H 29 », décor de chaque case avec ses trames de
 * points, dont le fond glisse un peu dans son cadre sous le mouvement de caméra) et les
 * personnages ; enfin les onomatopées, qui flottent au-dessus des cases. Sur un grand écran, d'autres
 * cases de la planche bordent la bande à gauche et à droite. Sous la bande, la page reste blanche.
 * Mouvement, sans que l'élève touche à rien : Milo traverse la bande en courant (« EN RETARD ! »,
 * « ZOOM »), saute la gouttière entre deux cases, saute la palissade (« HOP ! »), fait un grand bond
 * qui le fait sortir du cadre par le haut, atterrit devant le collège (« PAF ! »), lance « PILE À
 * L'HEURE ! » et sort de la page ; l'aiguille de l'horloge passe à la demie quand il atterrit. Le
 * chien remue la queue et aboie quand Milo passe, Lou tape du pied et regarde sa montre, les nuages
 * passent, le drapeau du collège flotte, les traits de vitesse de la case du milieu respirent.
 * De temps en temps (toutes les 19 s), un oiseau traverse la bande : il sort d'une case, disparaît
 * derrière la gouttière et entre dans la suivante.
 * Au toucher : le chien (« BOING ! » : il bondit hors de sa case par le haut et y retombe en
 * rebondissant), Lou (une bulle de pensée monte, une ampoule s'y allume), la case du milieu (elle se
 * retourne comme une carte et montre un autre moment, « PENDANT CE TEMPS… », la nuit sur les toits
 * avec un chat endormi, puis revient).
 */

const INK = '#111111';
const RED = '#D10500';

/** Un membre encré : le trait noir, puis la manche blanche par-dessus (la jambe de pantalon reste noire). */
function Limb({ d, dark }: { d: string; dark?: boolean }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={4.8} strokeLinecap="round" strokeLinejoin="round" />
      {!dark && <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
    </>
  );
}

/** Une basket, la pointe vers l'avant (à droite), posée au point (x, y), inclinée de `a` degrés. */
function Shoe({ x, y, a = 0 }: { x: number; y: number; a?: number }) {
  return <path d="M-3 -2.6H1.6C3.6 -2.6 5 -1.2 5 0.6V1.4H-3.4Z" transform={`translate(${x} ${y}) rotate(${a})`} fill="#FFFFFF" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />;
}

/** Une main. */
const Hand = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={1.9} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />;

/** Milo, vu de profil, tourné vers la droite. Le tronc, la tête et l'écharpe sont communs ; les membres changent avec la pose. */
function Milo() {
  const back = (
    <>
      <path className="pl-scarf-tail" d="M24 22.5C19 20 14 24 7 20.5L8.5 25C14 28.5 19 25.5 24 26.5Z" fill={RED} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M14.5 27.5C14.5 25.5 16 24.5 18 24.5H21.5V38.5H18C16 38.5 14.5 37.5 14.5 35.5Z" fill={INK} />
      <path d="M17 27V36" stroke="#FFFFFF" strokeWidth={0.9} strokeLinecap="round" />
    </>
  );
  const torso = <path d="M22 23.5C26 22 30 22.5 32 25L30.2 40C27 41.6 23.2 41.6 20.6 40Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />;
  const face = (
    <>
      <circle cx={28} cy={13.5} r={8} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
      <path d="M21.5 16.5C19 13 19.5 7 23 4C26 1.5 30 1 33 2.5C36 1.5 39.5 0.5 42 1C39.5 2.5 38 4.5 36.5 7.5C34.5 7 32.5 7.5 30.5 8.5C28.5 9 26.5 10.5 25.5 13C24.5 15 23.5 16.5 21.5 16.5Z" fill={INK} />
      <circle cx={25.2} cy={15} r={1.7} fill="#FFFFFF" stroke={INK} strokeWidth={1.1} />
      <circle cx={32} cy={12.6} r={1.15} fill={INK} />
      <path d="M30.2 10C31.2 9.4 32.6 9.4 33.6 10" fill="none" stroke={INK} strokeWidth={1} strokeLinecap="round" />
      <path d="M21.5 21C25 23.2 29.5 23.2 33 21L33 24.6C29.5 26.8 25 26.8 21.5 24.6Z" fill={RED} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    </>
  );
  const pant = <path d="M31 17.6L33.6 17" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />;
  return (
    <svg viewBox="0 0 48 60" className="pl-milo">
      <g className="pl-milo__body">
        {/* Course : deux images qui alternent, comme une case dessinée deux fois */}
        <g className="pl-pose pl-pose--run">
          <path className="pl-speed" d="M1 29H11M-1 35H8M3 41H12" />
          <g className="pl-frame pl-frame--a">
            {back}
            <Limb d="M29 27L34 31L37 27.5" /><Hand x={37.5} y={27} />
            <Limb d="M25 39L20 46L13.5 48.5" dark /><Shoe x={12.5} y={49} a={-55} />
            {torso}
            <Limb d="M25.5 39L32 46L34.5 54" dark /><Shoe x={35} y={56.2} />
            <Limb d="M27 27L22 32L18.5 29.5" /><Hand x={18} y={29} />
            {face}{pant}
          </g>
          <g className="pl-frame pl-frame--b">
            {back}
            <Limb d="M29 27L24.5 31L21 28.5" /><Hand x={20.6} y={28} />
            <Limb d="M25 39L31 44.5L26 50" dark /><Shoe x={26.5} y={51.5} a={-20} />
            {torso}
            <Limb d="M25.5 39L26.5 48L25.5 54.5" dark /><Shoe x={26.5} y={56.2} />
            <Limb d="M27 27L31 32L35 30" /><Hand x={35.5} y={29.6} />
            {face}{pant}
          </g>
        </g>
        {/* Saut : jambes repliées, bras en l'air, bouche ouverte */}
        <g className="pl-pose pl-pose--jump">
          {back}
          <Limb d="M29 26L34 21.5L38 17.5" /><Hand x={38.5} y={17} />
          <Limb d="M25 39L21 45L15 46" dark /><Shoe x={14} y={46.5} a={-40} />
          {torso}
          <Limb d="M25.5 39L32 43L29.5 49.5" dark /><Shoe x={30.5} y={51} a={10} />
          <Limb d="M27 27L33 21L35.5 15" /><Hand x={35.8} y={14.4} />
          {face}
          <ellipse cx={32.6} cy={18} rx={1.3} ry={1.6} fill={INK} />
        </g>
        {/* Arrivée : debout, il salue */}
        <g className="pl-pose pl-pose--stand">
          {back}
          <Limb d="M29.5 27L31 33L30 38" /><Hand x={30} y={38.5} />
          <Limb d="M25 39L23 48L21.5 54.5" dark /><Shoe x={22.5} y={56.2} />
          {torso}
          <Limb d="M25.5 39L27.5 48L28.5 54.5" dark /><Shoe x={29.5} y={56.2} />
          <g className="pl-wave">
            <Limb d="M27 27L33 22L35 15.5" /><Hand x={35.2} y={14.8} />
          </g>
          {face}
          <path d="M30.6 17C31.6 18.6 33.2 18.6 34 17" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/** Pataud, le chien, assis, tourné vers la droite. */
function Pataud() {
  return (
    <svg viewBox="0 0 44 36" className="pl-dog" data-tap="saut" data-tap-ms="2800">
      <g className="pl-dog__all">
        <path className="pl-dog__lines" d="M14 37V46M22 38V49M30 37V46" />
        <path className="pl-dog__tail" d="M11 28C5 26.5 3 20.5 5.5 14.5C7.5 19 9.5 23 13.5 24.8Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M11 34.5C5.5 33.5 5.5 25 10 21.5C12 17 16 14 21 14L26.5 16C27.5 22 27.5 28.5 26.8 34.5Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <ellipse cx={14.5} cy={22.5} rx={3.6} ry={2.6} fill={INK} />
        <path d="M11 34.5H17" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M20.6 20.5H24V34.5H19.2C19.2 33 19.8 32.5 20.6 32.5Z M24.8 20.5H28.2V32.5C29.2 32.5 29.8 33 29.8 34.5H24.8Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M19.6 15.4L27.4 17.6L26.8 20.2L19 18Z" fill={RED} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
        <g className="pl-dog__head">
          <path d="M20 9C20 4 24 1.5 28 2C32 2.5 34 5 34.3 7.2L39 8.4C41.2 9 41.2 12.6 39 13.2L33.4 14.2C31.4 17 26.4 17.6 23.2 16C21 15 20 12 20 9Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          <ellipse cx={29.8} cy={7} rx={3.2} ry={2.8} fill={INK} />
          <circle cx={30.4} cy={6.4} r={0.8} fill="#FFFFFF" />
          <circle cx={39.4} cy={9.7} r={1.6} fill={INK} />
          <path className="pl-dog__mouth" d="M36.5 13.4Q34.6 14.8 32.6 14" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
          <g className="pl-dog__bark">
            <path d="M33 13.6L39.4 13.2C38.6 16.6 35.4 17.6 33 15.6Z" fill={INK} />
            <path d="M34.2 15.4C35.4 15.2 36.6 15.4 37.2 16C36.2 16.8 35 16.8 34.2 15.4Z" fill={RED} />
          </g>
          <path className="pl-dog__ear" d="M22.5 3C18.5 3 16.2 8 17 13.6C19.2 12.4 21.4 9.4 24 6.2Z" fill={INK} />
        </g>
      </g>
    </svg>
  );
}

/** Lou, l'amie de Milo, tournée vers la gauche : elle attend devant le collège. */
function Lou() {
  return (
    <svg viewBox="0 0 30 58" className="pl-lou" data-tap="idee" data-tap-ms="3800">
      <path d="M21 7.5C27 6 29.5 12 27.5 18.5C25.5 15.5 23.5 13.5 21 12.5Z" fill={INK} />
      <path d="M20.5 21L24.2 27L20.6 31" fill="none" stroke={INK} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 21L24.2 27L20.6 31" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 41V54" stroke={INK} strokeWidth={2.2} />
      <g className="pl-lou__foot">
        <path d="M18 41V54" stroke={INK} strokeWidth={2.2} />
        <path d="M14.4 54H19.4V57H13.2C13.2 55.4 13.6 54.6 14.4 54Z" fill={INK} />
      </g>
      <path d="M8.4 54H13.4V57H7.2C7.2 55.4 7.6 54.6 8.4 54Z" fill={INK} />
      <path d="M8.5 31.5H21.5L24 41.5H6Z" fill={INK} />
      <path d="M9 20.5C12 18.6 18 18.6 21 20.5L21.2 32H8.8Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M9 24.6H21.1M9 28.4H21.2" stroke={INK} strokeWidth={1.6} />
      <circle cx={15} cy={11} r={7.5} fill="#FFFFFF" stroke={INK} strokeWidth={1.3} />
      <path d="M7.6 11.5C7 5.5 10.5 3 15 3C19.5 3 23 6 22.6 11.5C20.4 8.6 16 7.8 12.6 8.8C10.6 9.6 9.2 10.6 7.6 11.5Z" fill={INK} />
      <path d="M8.4 8.4Q15 3.2 21.8 8.4" fill="none" stroke={RED} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={11.4} cy={11.8} r={1} fill={INK} />
      <path d="M10 15.4H12.6" stroke={INK} strokeWidth={1} strokeLinecap="round" />
      <g className="pl-lou__arm">
        <path d="M10 21L6 27L10.5 30.5" fill="none" stroke={INK} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 21L6 27L10.5 30.5" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 29L12 31.4" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Un oiseau à l'encre, ailes en M qui battent. */
function Bird() {
  return (
    <svg viewBox="0 0 22 12" className="pl-bird">
      <path className="pl-bird__up" d="M1 4C4 1 7.5 2 11 7C14.5 2 18 1 21 4C17.5 3.5 14 6 11 10C8 6 4.5 3.5 1 4Z" />
      <path className="pl-bird__down" d="M1 9C4 9.5 7.5 8.5 11 6C14.5 8.5 18 9.5 21 9C17.5 11 14 11 11 9.2C8 11 4.5 11 1 9Z" />
    </svg>
  );
}

/** Une case de la bande : position et largeur en part de la largeur de la scène, pour suivre l'écran. */
function Panel({ l, w, className, tap, children }: { l: number; w: number; className: string; tap?: [string, number]; children: ReactNode }) {
  return (
    <div className={`pl-panel ${className}`} style={vars({ '--l': l, '--w': w })} data-tap={tap?.[0]} data-tap-ms={tap?.[1]}>
      {children}
    </div>
  );
}

/** Le passage de l'oiseau, dans une case : le même trajet dans toutes les cases, chacune n'en montre que sa part. */
const BirdTrack = () => (
  <div className="pl-birdtrack"><div className="pl-birdfly"><Bird /></div></div>
);

const CLOUD = 'M6 15C2 15 1 10 5 9C5 4 11 3 13 6C15 1 24 1 25 6C29 4 34 6 33 10C38 10 38 15 34 15Z';
const at = (s: CSSProperties) => s;

export default function PlancheScene() {
  return (
    <>
      {/* Trames de points communes aux décors des cases */}
      <svg width="0" height="0" className="pl-defs" aria-hidden>
        <defs>
          <pattern id="pl-dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <circle cx="2.5" cy="2.5" r="1.1" fill={INK} />
          </pattern>
          <pattern id="pl-dots-big" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <circle cx="2.5" cy="2.5" r="1.7" fill={INK} />
          </pattern>
        </defs>
      </svg>

      <div className="el-layer pl-paper" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer pl-strip" style={vars({ top: '0px', '--k': 1, '--kx': 2 })}>
        <div className="el-stage">
          <div className="pl-title"><span>MILO <b>&amp;</b> PATAUD</span><span className="pl-title__ep">{'N° 3'}</span></div>

          {/* Case 1 : la rue, ce matin-là */}
          <Panel l={0.025} w={0.28} className="pl-panel--a">
            <div className="pl-sky" />
            <div className="pl-clouds">
              {[0, 50].map((o) => (
                <span key={o}>
                  <svg viewBox="0 0 40 16" className="pl-cloud" style={at({ left: `${o + 4}%`, top: 34 })}><path d={CLOUD} /></svg>
                  <svg viewBox="0 0 40 16" className="pl-cloud pl-cloud--small" style={at({ left: `${o + 30}%`, top: 60 })}><path d={CLOUD} /></svg>
                </span>
              ))}
            </div>
            <BirdTrack />
            <svg viewBox="0 0 110 160" preserveAspectRatio="xMidYMax slice" className="pl-art pl-far">
              <path d="M-10 160V104H8V92H26V112H40V160Z" fill="url(#pl-dots)" />
              <path d="M-10 104H8V92H26V112H40" fill="none" stroke={INK} strokeWidth={1.2} />
            </svg>
            <svg viewBox="0 0 110 160" preserveAspectRatio="xMidYMax slice" className="pl-art">
              <path d="M64 160V72L88 52L114 72V160Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
              <path d="M88 52L114 72H62Z" fill="url(#pl-dots-big)" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
              <path d="M72 84H88V102H72Z" fill={INK} />
              <path d="M80 84V102M72 93H88M74.5 86.5L78 90" stroke="#FFFFFF" strokeWidth={1.2} />
              <path d="M94 126H108V160H94Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
              <circle cx={97} cy={144} r={1.1} fill={INK} />
              <path d="M94 84H106V102H94Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
              <path d="M94 93H106" stroke={INK} strokeWidth={1.2} />
              <path d="M53 160V46" stroke={INK} strokeWidth={2.6} />
              <path d="M53 50H60" stroke={INK} strokeWidth={1.6} />
              <path d="M46.5 46H59.5L56.5 39H49.5Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M49 157H57" stroke={INK} strokeWidth={3} strokeLinecap="round" />
            </svg>
            <div className="pl-ground" />
            <div className="pl-cap">{'CE MATIN-LÀ…'}</div>
            <div className="pl-bub pl-bub--late">{'EN RETARD !'}</div>
            <div className="pl-bub pl-bub--bark">{'OUAF !'}</div>
          </Panel>

          {/* Case 2 : la palissade, et son revers (pendant ce temps, la nuit sur les toits) */}
          <Panel l={0.328} w={0.344} className="pl-panel--b" tap={['retourne', 3600]}>
            <div className="pl-flip">
              <div className="pl-face pl-face--front">
                <div className="pl-burst" />
                <BirdTrack />
                <svg viewBox="0 0 134 160" preserveAspectRatio="xMidYMax slice" className="pl-art">
                  <path d="M108 160V104H115V160Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
                  <path d="M111 66C122 66 130 74 129 84C136 87 137 100 129 104C126 112 114 113 110 108C104 112 92 110 91 102C84 98 86 86 94 85C94 74 101 66 111 66Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                  <path d="M129 84C136 87 137 100 129 104C126 112 114 113 110 108C116 106 124 102 126 94C127 90 128 87 129 84Z" fill="url(#pl-dots-big)" />
                  <path d="M100 92C102 89 105 88 108 89M114 78C117 76 120 77 122 79" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
                  <path d="M6 160C6 146 14 138 24 140C28 130 42 130 46 140C54 136 62 142 60 160Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
                  <path d="M16 152C18 148 22 147 25 148M36 146C40 143 44 144 46 147" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                    const x = 26 + k * 11;
                    return <path key={k} d={`M${x} 160V137L${x + 4} 131L${x + 8} 137V160Z`} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />;
                  })}
                  <path d="M22 143H120M22 153H120" stroke={INK} strokeWidth={1.4} />
                </svg>
                <div className="pl-ground" />
                <div className="pl-cap">{'SOUDAIN…'}</div>
              </div>
              <div className="pl-face pl-face--back">
                <svg viewBox="0 0 134 160" preserveAspectRatio="xMidYMax slice" className="pl-art">
                  <path d="M96 22A15 15 0 1 0 108 46A12 12 0 1 1 96 22Z" fill="#FFFFFF" />
                  <path d="M24 30V38M20 34H28M60 18V24M57 21H63M44 56V60M42 58H46M118 70V76M115 73H121M14 76V80M12 78H16" stroke="#FFFFFF" strokeWidth={1.2} />
                  <path d="M-4 160V112L22 92L48 112V104H66L90 86L116 106V100H124V112L140 124V160Z" fill="#FFFFFF" />
                  <path d="M-4 160V116L22 96L48 116V108H66L90 90L116 110V104H120V116L140 128V160Z" fill="url(#pl-dots-big)" />
                  <path d="M80 96H88V104H80ZM14 120H22V128H14Z" fill="#FFFFFF" />
                  <g transform="translate(78 75)">
                    <path d="M2 14C0 9 2 4 6 3L5 0L8 2L11 0L10.5 3.5C14 5 14.5 10 12.5 14Z" fill="#FFFFFF" />
                    <path d="M12.5 13C16 13 18 10 17 7" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
                    <path d="M4.5 7.5Q6 8.6 7.2 7.5M8.8 7.5Q10 8.6 11.4 7.5" fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
                  </g>
                </svg>
                <div className="pl-zzz"><span>Z</span><span>z</span><span>z</span></div>
                <div className="pl-cap pl-cap--night">{'PENDANT CE TEMPS…'}</div>
              </div>
            </div>
          </Panel>

          {/* Case 3 : devant le collège, 8 h 29 */}
          <Panel l={0.695} w={0.28} className="pl-panel--c">
            <BirdTrack />
            <svg viewBox="0 0 110 160" preserveAspectRatio="xMidYMax slice" className="pl-art">
              <path d="M66 31V12" stroke={INK} strokeWidth={1.6} />
              <path className="pl-flag" d="M66.8 12.5C70 11 73 14 77 12.6V20C73 21.4 70 18.4 66.8 19.9Z" fill={RED} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
              <path d="M24 160V58H112V160Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
              <path d="M24 128H112V160H24Z" fill="url(#pl-dots)" />
              <path d="M18 59L66 30L114 59Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
              <path d="M24 59H112V67H24Z" fill={INK} />
              <text x={68} y={65.4} textAnchor="middle" className="pl-sign">{'COLLÈGE'}</text>
              <circle cx={66} cy={47} r={8} fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
              <path d="M66 40.6V42M66 52V53.4M59.6 47H61M71 47H72.4" stroke={INK} strokeWidth={1} />
              <path d="M66 47L62.4 48.6" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
              <path className="pl-minute" d="M66 47V41.4" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
              <path d="M32 76H44V92H32ZM88 76H100V92H88ZM32 100H44V116H32ZM88 100H100V116H88Z" fill={INK} />
              <path d="M34.5 78.5L38 82M90.5 78.5L94 82M34.5 102.5L38 106M90.5 102.5L94 106" stroke="#FFFFFF" strokeWidth={1.1} />
              <path d="M52 160V96C52 86 80 86 80 96V160Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
              <path d="M57 160V92M62 160V89.4M66 160V88.6M70 160V89.4M75 160V92M52 112H80" stroke={INK} strokeWidth={1.2} />
            </svg>
            <div className="pl-ground" />
            <Lou />
            <div className="pl-think">
              <svg viewBox="0 0 64 54">
                <circle className="pl-think__puff pl-think__puff--1" cx={52} cy={50} r={2} />
                <circle className="pl-think__puff pl-think__puff--2" cx={47} cy={43} r={3} />
                <g className="pl-think__cloud">
                  <path d="M14 36C5 36 3 27 10 25C7 17 15 11 22 14C25 6 37 5 41 12C48 8 57 13 55 21C62 23 61 34 53 34C52 40 43 42 38 38C33 42 22 42 20 37C18 37 16 37 14 36Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
                  <g className="pl-bulb">
                    <path className="pl-bulb__rays" d="M32 6.5V10M21.5 11L24 13.5M42.5 11L40 13.5M18 21H21.5M46 21H42.5" stroke={RED} strokeWidth={1.8} strokeLinecap="round" />
                    <path className="pl-bulb__glass" d="M32 13C27.5 13 25 16.5 25 20C25 23 27 24.5 28 26.5V28H36V26.5C37 24.5 39 23 39 20C39 16.5 36.5 13 32 13Z" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
                    <path d="M28.4 29.5H35.6M29 31.8H35" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
                  </g>
                </g>
              </svg>
            </div>
            <div className="pl-cap">{'8 H 29'}</div>
            <div className="pl-bub pl-bub--time">{'PILE À L’HEURE !'}</div>
          </Panel>

          {/* Grand écran : d'autres cases de la planche, de chaque côté */}
          <div className="pl-side pl-side--l">
            <div className="pl-sidecase pl-sidecase--night"><span className="pl-cap">{'LA VEILLE AU SOIR…'}</span></div>
            <div className="pl-sidecase pl-sidecase--dots" />
          </div>
          <div className="pl-side pl-side--r">
            <div className="pl-sidecase pl-sidecase--burst" />
            <div className="pl-sidecase pl-sidecase--cap"><span>{'À SUIVRE…'}</span></div>
          </div>

          {/* Les personnages : hors des cadres, pour pouvoir en sortir */}
          <div className="pl-dogspot"><Pataud /></div>
          <div className="pl-run">
            <div className="pl-hop"><Milo /></div>
          </div>
        </div>
      </div>

      {/* Onomatopées : elles flottent au-dessus des cases */}
      <div className="el-layer pl-sfx" style={vars({ top: '0px', '--k': 1, '--kx': 5 })}>
        <div className="el-stage">
          <div className="pl-word pl-word--zoom">ZOOM</div>
          <div className="pl-word pl-word--hop">{'HOP !'}</div>
          <div className="pl-paf">
            <svg viewBox="0 0 80 60"><path d="M40 2L46 18L62 6L56 24L78 22L60 34L76 48L54 42L52 58L42 44L30 58L28 42L6 50L20 34L2 24L24 24L16 6L34 18Z" fill={RED} stroke={INK} strokeWidth={2} strokeLinejoin="round" /></svg>
            <span>{'PAF !'}</span>
          </div>
          <div className="pl-word pl-word--boing">{'BOING!'.split('').map((ch, i) => <span key={i} style={vars({ '--j': i })}>{ch}</span>)}</div>
        </div>
      </div>
    </>
  );
}
