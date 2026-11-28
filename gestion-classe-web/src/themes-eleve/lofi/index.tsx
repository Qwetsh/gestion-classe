import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Lofi » : réviser au café-librairie, un soir de pluie.
 * Une collégienne dessinée pour l'application (bonnet, gros pull, écouteurs à fil) écrit dans son
 * carnet à une table, devant la grande vitrine du café ; dehors, la rue est floue sous la pluie.
 * Plans, du fond vers l'avant : la rue vue à travers la vitre (façades et fenêtres allumées en
 * taches, lampadaires, enseigne rose et ses reflets sur la chaussée mouillée, pluie) ; le mur du
 * café percé de la vitrine (cadre de bois, gouttes sur la vitre, rebord avec une plante grasse et
 * une bougie), le cadre au mur, la guirlande de petites lumières, la bibliothèque basse et son
 * tourne-disque ; la collégienne à sa table (carnet ouvert, tasse de chocolat chaud, deux livres),
 * puis le bois de la table devient un fond uni ; devant, deux plantes suspendues.
 * Mouvement, sans que l'élève touche à rien : la pluie tombe, des gouttes glissent sur la vitre en
 * laissant une traînée, des feux de voitures passent au loin en taches de couleur, les lumières de
 * la guirlande respirent doucement (sans clignoter), le vinyle tourne, la vapeur monte de la tasse,
 * le stylo écrit, la tête suit la musique ; une note s'envole parfois du tourne-disque. De temps en
 * temps : elle relève la tête vers la vitre et regarde la pluie (toutes les 13 s), un passant sous
 * un parapluie jaune traverse la rue (toutes les 21 s), une voiture passe et ses phares glissent
 * sur la vitrine (toutes les 29 s).
 * Au toucher : le carnet (« page » : elle lève la main, tourne la page, puis réécrit ses lignes),
 * la tasse (« gorgee » : elle porte la tasse à ses lèvres, ferme les yeux, et un petit nuage de
 * vapeur s'envole), le tourne-disque (« face » : le bras se lève, le disque monte et se retourne,
 * redescend, le bras revient et une note s'envole).
 * Personnage et lieu sont propres à l'application : aucun casque, aucune écharpe, aucun chat, et
 * on la voit de face, à une table de café, pas dans une chambre.
 */

/** Pluie dehors, dans le cadre de la vitrine. */
const RAIN = scatter(24, 31, (r) => ({
  x: `${(r() * 112 - 6).toFixed(1)}%`,
  h: `${Math.round(r() * 8 + 10)}px`,
  d: `${(r() * 0.35 + 0.65).toFixed(2)}s`,
  delay: `${(-r() * 1.2).toFixed(2)}s`,
  o: (r() * 0.3 + 0.25).toFixed(2),
}));

/** Gouttes posées sur la vitre. */
const BEADS = scatter(20, 47, (r) => ({
  x: `${(r() * 96 + 2).toFixed(1)}%`,
  y: `${(r() * 92 + 4).toFixed(1)}%`,
  s: `${(r() * 2.6 + 2.2).toFixed(1)}px`,
}));

/** Gouttes qui glissent en laissant une traînée. */
const RUNS = scatter(8, 13, (r, i) => ({
  x: `${(i * 12 + r() * 8 + 3).toFixed(1)}%`,
  s: `${(r() * 1.6 + 3.6).toFixed(1)}px`,
  d: `${(r() * 4 + 6).toFixed(1)}s`,
  delay: `${(-r() * 10).toFixed(1)}s`,
}));

/** Couleurs des taches de lumière floues de la rue. */
const BOKEH_COLORS = ['#FFD79A', '#F5B489', '#F28FB0', '#8FD3C8'];
const BOKEH = scatter(11, 71, (r) => ({
  cx: Math.round(200 + r() * 232),
  cy: Math.round(52 + r() * 80),
  r: +(r() * 5 + 4).toFixed(1),
  c: Math.floor(r() * 4),
  d: `${(r() * 4 + 6).toFixed(1)}s`,
  delay: `${(-r() * 8).toFixed(1)}s`,
}));

/** La guirlande : deux arcs (courbes du second degré), une ampoule tous les sixièmes d'arc. */
const SWAGS: [number, number, number, number, number, number][] = [
  [-12, 4, 110, 40, 230, 8],
  [230, 8, 352, 44, 492, 6],
];
const BULB_COLORS = ['#FFD38A', '#F5B489', '#FFB3A1', '#FFE2B0'];
const BULBS = SWAGS.flatMap(([x0, y0, cx, cy, x1, y1], s) =>
  [1, 2, 3, 4, 5, 6].map((k) => {
    const t = (k - 0.5) / 6;
    const u = 1 - t;
    return {
      x: +(u * u * x0 + 2 * u * t * cx + t * t * x1).toFixed(1),
      y: +(u * u * y0 + 2 * u * t * cy + t * t * y1).toFixed(1),
      c: BULB_COLORS[(k + s * 2) % 4],
      delay: `${(-((k * 1.7 + s * 2.3) % 5)).toFixed(1)}s`,
    };
  }),
);
const GARLAND = SWAGS.map(([x0, y0, cx, cy, x1, y1]) => `M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`).join('');

type Book = [x: number, w: number, h: number, color: string, tilt: number];
/** Livres de la bibliothèque basse. */
const BOOKS_TOP: Book[] = [
  [38, 7, 28, '#C98B6B', 0], [45, 6, 24, '#8FB3A6', 0], [51, 8, 30, '#E3C17A', 0], [59, 5, 22, '#B7798F', 0],
  [64, 7, 27, '#6F86A8', 0], [72, 6, 25, '#E8DCC8', -12], [98, 8, 29, '#9C6B8C', 0], [106, 6, 26, '#D9A04A', 0],
  [112, 7, 23, '#7FA88E', 0], [119, 9, 30, '#C7816B', 0], [128, 5, 25, '#E8DCC8', 0], [133, 7, 28, '#6F86A8', 0],
];
const BOOKS_LOW: Book[] = [
  [38, 8, 30, '#6F86A8', 0], [46, 6, 27, '#E3C17A', 0], [52, 7, 31, '#B7798F', 0], [59, 9, 26, '#8FB3A6', 0],
  [86, 7, 29, '#C98B6B', 0], [93, 6, 31, '#E8DCC8', 0], [99, 8, 27, '#9C6B8C', 0], [107, 6, 30, '#D9A04A', 0],
  [113, 7, 25, '#7FA88E', 10],
];

function Books({ list, base }: { list: Book[]; base: number }) {
  return (
    <>
      {list.map(([x, w, h, c, tilt], i) => (
        <g key={i} transform={tilt ? `rotate(${tilt} ${x + (tilt < 0 ? w : 0)} ${base})` : undefined}>
          <rect x={x} y={base - h} width={w} height={h} rx="1" fill={c} />
          <path d={`M${x + 1} ${base - h + 4}h${w - 2}M${x + 1} ${base - 5}h${w - 2}`} stroke="#1C1724" strokeOpacity="0.28" strokeWidth="1" />
        </g>
      ))}
    </>
  );
}

/** Une liane de plante suspendue : tige et feuilles en cœur. */
function Vine({ d, leaves }: { d: string; leaves: [number, number, number][] }) {
  return (
    <>
      <path d={d} fill="none" stroke="#4E7F5C" strokeWidth="1.4" strokeLinecap="round" />
      {leaves.map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d="M0 0C-5 -1 -7 4 -4 8C-2 10 0 11 0 12C0 11 2 10 4 8C7 4 5 -1 0 0Z" fill={i % 2 ? '#78B386' : '#5E9A6E'} />
          <path d="M0 1V10" stroke="#3F6E4B" strokeWidth="0.7" />
        </g>
      ))}
    </>
  );
}

/** Une ligne d'écriture du carnet. */
const lineRow = (x0: number, x1: number, y: number) => `M${x0} ${y}H${x1}`;
const RIGHT_LINES: [number, number, number][] = [[200, 222, 198], [200, 224, 202], [200, 225, 206], [200, 218, 210]];

export default function LofiScene() {
  return (
    <>
      {/* ---- La rue, derrière la vitre ---- */}
      <div className="el-layer lf-street" style={vars({ top: '0px', '--k': 0.3, '--kx': 1 })}>
        <div className="lf-set">
          <svg viewBox="0 0 480 240" width="480">
            <defs>
              <radialGradient id="lf-glow-lamp"><stop offset="0" stopColor="#FFD79A" stopOpacity="0.75" /><stop offset="1" stopColor="#FFD79A" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-glow-pink"><stop offset="0" stopColor="#F28FB0" stopOpacity="0.6" /><stop offset="1" stopColor="#F28FB0" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-glow-white"><stop offset="0" stopColor="#FFF6E2" stopOpacity="0.95" /><stop offset="0.35" stopColor="#FFF0D0" stopOpacity="0.5" /><stop offset="1" stopColor="#FFF0D0" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-glow-red"><stop offset="0" stopColor="#FF7A6B" stopOpacity="0.9" /><stop offset="1" stopColor="#FF7A6B" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-glow-amber"><stop offset="0" stopColor="#FFC37A" stopOpacity="0.9" /><stop offset="1" stopColor="#FFC37A" stopOpacity="0" /></radialGradient>
              {BOKEH_COLORS.map((c, i) => (
                <radialGradient key={c} id={`lf-bokeh-${i}`}><stop offset="0.55" stopColor={c} stopOpacity="0.55" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
              ))}
              <linearGradient id="lf-refl-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F28FB0" stopOpacity="0.5" /><stop offset="1" stopColor="#F28FB0" stopOpacity="0" /></linearGradient>
              <linearGradient id="lf-refl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD79A" stopOpacity="0.45" /><stop offset="1" stopColor="#FFD79A" stopOpacity="0" /></linearGradient>
            </defs>
            {/* Façades d'en face, fenêtres allumées en taches */}
            <path d="M176 120V48h56v-6h10v6h48v14h52V36h50v18h68V44h30v76Z" fill="#2F2848" />
            <path d="M232 120V62h58v58ZM382 120V54h62v66Z" fill="#352D52" />
            {[[190, 60], [210, 60], [190, 84], [246, 74], [266, 96], [306, 50], [326, 50], [346, 72], [392, 66], [412, 66], [430, 88], [454, 58]].map(([x, y], i) => (
              <rect key={i} x={x} y={y} width="9" height="11" rx="2.5" fill={i % 3 ? '#F6C982' : '#F5B489'} opacity={i % 4 ? 0.32 : 0.18} />
            ))}
            {/* Boutique d'en face : vitrine chaude et enseigne rose (sans texte, floue) */}
            <rect x="300" y="94" width="72" height="26" rx="2" fill="#F3B98E" opacity="0.22" />
            <path d="M296 92h80l-4 6h-72Z" fill="#4A3D66" />
            <ellipse cx="336" cy="84" rx="40" ry="16" fill="url(#lf-glow-pink)" />
            <rect x="314" y="80" width="44" height="9" rx="4.5" fill="#F7A3C0" opacity="0.85" />
            {/* Trottoir, chaussée mouillée et ses reflets */}
            <rect x="160" y="119" width="320" height="6" fill="#3A3152" />
            <rect x="160" y="125" width="320" height="60" fill="#231D34" />
            <rect x="326" y="125" width="20" height="50" fill="url(#lf-refl-pink)" />
            <rect x="247" y="125" width="10" height="46" fill="url(#lf-refl-gold)" />
            <rect x="403" y="125" width="10" height="46" fill="url(#lf-refl-gold)" />
            <path d="M160 152h320" stroke="#3A3152" strokeWidth="1.2" strokeDasharray="14 12" />
            {/* Lampadaires */}
            {[252, 408].map((x) => (
              <g key={x}>
                <rect x={x - 1.5} y="52" width="3" height="68" fill="#1C182C" />
                <path d={`M${x - 6} 52h12l-3 -5h-6Z`} fill="#1C182C" />
                <circle cx={x} cy="54" r="26" fill="url(#lf-glow-lamp)" />
                <circle cx={x} cy="53.5" r="2.6" fill="#FFE9C2" />
              </g>
            ))}
            {/* Taches de lumière floues */}
            {BOKEH.map((b, i) => (
              <circle key={i} className="lf-bokeh" cx={b.cx} cy={b.cy} r={b.r} fill={`url(#lf-bokeh-${b.c})`} style={vars({ '--d': b.d, '--delay': b.delay })} />
            ))}
            {/* Feux de voitures au loin, qui passent en taches */}
            <g className="lf-car lf-car--a"><circle cx="0" cy="142" r="6" fill="url(#lf-glow-red)" /><circle cx="14" cy="142" r="6" fill="url(#lf-glow-red)" /></g>
            <g className="lf-car lf-car--b"><circle cx="0" cy="148" r="7" fill="url(#lf-glow-white)" /><circle cx="16" cy="148" r="7" fill="url(#lf-glow-white)" /></g>
            <g className="lf-car lf-car--c"><circle cx="0" cy="137" r="5" fill="url(#lf-glow-amber)" /><circle cx="12" cy="137" r="5" fill="url(#lf-glow-amber)" /></g>
            {/* De temps en temps : un passant sous son parapluie */}
            <g className="lf-walker">
              <g className="lf-walker__bob">
                <path className="lf-leg lf-leg--a" d="M-1.5 -11L-2.5 0" stroke="#1A1628" strokeWidth="2.4" strokeLinecap="round" />
                <path className="lf-leg lf-leg--b" d="M1.5 -11L2.5 0" stroke="#1A1628" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M-4.5 -23Q0 -25 4.5 -23L5.5 -10H-5.5Z" fill="#241E36" />
                <circle cx="0" cy="-26" r="3" fill="#241E36" />
                <path d="M2 -21L3 -31" stroke="#1A1628" strokeWidth="1.2" />
                <path d="M-14 -31Q-13 -43 3 -44Q19 -43 20 -31Q17 -33 14.5 -31Q11.5 -33 8.5 -31Q5.5 -33 3 -31Q0 -33 -2.5 -31Q-5.5 -33 -8.5 -31Q-11.5 -33 -14 -31Z" fill="#E2A84C" />
                <path d="M3 -44V-46.5" stroke="#E2A84C" strokeWidth="1.4" />
              </g>
            </g>
            {/* De temps en temps : une voiture, phares allumés */}
            <g className="lf-carpass">
              <path d="M-36 152Q-34 142 -22 140L-12 133H8L18 140Q26 141 28 146L28 152Z" fill="#1A1628" opacity="0.8" />
              <circle cx="27" cy="146" r="14" fill="url(#lf-glow-white)" />
              <circle cx="20" cy="147" r="10" fill="url(#lf-glow-white)" />
            </g>
          </svg>
          <div className="lf-rain">
            {RAIN.map((d, i) => (
              <span key={i} style={vars({ '--x': d.x, '--h': d.h, '--d': d.d, '--delay': d.delay, '--o': d.o })} />
            ))}
          </div>
        </div>
      </div>

      {/* ---- Le café : mur, vitrine, guirlande, bibliothèque et tourne-disque ---- */}
      <div className="el-layer lf-room" style={vars({ top: '0px', '--k': 0.45, '--kx': 3 })}>
        <div className="lf-set">
          <div className="lf-glass">
            <span className="lf-sweep" />
            {BEADS.map((b, i) => (
              <span key={i} className="lf-bead" style={vars({ '--x': b.x, '--y': b.y, '--s': b.s })} />
            ))}
            {RUNS.map((b, i) => (
              <span key={i} className="lf-run" style={vars({ '--x': b.x, '--s': b.s, '--d': b.d, '--delay': b.delay })} />
            ))}
          </div>
          <svg viewBox="0 0 480 240" width="480">
            <defs>
              <radialGradient id="lf-wallglow" cx="0.2" cy="0.3" r="0.7"><stop offset="0" stopColor="#F5B489" stopOpacity="0.16" /><stop offset="1" stopColor="#F5B489" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-bulbglow"><stop offset="0" stopColor="#FFD38A" stopOpacity="0.7" /><stop offset="1" stopColor="#FFD38A" stopOpacity="0" /></radialGradient>
              <radialGradient id="lf-flame"><stop offset="0" stopColor="#FFD38A" stopOpacity="0.6" /><stop offset="1" stopColor="#FFD38A" stopOpacity="0" /></radialGradient>
            </defs>
            <rect x="-40" y="-20" width="560" height="220" fill="url(#lf-wallglow)" />
            {/* Cadre de la vitrine : bois sombre, montant, imposte, rebord */}
            <path fillRule="evenodd" d="M188 4H444V178H188ZM196 12V172H436V12Z" fill="#5B3C3E" />
            <path fillRule="evenodd" d="M193 9H439V175H193ZM196 12V172H436V12Z" fill="#6E4A48" />
            <rect x="313" y="12" width="6" height="160" fill="#5B3C3E" />
            <rect x="196" y="40" width="240" height="5" fill="#5B3C3E" />
            <rect x="314.5" y="12" width="1.5" height="160" fill="#7A5452" />
            {/* Motif peint à l'or sur l'imposte : une tasse et un livre ouvert */}
            <g fill="none" stroke="#E9B66C" strokeWidth="1.3" strokeLinecap="round" opacity="0.85">
              <path d="M238 22h12v8q0 5 -6 5q-6 0 -6 -5Z" />
              <path d="M250 24.5q4 0 4 3t-4 3" />
              <path d="M241 19q-1.5 -2 0 -4M245 19q-1.5 -2 0 -4" />
              <path d="M260 34q6 -3 11 0v-12q-5 -3 -11 0ZM271 34q6 -3 11 0v-12q-5 -3 -11 0Z" />
            </g>
            <path d="M184 170H448V176H184Z" fill="#8A6250" />
            <path d="M186 176H446V181H186Z" fill="#5E3F35" />
            {/* Sur le rebord : une plante grasse, une bougie dans un verre */}
            <path d="M296 170l2 -9h14l2 9Z" fill="#C77B5A" />
            <path d="M305 161c-6 -2 -9 -8 -7 -12c4 1 7 5 7 12ZM305 161c6 -2 9 -8 7 -12c-4 1 -7 5 -7 12ZM305 161c-2 -6 -1 -12 0 -15c1 3 2 9 0 15Z" fill="#7FB08C" />
            <circle cx="418" cy="160" r="16" fill="url(#lf-flame)" className="lf-candleglow" />
            <rect x="411" y="158" width="14" height="12" rx="2" fill="#F0D9C0" opacity="0.55" />
            <rect x="413" y="161" width="10" height="8" rx="1" fill="#F7E7D2" />
            <path className="lf-flame" d="M418 151q3 4 0 8q-3 -4 0 -8Z" fill="#FFC56B" />
            {/* Cadre au mur : une lune et des collines */}
            <rect x="64" y="28" width="56" height="44" rx="2" fill="#8A5E48" />
            <rect x="68" y="32" width="48" height="36" fill="#F1E2CC" />
            <rect x="72" y="36" width="40" height="28" fill="#3E3560" />
            <path d="M72 64v-9q8 -6 15 -2q8 -7 25 2v9Z" fill="#7FA88E" />
            <path d="M72 64v-4q12 -5 22 -1q9 -3 18 1v4Z" fill="#5E8C74" />
            <circle cx="101" cy="45" r="5" fill="#F5B489" />
            <circle cx="103.5" cy="43.5" r="4.4" fill="#3E3560" />
            {/* Guirlande : fil, ampoules et leur halo qui respire */}
            <path d={GARLAND} fill="none" stroke="#2A1E26" strokeWidth="1.2" />
            {BULBS.map((b, i) => (
              <g key={i}>
                <circle className="lf-halo" cx={b.x} cy={b.y + 6} r="10" fill="url(#lf-bulbglow)" style={vars({ '--delay': b.delay })} />
                <rect x={b.x - 1.4} y={b.y} width="2.8" height="2.6" fill="#2A1E26" />
                <ellipse cx={b.x} cy={b.y + 5.6} rx="2.4" ry="3.2" fill={b.c} />
                <circle cx={b.x - 0.7} cy={b.y + 4.6} r="0.8" fill="#FFFFFF" opacity="0.7" />
              </g>
            ))}
            {/* Bibliothèque basse */}
            <rect x="30" y="112" width="124" height="90" fill="#4E332F" />
            <rect x="36" y="120" width="112" height="76" fill="#2A1E26" />
            <rect x="28" y="110" width="128" height="6" rx="1" fill="#7A5140" />
            <rect x="28" y="116" width="128" height="3" fill="#5E3F35" />
            <rect x="36" y="150" width="112" height="4" fill="#5E3F35" />
            <Books list={BOOKS_TOP} base={150} />
            {/* Des disques rangés debout entre les livres */}
            <rect x="81" y="122" width="13" height="28" fill="#E3C17A" />
            <rect x="84" y="124" width="12" height="26" fill="#3E3560" />
            <circle cx="90" cy="137" r="3" fill="#F5B489" />
            <Books list={BOOKS_LOW} base={186} />
            <rect x="122" y="160" width="22" height="26" rx="1" fill="#8FB3A6" />
            <rect x="124" y="164" width="18" height="22" fill="#2F4C5A" />
            <circle cx="133" cy="175" r="5" fill="#E8DCC8" opacity="0.7" />
            {/* Le tourne-disque */}
            <path d="M44 104h96v8H44Z" fill="#4B3030" />
            <circle cx="56" cy="108" r="1.6" fill="#E3C17A" /><circle cx="63" cy="108" r="1.6" fill="#C9C2CC" />
            <path d="M48 90H136L140 104H44Z" fill="#8A5A45" />
            <path d="M48 90H136L137 93H47Z" fill="#9C6A52" />
            <ellipse cx="84" cy="97.5" rx="31" ry="7.6" fill="#3A3240" />
            <g className="lf-disc">
              <g transform="translate(84 96.5) scale(1 0.26)">
                <g className="lf-spin">
                  <circle r="28" fill="#17131C" />
                  <circle r="24" fill="none" stroke="#2E2836" strokeWidth="1.4" />
                  <circle r="19.5" fill="none" stroke="#2E2836" strokeWidth="1.4" />
                  <circle r="15" fill="none" stroke="#2E2836" strokeWidth="1.4" />
                  <circle r="9" fill="#F5B489" />
                  <path d="M0 -9A9 9 0 0 1 0 9Z" fill="#E08A66" />
                  <circle r="1.4" fill="#17131C" />
                </g>
                <path d="M-22 -14A26 26 0 0 1 8 -25" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
              </g>
            </g>
            <g className="lf-arm-tone">
              <path d="M126 93L112 95.5L104 99" fill="none" stroke="#D8D0D8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M101.5 98l4 -1.6l1 2.4l-4 1.4Z" fill="#E8E2E8" />
            </g>
            <circle cx="126" cy="93" r="3.4" fill="#C9C2CC" />
            <circle cx="126" cy="93" r="1.4" fill="#8A8290" />
            {/* Notes qui s'envolent : de temps en temps, et au toucher */}
            <g className="lf-note" fill="#F5B489">
              <path d="M117.6 83.6V74.6L124 73V82" fill="none" stroke="#F5B489" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M117.6 74.6L124 73V75.4L117.6 77Z" />
              <ellipse cx="115.8" cy="84" rx="2.3" ry="1.7" transform="rotate(-20 115.8 84)" />
              <ellipse cx="122.2" cy="82.4" rx="2.3" ry="1.7" transform="rotate(-20 122.2 82.4)" />
            </g>
            <g className="lf-note-tap" fill="#FFD38A">
              <path d="M98.4 82V71.5Q99 74.5 102.6 76" fill="none" stroke="#FFD38A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <ellipse cx="96.2" cy="82.4" rx="2.7" ry="2" transform="rotate(-20 96.2 82.4)" />
            </g>
            {/* Zone du toucher sur le tourne-disque */}
            <rect x="44" y="80" width="100" height="34" fill="transparent" data-tap="face" data-tap-ms="3600" />
          </svg>
        </div>
      </div>

      {/* ---- La collégienne à sa table ---- */}
      <div className="el-layer lf-table" style={vars({ top: '0px', '--k': 0.62, '--kx': 6 })}>
        <div className="lf-set">
          <svg viewBox="0 0 480 240" width="480">
            {/* Le pull (le bas du corps est caché par la table), le cou */}
            <rect x="191" y="134" width="10" height="12" fill="#C98E6C" />
            <path d="M164 192C163 172 165 158 172 151Q180 145 190 144H202Q212 145 220 151C227 158 229 172 228 192Z" fill="#6E9A8A" />
            <path d="M202 144Q212 145 220 151C227 158 229 172 228 192H210C212 172 210 156 202 144Z" fill="#628C7D" />
            <path d="M188 152l-3 5l3 5l-3 5l3 5l-3 5l3 5l-3 5M204 152l3 5l-3 5l3 5l-3 5l3 5l-3 5l3 5" fill="none" stroke="#85AF9F" strokeWidth="1.5" strokeLinejoin="round" />
            {/* Le fil des écouteurs descend du col */}
            <path d="M198 148C199 160 205 170 204 192" fill="none" stroke="#F3E6DA" strokeWidth="0.9" />
            {/* La tête : elle suit la musique, et regarde la vitre de temps en temps */}
            <g className="lf-head-look">
              <g className="lf-head">
                <path d="M178 110C175 122 175 134 179 141Q184 144 190 140H202Q208 144 213 141C217 134 217 122 214 110Z" fill="#3A2420" />
                <ellipse cx="181" cy="124.5" rx="3" ry="4" fill="#DDA07C" />
                <ellipse cx="211" cy="124.5" rx="3" ry="4" fill="#DDA07C" />
                <ellipse cx="196.5" cy="123" rx="14.5" ry="16" fill="#E7AE88" />
                {/* Écouteurs à fil, petits et blancs */}
                <path d="M182 128C183 134 186 138 192 141M211 128C210 134 206 138 200 141" fill="none" stroke="#F3E6DA" strokeWidth="1" />
                <circle cx="181.6" cy="126" r="2.4" fill="#FBF4EC" />
                <circle cx="211.2" cy="126" r="2.4" fill="#FBF4EC" />
                {/* Mèches sur les côtés et frange sous le bonnet */}
                <path d="M180 108C178 118 178 128 181 136C184 128 185 118 186 111Z" fill="#3A2420" />
                <path d="M213 108C215 118 215 128 212 136C209 128 208 118 207 111Z" fill="#3A2420" />
                <path d="M182 108C186 117 193 116 196 112C200 117 207 117 211 108Z" fill="#3A2420" />
                {/* Visage : les yeux baissés sur le carnet, ouverts vers la vitre, fermés pour boire */}
                <path d="M186.5 117.5q3.5 -1.8 7 -0.4M199.5 117.1q3.5 -1.4 7 0.4" fill="none" stroke="#4A2C24" strokeWidth="1.2" strokeLinecap="round" />
                <g className="lf-eyes-down">
                  <path d="M189.2 123.4a2.1 1.9 0 0 0 4 0ZM201.4 123.4a2.1 1.9 0 0 0 4 0Z" fill="#2B1A1A" />
                  <path d="M187.6 123.6q3.6 -1.8 7.2 0M199.8 123.6q3.6 -1.8 7.2 0" fill="none" stroke="#2B1A1A" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M187.8 123.6l-1.5 -0.6M206.8 123.6l1.5 -0.6" fill="none" stroke="#2B1A1A" strokeWidth="1" strokeLinecap="round" />
                </g>
                <g className="lf-eyes-up">
                  <ellipse cx="192" cy="122.6" rx="2.1" ry="2.7" fill="#2B1A1A" />
                  <ellipse cx="204.2" cy="122.6" rx="2.1" ry="2.7" fill="#2B1A1A" />
                  <circle cx="192.8" cy="121.6" r="0.8" fill="#FFFFFF" />
                  <circle cx="205" cy="121.6" r="0.8" fill="#FFFFFF" />
                </g>
                <g className="lf-eyes-shut" fill="none" stroke="#2B1A1A" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M187.5 124.5q3.3 -2.6 6.6 0M199.5 124.5q3.3 -2.6 6.6 0" />
                </g>
                <ellipse cx="186.5" cy="130" rx="3.2" ry="2" fill="#F08A78" opacity="0.5" />
                <ellipse cx="207" cy="130" rx="3.2" ry="2" fill="#F08A78" opacity="0.5" />
                <path d="M197.6 125.5q1.6 2.6 -0.6 3.2" fill="none" stroke="#C47F62" strokeWidth="1" strokeLinecap="round" />
                <path d="M194.2 133q2.8 2 5.6 0" fill="none" stroke="#A64F47" strokeWidth="1.3" strokeLinecap="round" />
                {/* Le bonnet en grosse maille, son pompon */}
                <path d="M179 108C179 92 187 84.5 196.5 84.5C206 84.5 214 92 214 108Z" fill="#D9A04A" />
                <path d="M188 106C188 96 190 90 193 87M196.5 106V86M205 106C205 96 203 90 200 87" fill="none" stroke="#E7B562" strokeWidth="1.3" strokeLinecap="round" />
                <rect x="177" y="103" width="39" height="10" rx="5" fill="#C48A36" />
                <path d="M182 104.5v7M186 104.5v7M190 104.5v7M194 104.5v7M198 104.5v7M202 104.5v7M206 104.5v7M210 104.5v7" stroke="#B07A2C" strokeWidth="1.1" strokeLinecap="round" />
                <circle cx="196.5" cy="82" r="6.4" fill="#F4E4CE" />
                <path d="M193 80l1.4 1.4M198 79l1 1.6M195 84.5l1.4 0.6M199.6 83l1 1.2" stroke="#DCC7AC" strokeWidth="1" strokeLinecap="round" />
              </g>
            </g>
            {/* Le col roulé, par-dessus le cou */}
            <path d="M183 141Q196 149 210 141L213 147Q196 156 180 147Z" fill="#82AD9D" />
            <path d="M187 144l-1 4M192 146l-0.6 4M197 146.5v4M202 146l0.6 4M207 144l1 4" stroke="#6E9A8A" strokeWidth="1.1" strokeLinecap="round" />

            {/* La table : plateau de bois (prolongé sur les côtés par le plan lui-même) */}
            <rect x="-60" y="186" width="600" height="36" fill="#6A4535" />
            <path d="M-60 196H540M-60 209H540" stroke="#77503F" strokeWidth="1.2" />
            <rect x="-60" y="186" width="600" height="2" fill="#80584A" />
            <rect x="-60" y="222" width="600" height="9" fill="#4E3128" />

            {/* Deux livres empilés, au bout de la table */}
            <path d="M302 210l4 -10h44l4 10Z" fill="#6F86A8" />
            <path d="M302 210h52v3h-52Z" fill="#E8DCC8" />
            <path d="M306 202l3 -8h36l3 8Z" fill="#C98B6B" />
            <path d="M306 202h42v2.6h-42Z" fill="#E8DCC8" />
            <path d="M318 196.5h16" stroke="#F5D5B0" strokeWidth="1.2" />

            {/* Le carnet ouvert */}
            <g className="lf-notebook">
              <path d="M163 193H230L236 216H157Z" fill="#8C5A6B" />
              <path d="M166 194H196V214H160Z" fill="#F7EBD9" />
              <path d="M196 194H226L232 214H196Z" fill="#F2E3CE" />
              <path d={[lineRow(170, 192, 198), lineRow(168, 192, 202), lineRow(167, 190, 206), lineRow(165, 186, 210)].join('')} stroke="#9C8FA8" strokeWidth="1.1" strokeLinecap="round" />
              <g className="lf-relines" stroke="#9C8FA8" strokeWidth="1.1" strokeLinecap="round">
                {RIGHT_LINES.map(([x0, x1, y]) => <path key={y} d={lineRow(x0, x1, y)} />)}
              </g>
              <path d="M196 193.6V214.4" stroke="#C9B7A2" strokeWidth="1" />
              {/* La feuille qui se tourne */}
              <g className="lf-leaf">
                <path d="M196 194H226L232 214H196Z" fill="#F2E3CE" />
                <path d={RIGHT_LINES.map(([x0, x1, y]) => lineRow(x0, x1, y)).join('')} stroke="#9C8FA8" strokeWidth="1.1" strokeLinecap="round" />
                <path className="lf-leaf__shade" d="M196 194H226L232 214H196Z" fill="#5A3B4A" />
              </g>
            </g>

            {/* Le bras droit (à gauche) : le stylo écrit */}
            <path d="M171 152Q162 166 158 186" fill="none" stroke="#6E9A8A" strokeWidth="12" strokeLinecap="round" />
            <g className="lf-write">
              <path d="M158 186L188 202" stroke="#6E9A8A" strokeWidth="11" strokeLinecap="round" />
              <path d="M184 199.6L190 203" stroke="#85AF9F" strokeWidth="11" strokeLinecap="round" />
              <path d="M200 208L189 191" stroke="#3E3A60" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M200 208l1 1.6" stroke="#1C1724" strokeWidth="1.4" strokeLinecap="round" />
              <ellipse cx="195" cy="204" rx="4.6" ry="3.8" fill="#E7AE88" />
              <path d="M192 202.6q3 -1.4 5.6 0.4" fill="none" stroke="#C98E6C" strokeWidth="0.8" />
            </g>

            {/* Vapeur du chocolat (cachée pendant la gorgée) */}
            <g className="lf-steam" fill="none" stroke="#FBF1E6" strokeWidth="1.8" strokeLinecap="round">
              <path d="M261 178c-3 -4 3 -6 0 -10c-3 -4 3 -6 0 -10" />
              <path d="M266 177c-3 -4 3 -6 0 -10c-3 -4 3 -6 0 -10" />
              <path d="M271 178c-3 -4 3 -6 0 -10c-3 -4 3 -6 0 -10" />
            </g>

            {/* Le bras gauche (à droite) et la tasse de chocolat chaud */}
            <g className="lf-arm">
              <path d="M222 152L228 184" stroke="#628C7D" strokeWidth="12" strokeLinecap="round" />
              <g className="lf-fore">
                <path d="M228 184L249 190" stroke="#6E9A8A" strokeWidth="11" strokeLinecap="round" />
                <path d="M245 188.8L250 190.4" stroke="#85AF9F" strokeWidth="11" strokeLinecap="round" />
                <g className="lf-mug">
                  <path d="M271 185q6 0 6 5t-6 5" fill="none" stroke="#E9D3BA" strokeWidth="2.6" />
                  <rect x="257" y="181" width="15" height="17" rx="3" fill="#F4E3CF" />
                  <rect x="257" y="188" width="15" height="4" fill="#F5B489" />
                  <ellipse cx="264.5" cy="182" rx="7.5" ry="2" fill="#E9D3BA" />
                  <ellipse cx="264.5" cy="182.2" rx="6.2" ry="1.5" fill="#6B3B2A" />
                </g>
                <ellipse cx="254" cy="191" rx="4.6" ry="4.2" fill="#E7AE88" />
                <path d="M255.5 188.5q2.4 1.4 2.4 4.6" fill="none" stroke="#C98E6C" strokeWidth="0.8" />
              </g>
            </g>
            {/* Le petit nuage de vapeur, après la gorgée */}
            <g className="lf-puff" fill="#FBF1E6">
              <circle cx="212" cy="124" r="4" /><circle cx="217" cy="121" r="5" /><circle cx="222" cy="124" r="3.6" />
              <rect x="210" y="124" width="14" height="3.6" rx="1.8" />
            </g>

            {/* Zones du toucher : le carnet, la tasse */}
            <rect x="156" y="190" width="82" height="28" fill="transparent" data-tap="page" data-tap-ms="4600" />
            <rect x="246" y="164" width="38" height="38" fill="transparent" data-tap="gorgee" data-tap-ms="4200" />
          </svg>
        </div>
      </div>

      {/* ---- Devant : deux plantes suspendues ---- */}
      <div className="el-layer lf-plants" style={vars({ top: '0px', '--k': 0.7, '--kx': 9 })}>
        <div className="lf-set">
          <svg viewBox="0 0 480 140" width="480">
            <g className="lf-hang lf-hang--l">
              <path d="M54 -20L60 30M74 -20L68 30" stroke="#C9B39A" strokeWidth="1" />
              <Vine d="M58 40C52 54 56 66 50 80" leaves={[[55, 48, 30], [53, 60, -20], [52, 72, 25], [50, 80, -10]]} />
              <Vine d="M70 40C76 52 72 60 78 70" leaves={[[73, 48, -30], [74, 58, 20], [77, 68, -15]]} />
              <path d="M54 30h20l-3 12h-14Z" fill="#C77B5A" />
              <path d="M53 29h22v3h-22Z" fill="#D88E6C" />
              <path d="M58 30c-4 -6 -2 -10 2 -12c0 4 0 8 -2 12ZM70 30c4 -6 2 -10 -2 -12c0 4 0 8 2 12ZM64 30c-2 -6 0 -11 0 -13c1 2 2 7 0 13Z" fill="#78B386" />
            </g>
            <g className="lf-hang lf-hang--r">
              <path d="M398 -20L404 22M418 -20L412 22" stroke="#C9B39A" strokeWidth="1" />
              <Vine d="M402 32C396 48 402 62 396 84" leaves={[[400, 40, 25], [399, 52, -25], [400, 64, 20], [398, 76, -20], [396, 84, 10]]} />
              <Vine d="M414 32C420 46 416 56 422 66" leaves={[[417, 40, -25], [418, 52, 25], [421, 64, -10]]} />
              <path d="M398 22h20l-3 12h-14Z" fill="#E8DCC8" />
              <path d="M397 21h22v3h-22Z" fill="#F4ECDD" />
              <path d="M402 22c-4 -6 -2 -10 2 -12c0 4 0 8 -2 12ZM414 22c4 -6 2 -10 -2 -12c0 4 0 8 2 12ZM408 22c-2 -6 0 -11 0 -13c1 2 2 7 0 13Z" fill="#5E9A6E" />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
