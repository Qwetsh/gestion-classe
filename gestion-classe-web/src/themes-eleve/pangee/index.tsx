import { scatter, vars } from '../shared';
import { LAND, LANDS, fromPangaea } from './geo';
import './theme.css';

/**
 * Thème « Pangée » : la Terre d'il y a 250 millions d'années, dans un vieil atlas.
 * Plans, du fond vers l'avant : papier jauni quadrillé de méridiens et de parallèles ; l'en-tête de
 * la planche (la banderole « A. Wegener », à droite) ; le planisphère dans son cadre gradué, avec
 * son cartouche qui donne l'époque et, posée sur le coin, une tête d'Éole qui souffle ; le bas de
 * la planche (un liseré, une loupe, un encrier et sa plume), puis le papier uni.
 * La vedette est le planisphère : les continents (aplats bistre) dérivent très lentement de la
 * Pangée jusqu'à la carte d'aujourd'hui, puis reviennent, en boucle (36 s). Le cartouche suit
 * l'époque et une perle avance sur sa frise du temps ; des flèches montrent le sens de la dérive ;
 * la dorsale de l'Atlantique apparaît quand l'océan s'ouvre, et sa lave luit. Les mêmes fossiles
 * (Mesosaurus, fougère Glossopteris) sont posés sur plusieurs continents : rassemblés dans la
 * Pangée, ils forment des bandes continues, l'argument de Wegener.
 * Mouvement, sans que l'élève touche à rien : la dérive, un voilier dessiné à la plume qui croise
 * dans l'océan, les vagues gravées qui ondulent, la banderole qui flotte, la plume qui oscille dans
 * l'encrier. De temps en temps (toutes les 18 s), Éole gonfle les joues et souffle une rafale.
 * Au toucher : le planisphère (les continents se rassemblent d'un coup en Pangée, se cognent, puis
 * repartent à leur place), la loupe (elle survole la carte : dedans, un Mesosaurus nage vers le
 * large, voit l'océan trop profond et fait demi-tour), l'encrier (la plume en sort, une goutte
 * tombe et fait une tache en forme de Pangée, qui se fend en continents puis s'efface).
 */

/* ---------- Le planisphère ---------- */

/** Une bande continue de fossiles, repérée sur la Pangée, et le continent qui porte chaque point. */
const MESO: [string, number, number][] = [
  ['ams', 168, 116],
  ['ams', 172, 126],
  ['afr', 188, 112],
  ['afr', 190, 124],
];
const GLOSSO: [string, number, number][] = [
  ['ams', 176, 140],
  ['afr', 196, 134],
  ['ant', 206, 150],
  ['ind', 222, 132],
  ['aus', 236, 146],
];
const fossils = (list: [string, number, number][]) =>
  list.map(([id, x, y]) => {
    const [lx, ly] = fromPangaea(id, x, y);
    return { id, x: lx, y: ly };
  });
const MESO_AT = fossils(MESO);
const GLOSSO_AT = fossils(GLOSSO);

/** Flèches de dérive : posées au centre du continent, tournées vers sa place d'aujourd'hui. */
const ARROWS = ['amn', 'ams', 'ind', 'aus'].map((id) => {
  const l = LAND[id];
  return { id, x: l.cx, y: l.cy, ang: Math.round((Math.atan2(-l.dy, -l.dx) * 180) / Math.PI) };
});

/** La dorsale médio-atlantique, à sa place d'aujourd'hui ; dans la Pangée elle se referme. */
const RIDGE = 'M162 26C156 32 151 40 150 52C148 60 140 64 136 72C134 80 144 86 152 89C160 93 166 102 166 112C166 122 166 130 169 138C171 142 174 145 176 147';
const RIDGE_AT = { cx: 155, cy: 88, dx: (LAND.ams.dx + LAND.afr.dx) / 2 + 4, dy: (LAND.ams.dy + LAND.afr.dy) / 2, a: -10 };
const LAVA = [[150, 52], [138, 70], [153, 89], [166, 114], [169, 138]];

/** Vagues gravées dans l'océan. */
const WAVES = scatter(36, 13, (r, i) => ({
  x: ((i % 9) * 40 + r() * 26 + 6).toFixed(1),
  y: (Math.floor(i / 9) * 44 + r() * 30 + 8).toFixed(1),
}));

const landStyle = (dx: number, dy: number, a: number, sx: number, sy: number, cx: number, cy: number) =>
  vars({ '--dx': dx, '--dy': dy, '--a': a, '--sx': sx, '--sy': sy, transformOrigin: `${cx.toFixed(1)}px ${cy.toFixed(1)}px` });

function Mesosaurus() {
  return (
    <g>
      <path d="M-6 2L-10 7.5L-6.5 8.6M8 2L10 6.5L13 7" fill="none" stroke="#3E4A33" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-30 2Q-19 -3 -8 -4.2Q2 -5.6 10 -3.4Q14 -3.6 17 -3L28.5 -1.2L17 0.6Q12 2.2 8 2.6Q0 4.8 -9 3.6Q-20 3.4 -30 2Z" fill="#7F8F63" />
      <path d="M-30 2Q-19 -3 -8 -4.2Q2 -5.6 10 -3.4Q14 -3.6 17 -3L28.5 -1.2Q20 -2.4 15 -1.6Q8 -1 0 -1.8Q-14 -2.6 -30 2Z" fill="#5F6F48" />
      <path d="M17.5 -0.6L28 -1.1" stroke="#EDE6CC" strokeWidth="0.7" strokeDasharray="0.8 0.9" />
      <path d="M-4 3.4L-8 9L-3.6 10.2M10 2.4L13 7.6L16.4 8" fill="none" stroke="#5F6F48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14.6" cy="-1.9" r="1" fill="#1F2516" />
    </g>
  );
}

function Ship() {
  return (
    <g>
      <path d="M-4 -1V-21M4 -1V-17" stroke="#2E2416" strokeWidth="0.9" />
      <path d="M-9.5 -18.5Q-4 -15.5 1.5 -18.5L1.5 -8.5Q-4 -5.5 -9.5 -8.5Z" fill="#F7EEDA" stroke="#2E2416" strokeWidth="0.8" />
      <path d="M-1 -15Q4 -12.5 8.5 -15L8.5 -7Q4 -4.5 -1 -7Z" fill="#F7EEDA" stroke="#2E2416" strokeWidth="0.8" />
      <path d="M5 -16L13 -2.5L5 -3.2Z" fill="#EFE3C8" stroke="#2E2416" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M-8 -14Q-4 -12 0 -14M-8 -11Q-4 -9 0 -11M1 -11Q4 -9.5 7 -11" fill="none" stroke="#2E2416" strokeWidth="0.4" opacity="0.6" />
      <path d="M-4 -21L2 -19.6L-4 -18.2Z" fill="#A3391F" />
      <path d="M-14 -1.5H13.5L10 4.5H-10.5Z" fill="#6B4524" stroke="#2E2416" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M-11 1H11" stroke="#2E2416" strokeWidth="0.5" strokeDasharray="1.4 1.4" />
    </g>
  );
}

function Planisphere() {
  return (
    <svg className="pg-map" viewBox="-9 -9 378 198" width="315" height="165">
      <defs>
        <clipPath id="pg-ocean-clip"><rect x="0" y="0" width="360" height="180" /></clipPath>
      </defs>
      {/* Cadre gradué : bande des degrés en noir et blanc, entre deux filets */}
      <rect x="-8" y="-8" width="376" height="196" fill="#F6ECD4" stroke="#2E2416" strokeWidth="1.2" />
      <rect x="-3.5" y="-3.5" width="367" height="187" fill="none" stroke="#2E2416" strokeWidth="3" strokeDasharray="10 10" />
      <rect x="-5.5" y="-5.5" width="371" height="191" fill="none" stroke="#2E2416" strokeWidth="0.5" />
      <rect x="-1.5" y="-1.5" width="363" height="183" fill="none" stroke="#2E2416" strokeWidth="0.5" />
      <g data-tap="pangee" data-tap-ms="3800">
        <rect className="pg-ocean" x="0" y="0" width="360" height="180" />
        <g clipPath="url(#pg-ocean-clip)">
          <g className="pg-waves">
            {WAVES.map((w, i) => (
              <path key={i} d={`M${w.x} ${w.y}q2.5 -2.4 5 0t5 0`} />
            ))}
          </g>
          <g className="pg-grid">
            <path d="M30 0V180M60 0V180M90 0V180M120 0V180M150 0V180M210 0V180M240 0V180M270 0V180M300 0V180M330 0V180M0 30H360M0 60H360M0 120H360M0 150H360" />
            <path className="pg-grid__main" d="M180 0V180M0 90H360" />
            <path className="pg-grid__tropic" d="M0 66.6H360M0 113.4H360" />
          </g>
          <g className="pg-ship">
            <g className="pg-ship__turn">
              <g className="pg-ship__sway"><Ship /></g>
            </g>
          </g>
          <g className="pg-plate">
            {LANDS.map((l) => (
              <g key={l.id} className="pg-land" style={landStyle(l.dx, l.dy, l.a, l.sx, l.sy, l.cx, l.cy)}>
                <path className="pg-coast" d={l.d} />
              </g>
            ))}
            <g className="pg-land pg-ridge" style={landStyle(RIDGE_AT.dx, RIDGE_AT.dy, RIDGE_AT.a, 0.15, 1, RIDGE_AT.cx, RIDGE_AT.cy)}>
              <path className="pg-ridge__glow" d={RIDGE} />
              <path className="pg-ridge__line" d={RIDGE} />
              {LAVA.map(([x, y], i) => (
                <circle key={i} className="pg-lava" cx={x} cy={y} r="2.2" style={vars({ '--n': i })} />
              ))}
            </g>
            {LANDS.map((l) => (
              <g key={l.id} className="pg-land" style={landStyle(l.dx, l.dy, l.a, l.sx, l.sy, l.cx, l.cy)}>
                <path className="pg-ground" d={l.d} />
                {GLOSSO_AT.filter((g) => g.id === l.id).map((g, i) => (
                  <g key={`g${i}`} transform={`translate(${g.x.toFixed(1)} ${g.y.toFixed(1)})`}>
                    <g className="pg-upright pg-glosso">
                      <path d="M0 -4Q2.6 -1 1.6 2.2Q0.7 4 0 4.3Q-0.7 4 -1.6 2.2Q-2.6 -1 0 -4Z" />
                      <path className="pg-glosso__rib" d="M0 -3.2V4.6" />
                    </g>
                  </g>
                ))}
                {MESO_AT.filter((m) => m.id === l.id).map((m, i) => (
                  <g key={`m${i}`} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`}>
                    <g className="pg-upright pg-meso">
                      <path d="M-7.2 0.5Q-4.6 -0.7 -1.9 -1Q0.5 -1.3 2.4 -0.8Q3.4 -0.9 4.1 -0.7L6.8 -0.3L4.1 0.1Q2.9 0.5 1.9 0.6Q0 1.2 -2.2 0.9Q-4.8 0.8 -7.2 0.5Z" />
                      <path d="M-1.2 0.7L-2.2 2.2M2.2 0.5L2.9 1.9M-0.7 -0.8L-1.7 -2.1M2.4 -0.8L3.1 -2" />
                    </g>
                  </g>
                ))}
              </g>
            ))}
            {ARROWS.map((a) => (
              <g key={a.id} className="pg-land pg-arrowbox" style={landStyle(LAND[a.id].dx, LAND[a.id].dy, 0, 1, 1, a.x, a.y)}>
                <g transform={`translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`}>
                  <path className="pg-arrow" style={vars({ '--ang': `${a.ang}deg` })} d="M-9 0H5M1 -4L7 0L1 4" />
                </g>
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Le cartouche : l'époque, et la frise du temps où avance une perle. */
function Cartouche() {
  return (
    <svg className="pg-cart" viewBox="0 0 200 44" width="200" height="44">
      <path d="M14 4H186Q194 4 194 12V32Q194 40 186 40H14Q6 40 6 32V12Q6 4 14 4Z" fill="#FBF4E2" stroke="#2E2416" strokeWidth="1.2" />
      <path d="M15 7.5H185Q190.5 7.5 190.5 13V31Q190.5 36.5 185 36.5H15Q9.5 36.5 9.5 31V13Q9.5 7.5 15 7.5Z" fill="none" stroke="#7A4A1E" strokeWidth="0.6" />
      {/* Volutes des deux bouts */}
      <path d="M6 14Q0 14 0 20Q0 25 5 24Q8 23 6 20M194 14Q200 14 200 20Q200 25 195 24Q192 23 194 20M6 30Q0 30 1 35Q2 39 6 37M194 30Q200 30 199 35Q198 39 194 37" fill="none" stroke="#2E2416" strokeWidth="1" strokeLinecap="round" />
      <text className="pg-age pg-age--past" x="100" y="21.5">Il y a 250 millions d’années</text>
      <text className="pg-age pg-age--drift" x="100" y="21.5">Les continents dérivent</text>
      <text className="pg-age pg-age--now" x="100" y="21.5">Aujourd’hui</text>
      <path d="M40 30.5H160M40 28V33M64 29V32M88 29V32M112 29V32M136 29V32M160 28V33" stroke="#7A4A1E" strokeWidth="0.8" />
      <text className="pg-tick" x="35" y="33.2">250</text>
      <text className="pg-tick pg-tick--end" x="165" y="33.2">0</text>
      <circle className="pg-bead" cx="40" cy="30.5" r="2.8" />
    </svg>
  );
}

/* ---------- L'en-tête de la planche ---------- */

/** Tête d'Éole dans ses nuages, de profil, qui souffle vers la droite. */
function Aeolus() {
  return (
    <svg className="pg-aeolus" viewBox="0 0 80 60" width="80" height="60">
      <path d="M6 54Q-1 53 1 46Q3 40 10 42Q9 35 17 34Q20 28 27 31Q29 46 40 46Q46 50 44 55Q40 60 32 57Q26 61 19 57Q12 60 6 54Z" fill="#FBF4E2" stroke="#2E2416" strokeWidth="1" strokeLinejoin="round" />
      <path d="M9 49Q13 46 17 49M21 54Q25 51 29 54M14 41Q17 39 20 41" fill="none" stroke="#2E2416" strokeWidth="0.7" strokeLinecap="round" />
      <g className="pg-aeolus__face">
        <path d="M30 16Q24 13 20 18Q16 24 21 28Q17 32 21 37Q25 41 30 38L33 30Z" fill="#A8763E" stroke="#2E2416" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M30 16Q38 11 46 14Q52 17 53 23L57 25.5Q55.5 27 53.5 27.2Q58 30 57.5 33Q57 37 52 39Q46 43 38 42Q30 41 27 34Q25 26 30 16Z" fill="#EBCBA4" stroke="#2E2416" strokeWidth="0.9" strokeLinejoin="round" />
        <g className="pg-aeolus__cheek"><circle cx="46" cy="31.5" r="7" fill="#EEA586" opacity="0.85" /></g>
        <ellipse cx="58.6" cy="31" rx="1.9" ry="2.3" fill="#B8573E" stroke="#2E2416" strokeWidth="0.6" />
        <path d="M42 21.5Q45 23.6 48 21.5" fill="none" stroke="#2E2416" strokeWidth="1" strokeLinecap="round" />
        <path d="M41 18Q45 15.8 49.5 17.6" fill="none" stroke="#2E2416" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M30 16Q27 8 35 6Q40 2 46 5Q53 5 53 12Q50 10.5 47 12Q44 9 40 11Q36 9 33 13Z" fill="#A8763E" stroke="#2E2416" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M24 21Q22 24 24 26M23 31Q21 34 24 36M37 8Q40 7 42 9" fill="none" stroke="#2E2416" strokeWidth="0.6" strokeLinecap="round" />
      </g>
      <g className="pg-gust">
        <path d="M62 28Q74 26 88 31" />
        <path d="M62 31.5Q73 33 84 39" />
        <path d="M61 35Q68 40 76 45" />
      </g>
    </svg>
  );
}

/** Banderole au nom de Wegener, qui ondule. */
function Banner() {
  return (
    <svg className="pg-banner" viewBox="0 0 84 30" width="84" height="30">
      <path d="M2 10L10 8L8 14L10 21L2 22L5 15.5Z" fill="#C79A5E" stroke="#2E2416" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M82 10L74 8L76 14L74 21L82 22L79 15.5Z" fill="#C79A5E" stroke="#2E2416" strokeWidth="0.8" strokeLinejoin="round" />
      <path className="pg-banner__cloth" d="M9 6Q26 2 42 6Q58 10 75 6V19Q58 23 42 19Q26 15 9 19Z" fill="#E7CFA0" stroke="#2E2416" strokeWidth="0.9" />
      <text className="pg-banner__text" x="42" y="16.2">A. Wegener</text>
    </svg>
  );
}

/* ---------- Le bas de la planche ---------- */

function Loupe() {
  return (
    <svg className="pg-loupe" viewBox="-40 -40 80 80" width="80" height="80" data-tap="loupe" data-tap-ms="5600">
      <defs>
        <clipPath id="pg-lens-clip"><circle cx="0" cy="0" r="17" /></clipPath>
      </defs>
      <g className="pg-loupe__all">
        <path d="M-15 15L-33 33" stroke="#4A2A12" strokeWidth="8" strokeLinecap="round" />
        <path d="M-15 15L-33 33" stroke="#7B4A22" strokeWidth="5" strokeLinecap="round" />
        <path d="M-14.5 14.5L-19.5 19.5" stroke="#B88A3A" strokeWidth="7.5" />
        <circle cx="0" cy="0" r="17" className="pg-loupe__glass" />
        {/* Vue grossie : un rivage, l'eau peu profonde, puis le grand large */}
        <g clipPath="url(#pg-lens-clip)" className="pg-loupe__view">
          <rect x="-20" y="-20" width="40" height="40" fill="#CFE0D2" />
          <path d="M6 -20Q2 -8 8 0Q4 10 9 20H20V-20Z" fill="#6F97A0" />
          <path d="M10 -14q2 -1.5 4 0t4 0M9 -4q2 -1.5 4 0t4 0M12 6q2 -1.5 4 0t4 0M10 14q2 -1.5 4 0t4 0" fill="none" stroke="#DCEBE8" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M-20 -20H-14Q-11 -10 -14 0Q-10 10 -13 20H-20Z" fill="#B0804A" />
          <path d="M-14 -20Q-11 -10 -14 0Q-10 10 -13 20" fill="none" stroke="#5A3A1A" strokeWidth="0.8" />
          <g className="pg-swim">
            <g className="pg-swim__turn">
              <g transform="scale(0.36)"><Mesosaurus /></g>
            </g>
          </g>
        </g>
        <path className="pg-loupe__shine" d="M-11 -6Q-9 -11 -4 -12" />
        <circle cx="0" cy="0" r="17" fill="none" stroke="#2E2416" strokeWidth="1" />
        <circle cx="0" cy="0" r="18.6" fill="none" stroke="#B88A3A" strokeWidth="3.2" />
        <circle cx="0" cy="0" r="20.4" fill="none" stroke="#2E2416" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function Inkwell() {
  return (
    <svg className="pg-ink" viewBox="0 0 60 80" width="60" height="80" data-tap="encre" data-tap-ms="5200">
      <g className="pg-quill">
        <g className="pg-quill__sway">
          <path d="M30 60L44 6" stroke="#2E2416" strokeWidth="1" strokeLinecap="round" />
          <path d="M33 47Q32 30 40 12Q44 4 50 0Q50 12 47 24Q44 38 35 49Z" fill="#FBF4E2" stroke="#2E2416" strokeWidth="0.9" strokeLinejoin="round" />
          <path d="M36 40L46 30M37 34L47 22M39 27L48 15M41 20L49 9" stroke="#2E2416" strokeWidth="0.5" opacity="0.55" />
          <path d="M30 60L31.4 54.5L33 55Z" fill="#2E2416" />
        </g>
      </g>
      <path d="M17 52H43V58H17Z" fill="#3B2C1C" stroke="#1E160C" strokeWidth="0.8" />
      <path d="M8 64Q8 58 15 58H45Q52 58 52 64V74Q52 78 46 78H14Q8 78 8 74Z" fill="#2E2416" />
      <path d="M12 63Q12 61 15 61H24V75H15Q12 75 12 72Z" fill="#4B3A27" />
      <path d="M26 64H42V72H26Z" fill="#EFE3C8" stroke="#7A4A1E" strokeWidth="0.5" />
      <path d="M28.5 67H39.5M28.5 69.5H36" stroke="#7A4A1E" strokeWidth="0.7" />
      <g className="pg-drop"><path d="M0 -3.2Q2.2 0 2.2 1.2Q2.2 3.2 0 3.2Q-2.2 3.2 -2.2 1.2Q-2.2 0 0 -3.2Z" fill="#2E2416" /></g>
    </svg>
  );
}

/** La tache d'encre : la Pangée en petit, qui se fend en continents (au toucher de l'encrier). */
function Blot() {
  return (
    <svg className="pg-blot" viewBox="40 0 300 180" width="84" height="50">
      <g className="pg-blot__all">
        {LANDS.map((l) => (
          <path key={l.id} className="pg-land pg-blot__land" d={l.d} style={landStyle(l.dx, l.dy, l.a, l.sx, l.sy, l.cx, l.cy)} />
        ))}
      </g>
    </svg>
  );
}

export default function PangeeScene() {
  return (
    <>
      <div className="el-layer pg-paper" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer pg-head" style={vars({ top: '0px', '--k': 0.36, '--kx': 2 })}>
        <div className="pg-set">
          <Banner />
        </div>
      </div>

      <div className="el-layer pg-plan" style={vars({ top: '0px', '--k': 0.44, '--kx': 4 })}>
        <div className="pg-set">
          <div className="pg-clock">
            <div className="pg-gather">
              <Planisphere />
              <Cartouche />
            </div>
          </div>
          <Aeolus />
        </div>
      </div>

      <div className="el-layer pg-front" style={vars({ top: '210px', '--k': 0.72, '--kx': 9 })}>
        <div className="pg-set">
          <Blot />
          <Loupe />
          <Inkwell />
        </div>
      </div>
    </>
  );
}
