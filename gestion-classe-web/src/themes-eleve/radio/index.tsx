import type { ReactNode } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Radiographie » : le négatoscope de la salle de radiologie, le soir.
 * Plans, du fond vers l'avant : mur sombre éclairé par le halo bleuté du négatoscope, le
 * négatoscope lui-même (cadre de métal, panneau lumineux, règle graduée, interrupteur) où quatre
 * clichés en négatif sont tenus par des pinces : une main (D), un crâne de profil (G), une cage
 * thoracique avec la colonne vertébrale (D), un genou de profil (G) ; enfin le bord du bureau
 * (pot à crayons, enveloppe de clichés, loupe, marteau à réflexes), puis un sol uni.
 * Mouvement, sans que l'élève touche à rien : la cage thoracique respire (les côtes se soulèvent,
 * le diaphragme descend), le cœur bat doucement, des poussières flottent dans la lumière, le
 * voyant de l'interrupteur respire. De temps en temps : une ligne de balayage lumineuse descend
 * le long du panneau ; les doigts de la main pianotent l'un après l'autre.
 * Au toucher : la main (elle fait coucou : les phalanges se plient articulation par articulation,
 * les muscles fléchisseurs de l'avant-bras et leurs tendons s'allument en bleu), le crâne (la
 * mâchoire s'ouvre et se ferme en chantant, des notes s'envolent), la cage thoracique (grande
 * inspiration : les côtes s'écartent, le diaphragme descend, puis on souffle), le genou (il se plie
 * et se déplie : le tibia roule sous le fémur, la rotule glisse, les muscles de l'arrière puis de
 * l'avant de la cuisse s'allument), l'interrupteur (le négatoscope s'allume plus fort).
 */

const BONE = '#DCEFFF';
const BONE_SOFT = '#B4D6F2';
const FLESH = '#1A3452';
const FILM = '#0B1828';

/** Contour d'un os long de a vers b : deux têtes arrondies et une diaphyse plus étroite. */
function bone(ax: number, ay: number, bx: number, by: number, w: number, wa = w * 1.35, wb = w * 1.25): string {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy;
  const ny = ux;
  const h = w / 2;
  const ra = wa / 2;
  const rb = wb / 2;
  const at = (ox: number, oy: number, du: number, dn: number) =>
    `${(ox + ux * du + nx * dn).toFixed(2)} ${(oy + uy * du + ny * dn).toFixed(2)}`;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  return [
    `M${at(ax, ay, -ra * 0.9, 0)}`,
    `Q${at(ax, ay, -ra * 0.9, ra)} ${at(ax, ay, 0, ra)}`,
    `Q${at(ax, ay, ra * 0.8, ra)} ${at(ax, ay, ra * 1.6, h)}`,
    `Q${at(mx, my, 0, h * 0.82)} ${at(bx, by, -rb * 1.6, h)}`,
    `Q${at(bx, by, -rb * 0.8, rb)} ${at(bx, by, 0, rb)}`,
    `Q${at(bx, by, rb * 0.9, rb)} ${at(bx, by, rb * 0.9, 0)}`,
    `Q${at(bx, by, rb * 0.9, -rb)} ${at(bx, by, 0, -rb)}`,
    `Q${at(bx, by, -rb * 0.8, -rb)} ${at(bx, by, -rb * 1.6, -h)}`,
    `Q${at(mx, my, 0, -h * 0.82)} ${at(ax, ay, ra * 1.6, -h)}`,
    `Q${at(ax, ay, ra * 0.8, -ra)} ${at(ax, ay, 0, -ra)}`,
    `Q${at(ax, ay, -ra * 0.9, -ra)} ${at(ax, ay, -ra * 0.9, 0)}Z`,
  ].join('');
}

/** Un cliché accroché au négatoscope : film sombre, contenu découpé au bord, pince, repères. */
function Film({ id, x, w, rot, side, date, tap, ms, children }: {
  id: string; x: number; w: number; rot: number; side: 'G' | 'D'; date: string;
  tap: string; ms: number; children: ReactNode;
}) {
  const h = 142;
  return (
    <g transform={`translate(${x} 28) rotate(${rot} ${w / 2} 0)`} data-tap={tap} data-tap-ms={ms}>
      <clipPath id={`rx-clip-${id}`}><rect width={w} height={h} rx="2" /></clipPath>
      <rect width={w} height={h} rx="2" fill={FILM} />
      <g clipPath={`url(#rx-clip-${id})`}>{children}</g>
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx="2" fill="none" stroke="#1D3350" />
      <text x={side === 'D' ? 6 : w - 6} y="16" textAnchor={side === 'D' ? 'start' : 'end'} className="rx-mark">{side}</text>
      <g transform={`translate(3 ${h - 12})`}>
        <rect width="25" height="9" rx="1.5" fill="#CFE3F6" />
        <text x="12.5" y="6.9" textAnchor="middle" className="rx-date">{date}</text>
      </g>
      <g transform={`translate(${w / 2} 0)`}>
        <path d="M-6 -12h12l1 6h-14Z" fill="#45607E" />
        <rect x="-11" y="-6" width="22" height="10" rx="2" fill="#2E4561" />
        <rect x="-11" y="-6" width="22" height="3" rx="1.5" fill="#4F6C8C" />
        <circle cy="-1" r="1.8" fill="#8FB0D0" />
      </g>
    </g>
  );
}

/* ---------- La main (face dorsale, main droite : le pouce à gauche) ---------- */

/** Doigts : tête du métacarpien (articulation), angle, longueurs des trois phalanges, base du métacarpien. */
const FINGERS = [
  { hx: 31, hy: 76, a: -9, l: [17, 10, 7], bx: 36, by: 102 },
  { hx: 42, hy: 73, a: -2, l: [19, 12, 8], bx: 43, by: 102 },
  { hx: 53, hy: 75, a: 5, l: [17, 11, 7.5], bx: 50, by: 102 },
  { hx: 62, hy: 81, a: 13, l: [13, 8, 6], bx: 57, by: 101 },
];

/** Une phalange dans son repère : l'articulation est en (0, 0), le doigt monte vers -y. */
function Phalanx({ len, w, tip }: { len: number; w: number; tip?: boolean }) {
  return (
    <>
      <path d={`M0 0V${-len}`} stroke={FLESH} strokeWidth={w + 6} strokeLinecap="round" />
      <path d={bone(0, -1.4, 0, -len + (tip ? 0.6 : 1.4), w, w * 1.3, tip ? w * 0.95 : w * 1.2)} fill={BONE} />
      <path d={`M0 -1.5V${-len + 1.5}`} className="rx-tendon" />
    </>
  );
}

function Hand() {
  return (
    <g className="rx-hand">
      {/* Chair de la paume, du pouce et de l'avant-bras */}
      <path d="M24 142L27 124C22 116 21 108 23 100C24 94 25 86 27 78L66 82C66 90 65 98 63 106C61 113 61 119 61 124L63 142Z" fill={FLESH} />
      <path d="M28 104L18 86L10 76L6 68" stroke={FLESH} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Radius et cubitus */}
      <path d="M27 143C29 135 29 129 25 122Q34 116 44 120C41 128 41 135 41 143Z" fill={BONE} />
      <path d="M47 143C48 135 49 129 49 124Q54 119 59 122C57 128 56 135 55 143Z" fill={BONE_SOFT} />
      {/* Muscles fléchisseurs de l'avant-bras (ils s'allument quand les doigts se plient) */}
      <path className="rx-muscle rx-flex" d="M29 146C26 136 28 126 35 119C41 124 44 136 42 146Z" />
      <path className="rx-muscle rx-flex" d="M44 146C43 135 46 125 53 119C59 125 60 137 57 146Z" />
      {/* Os du carpe */}
      <g fill={BONE} stroke={FILM} strokeWidth="0.9">
        <ellipse cx="31" cy="114" rx="5" ry="4.2" /><ellipse cx="40" cy="115.5" rx="4.6" ry="4" />
        <ellipse cx="48.5" cy="115" rx="4.4" ry="4" /><ellipse cx="56" cy="113" rx="3.6" ry="3.6" />
        <ellipse cx="30" cy="106" rx="4.6" ry="4" /><ellipse cx="38" cy="107" rx="4.2" ry="4.2" />
        <ellipse cx="46.5" cy="106.5" rx="4.6" ry="4.4" /><ellipse cx="54.5" cy="106" rx="4" ry="4" />
      </g>
      {/* Tendons de la paume */}
      {FINGERS.map((f, i) => <path key={i} className="rx-tendon" d={`M${40 + i * 4} 120L${f.hx} ${f.hy}`} />)}
      {/* Métacarpiens */}
      {FINGERS.map((f, i) => <path key={i} d={bone(f.bx, f.by, f.hx, f.hy + 1.6, 4.6)} fill={BONE} />)}
      {/* Pouce */}
      <path d={bone(29, 104, 18, 87, 5)} fill={BONE} />
      <path d={bone(17, 85, 10.5, 76, 4.4)} fill={BONE} />
      <path d={bone(9.8, 74.3, 6.4, 67.6, 4, 5, 3.6)} fill={BONE} />
      {/* Doigts : chaque phalange tourne autour de son articulation (repères imbriqués) */}
      {FINGERS.map((f, i) => (
        <g key={i} transform={`translate(${f.hx} ${f.hy}) rotate(${f.a})`}>
          <g className="rx-p1" style={vars({ '--fd': `${i * 0.07}s`, '--pd': `${i * 0.2}s` })}>
            <Phalanx len={f.l[0]} w={4.4} />
            <g transform={`translate(0 ${-f.l[0]})`}>
              <g className="rx-p2" style={vars({ '--fd': `${i * 0.07}s` })}>
                <Phalanx len={f.l[1]} w={3.9} />
                <g transform={`translate(0 ${-f.l[1]})`}>
                  <g className="rx-p3" style={vars({ '--fd': `${i * 0.07}s` })}>
                    <Phalanx len={f.l[2]} w={3.6} tip />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}

/* ---------- Le crâne, de profil (le visage à gauche) ---------- */

function Skull() {
  return (
    <g>
      <path fill={FLESH} d="M66 18C84 22 92 40 90 60C89 74 84 84 76 92C72 98 72 104 74 112L78 142H30L32 122C28 118 22 117 19 114C16 111 17 107 19 105C16 103 16 99 18 97C14 95 14 91 17 89C14 87 13 84 15 82C12 79 8 75 10 71C12 68 13 65 12 60C11 52 13 42 18 34C28 20 48 14 66 18Z" />
      {/* Vertèbres cervicales */}
      <g fill={BONE_SOFT}>
        <rect x="61" y="88" width="12" height="7" rx="2" />
        {[98, 108, 118, 128, 138].map((y) => (
          <g key={y}><rect x="60" y={y} width="12" height="8" rx="2" /><path d={`M71 ${y + 2}L80 ${y + 5}L71 ${y + 7}Z`} /></g>
        ))}
      </g>
      {/* Boîte crânienne : un anneau d'os, le cerveau plus sombre dedans */}
      <path fill={BONE} d="M18 58C16 40 30 24 52 22C72 21 86 34 86 52C86 66 80 76 72 80L64 82L44 80L24 72C20 68 18 64 18 58Z" />
      <path fill="#2A4868" d="M22.5 56C22.5 42 34 28 52 27C69 26 81 37 81 52C81 63 76 71 68 75L46 74L28 67C25 64 22.5 60 22.5 56Z" />
      <path d="M44 66C52 70 62 70 70 66" stroke="#3B5D82" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Face : orbite, os du nez, maxillaire, arcade zygomatique */}
      <path fill={BONE_SOFT} d="M15 80C17 76 26 75 35 76C43 77 49 80 51 85L49 88.5L20 88.5C16 87 14 84 15 80Z" />
      <path fill="#2A4868" d="M18 79C20 77.5 24 77.5 26 79C25 81.5 20 82 18 79Z" />
      <path fill={BONE} d="M18 63L12.5 76L17 77.5L23 68Z" />
      <circle cx="28" cy="63" r="7.6" fill="#1C3554" stroke={BONE} strokeWidth="3" />
      <path fill={BONE_SOFT} d="M34 72C42 71 52 72 59 74.5L58.5 77.5C51 76 42 75.5 35 76Z" />
      <circle cx="62" cy="76" r="2.6" fill={FILM} />
      <g fill={BONE}>
        {[18.5, 22.5, 26.5, 30.5, 34.5, 39].map((x, i) => <rect key={x} x={x} y="86" width={i === 5 ? 5 : 3.4} height="5.6" rx="1.3" />)}
      </g>
      {/* Mandibule : elle tourne autour de l'articulation, devant l'oreille */}
      <g className="rx-jaw">
        <path fill={BONE} d="M57.5 77C62 79 62.5 85 61 91L59 99C57.5 103.5 51 105.5 45 105L23 104C18.5 103.5 16 100.5 17 96.5L19 92H44C50 92 53.5 88 55 82Z" />
        <g fill={BONE}>
          {[19.5, 23.5, 27.5, 31.5, 35.5, 40].map((x, i) => <rect key={x} x={x} y="91.2" width={i === 5 ? 5 : 3.4} height="5.2" rx="1.3" />)}
        </g>
      </g>
    </g>
  );
}

/** Notes de musique qui s'envolent de la bouche du crâne quand il chante. */
function Notes() {
  const stem = (i: number) => (i === 1 ? 'M0 0V-11L9 -13V-2' : 'M0 0V-12C3 -10 7 -9 7 -5');
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${160 - i * 2} ${122 - i * 3}) scale(1.45)`}>
          <g className="rx-note" style={vars({ '--n': i })}>
            <path d={stem(i)} fill="none" stroke="#0B2238" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d={stem(i)} fill="none" stroke="#E6F7FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <ellipse cx="-2" cy="0" rx="3.2" ry="2.4" transform="rotate(-20 -2 0)" fill="#E6F7FF" stroke="#0B2238" strokeWidth="1.2" />
            {i === 1 && <ellipse cx="7" cy="-2" rx="3.2" ry="2.4" transform="rotate(-20 7 -2)" fill="#E6F7FF" stroke="#0B2238" strokeWidth="1.2" />}
          </g>
        </g>
      ))}
    </g>
  );
}

/* ---------- La cage thoracique, de face ---------- */

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${(96 - Number(x)).toFixed(1)} ${y}`);
const RIBS = Array.from({ length: 9 }, (_, k) => {
  const y = 22 + k * 9.6;
  const lx = 82 + Math.min(k, 5) * 1.3;
  const right = `M52 ${y}C60 ${y - 4} ${lx - 6} ${y - 4} ${lx} ${y + 6}C${lx + 2} ${y + 12} ${lx} ${y + 18} ${lx - 4} ${y + 22}`;
  const front = k < 6 ? `M${lx - 4} ${y + 22}C${lx - 12} ${y + 28} 64 ${y + 30} 57 ${y + 34}` : '';
  return { right, left: mirror(right), front, frontLeft: front && mirror(front), w: 2.6 - k * 0.06 };
});

function Thorax() {
  return (
    <g transform="translate(-1 6)">
      <path fill={FLESH} d="M36 0H60C60 8 62 12 68 14C80 16 92 20 96 28V142H0V28C4 20 16 16 28 14C34 12 36 8 36 0Z" />
      {/* Têtes des humérus */}
      <g fill={BONE_SOFT}>
        <circle cx="3" cy="31" r="7.5" /><circle cx="93" cy="31" r="7.5" />
      </g>
      <g className="rx-cage">
        <path fill="#060F1B" d="M44 22C34 20 22 26 16 40C10 56 8 80 8 104C16 98 28 98 40 104H44Z" />
        <path fill="#060F1B" d="M52 22C62 20 74 26 80 40C86 56 88 80 88 104C80 96 70 94 60 100H52Z" />
        {RIBS.map((r, k) => (
          <g key={k} fill="none" stroke={BONE} strokeLinecap="round">
            <path d={r.right} strokeWidth={r.w} /><path d={r.left} strokeWidth={r.w} />
            {r.front && <path d={r.front} strokeWidth="1.5" opacity="0.45" />}
            {r.frontLeft && <path d={r.frontLeft} strokeWidth="1.5" opacity="0.45" />}
          </g>
        ))}
      </g>
      {/* Le cœur, un peu à droite sur le cliché (à gauche du patient) */}
      <path className="rx-heart" fill="#35587E" opacity="0.92" d="M42 64C50 60 60 64 64 72C70 80 72 92 66 100C60 106 48 106 42 100C38 90 38 74 42 64Z" />
      {/* Diaphragme et ventre */}
      <path className="rx-diaph" fill="#2C4A6C" d="M0 150V110C10 99 22 97 34 103C40 106 44 107 48 107C52 105 58 97 70 95C82 95 92 101 96 109V150Z" />
      {/* Colonne vertébrale */}
      <g fill={BONE_SOFT}>
        {Array.from({ length: 16 }, (_, k) => <rect key={k} x="44" y={2 + k * 9} width="8" height="7" rx="1.6" />)}
      </g>
      {/* Clavicules */}
      <g fill="none" stroke={BONE} strokeWidth="3.2" strokeLinecap="round">
        <path d="M45 20C38 22 30 16 19 14C14 13 10 14 7 16" />
        <path d="M51 20C58 22 66 16 77 14C82 13 86 14 89 16" />
      </g>
    </g>
  );
}

/* ---------- Le genou, de profil (l'avant de la jambe à gauche) ---------- */

function Knee() {
  return (
    <g transform="translate(7 0)">
      <path fill={FLESH} d="M8 0H56C56 30 54 52 52 70C50 80 44 86 32 86C20 86 12 80 10 70C8 52 8 28 8 0Z" />
      <path className="rx-muscle rx-quad" d="M12 4C10 26 12 46 16 58L22 55C20 40 20 20 22 4Z" />
      <path className="rx-muscle rx-ischio" d="M40 4C42 24 44 44 47 60L52 58C54 40 54 20 54 4Z" />
      <circle cx="33" cy="76" r="21" fill={FLESH} />
      {/* Jambe : tibia et péroné tournent sous le fémur */}
      <g className="rx-leg">
        <path fill={FLESH} d="M12 76C18 68 46 68 52 76C58 90 60 104 56 120L52 150H16C14 120 12 96 12 76Z" />
        <path fill={BONE_SOFT} d={bone(47, 93, 44, 150, 3.6, 6.4, 4)} />
        <path fill={BONE} d="M19 86C24 81 40 81 47 85C47 91 42 95 38 98L36 150H25L23 102C19 98 16 92 19 86Z" />
      </g>
      <path fill={BONE} d="M24 0H36C36 28 37 44 42 56C48 64 47 78 38 81C30 83 21 79 20 71C19 63 23 55 24 45C24 30 24 14 24 0Z" />
      <path d="M27 56C30 64 36 66 41 62" stroke="#9EC4E6" strokeWidth="1.1" fill="none" />
      <g className="rx-patella">
        <ellipse cx="14" cy="62" rx="4.6" ry="8" transform="rotate(-8 14 62)" fill={BONE} />
      </g>
    </g>
  );
}

/* ---------- Décor ---------- */

const MOTES = scatter(12, 47, (r) => ({
  x: `${(r() * 92 + 4).toFixed(1)}%`,
  y: `${Math.round(30 + r() * 170)}px`,
  s: `${(r() * 1.6 + 1.6).toFixed(1)}px`,
  d: `${(r() * 6 + 9).toFixed(1)}s`,
  delay: `${(-r() * 14).toFixed(1)}s`,
  dx: `${Math.round(r() * 30 - 15)}px`,
}));

/** Graduations de la règle sur la barre du bas, de 0 à 30 cm. */
const TICKS = Array.from({ length: 61 }, (_, i) => i);

export default function RadioScene() {
  return (
    <>
      <div className="el-layer rx-room" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer rx-halolayer" style={vars({ top: '0px', '--k': 0.36, '--kx': 2 })}>
        <div className="el-stage"><div className="rx-halo" /></div>
      </div>

      <div className="el-layer rx-boxlayer" style={vars({ top: '0px', '--k': 0.5, '--kx': 5 })}>
        <div className="rx-set">
          <svg viewBox="0 0 480 210" width="480">
            <defs>
              <linearGradient id="rx-lit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9AD6F7" /><stop offset="1" stopColor="#5FA7DB" />
              </linearGradient>
              <linearGradient id="rx-scan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E8F8FF" stopOpacity="0" /><stop offset="0.85" stopColor="#E8F8FF" stopOpacity="0.45" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
              </linearGradient>
              <clipPath id="rx-clip-lit"><rect x="58" y="20" width="364" height="158" rx="3" /></clipPath>
            </defs>
            {/* Cadre de métal */}
            <rect x="48" y="9" width="384" height="193" rx="9" fill="#1C2B3F" />
            <rect x="48" y="9" width="384" height="4" rx="2" fill="#2F4562" />
            <rect x="52" y="178" width="376" height="21" rx="3" fill="#15212F" />
            <circle cx="54" cy="15" r="1.6" fill="#4C6584" /><circle cx="426" cy="15" r="1.6" fill="#4C6584" />
            {/* Panneau lumineux, ses tubes, et la lumière renforcée de l'interrupteur */}
            <rect x="58" y="20" width="364" height="158" rx="3" fill="url(#rx-lit)" />
            <path d="M149 21V177M240 21V177M331 21V177" stroke="#84C4EC" strokeWidth="1.2" />
            <rect className="rx-boost" x="58" y="20" width="364" height="158" rx="3" fill="#F2FBFF" />
            {/* Règle graduée */}
            <g className="rx-ruler">
              {TICKS.map((i) => (
                <path key={i} d={`M${72 + i * 5} 179V${i % 10 === 0 ? 186 : i % 2 === 0 ? 183.5 : 182}`} />
              ))}
              {[0, 5, 10, 15, 20, 25, 30].map((n) => <text key={n} x={72 + n * 10} y="194.5" textAnchor="middle">{n}</text>)}
            </g>
            {/* Interrupteur et voyant */}
            <g data-tap="allume" data-tap-ms="3600">
              <rect x="380" y="180" width="44" height="17" rx="3" fill="#15212F" />
              <circle className="rx-led" cx="389" cy="188.5" r="2.6" />
              <rect x="397" y="182.5" width="22" height="12" rx="6" fill="#0B141F" />
              <circle className="rx-knob" cx="412.5" cy="188.5" r="4.6" fill="#9FBAD6" />
            </g>

            <Film id="main" x={62} w={80} rot={-1.5} side="D" date="05.11" tap="coucou" ms={4200}>
              <Hand />
            </Film>
            <Film id="crane" x={148} w={88} rot={1} side="G" date="05.11" tap="chante" ms={3600}>
              <Skull />
            </Film>
            <Film id="thorax" x={242} w={94} rot={-0.6} side="D" date="12.11" tap="respire" ms={4600}>
              <Thorax />
            </Film>
            <Film id="genou" x={342} w={76} rot={1.4} side="G" date="19.11" tap="flexion" ms={4400}>
              <Knee />
            </Film>
            <Notes />

            {/* Ligne de balayage, de temps en temps */}
            <g clipPath="url(#rx-clip-lit)">
              <rect className="rx-scanline" x="58" y="-8" width="364" height="28" fill="url(#rx-scan)" />
            </g>
          </svg>
        </div>
      </div>

      <div className="rx-motes">
        {MOTES.map((m, i) => (
          <span key={i} className="rx-mote" style={vars({ '--x': m.x, '--y': m.y, '--s': m.s, '--d': m.d, '--delay': m.delay, '--dx': m.dx })} />
        ))}
      </div>

      <div className="el-layer rx-desk" style={vars({ top: '198px', '--k': 0.8, '--kx': 12 })}>
        <div className="rx-set">
          <svg viewBox="0 0 480 52" width="480" style={{ top: -26 }}>
            {/* Pot à crayons */}
            <path d="M70 8L66 -2" stroke="#F2C14E" strokeWidth="3" strokeLinecap="round" />
            <path d="M66 -2L65 -4.5" stroke="#3A2C14" strokeWidth="2" strokeLinecap="round" />
            <path d="M76 6L77 -3" stroke="#7FD4FF" strokeWidth="3" strokeLinecap="round" />
            <path d="M81 8L87 0" stroke="#E2788A" strokeWidth="3" strokeLinecap="round" />
            <rect x="64" y="6" width="22" height="30" rx="3" fill="#20364F" />
            <rect x="64" y="6" width="22" height="4" rx="2" fill="#2E4A68" />
            <rect x="68" y="14" width="3" height="18" rx="1.5" fill="#2A4562" />
            {/* Enveloppe de clichés, un film qui dépasse */}
            <path d="M128 31L134 22H210L206 31Z" fill="#0E1C2E" />
            <path d="M150 27C158 24 166 26 172 24M182 25C188 23 194 25 198 24" stroke="#B4D6F2" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M112 42L122 30H222L214 42Z" fill="#2A4260" />
            <path d="M136 37L140 33H170L167 37Z" fill="#DCEBFF" opacity="0.85" />
            <path d="M176 37L178 34.5H200L198.5 37Z" fill="#7FD4FF" opacity="0.7" />
            {/* Loupe */}
            <path d="M283 37L306 41" stroke="#3E5672" strokeWidth="4.4" strokeLinecap="round" />
            <ellipse cx="272" cy="35" rx="12" ry="5.4" fill="#7FD4FF" fillOpacity="0.22" stroke="#9FBAD6" strokeWidth="2.6" />
            <path d="M265 33.5C268 32 272 31.6 276 32" stroke="#E6F7FF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            {/* Marteau à réflexes */}
            <path d="M352 38L398 33" stroke="#9FBAD6" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M396 33.3L402 32.6" stroke="#5E7FA6" strokeWidth="4" strokeLinecap="round" />
            <path d="M338 31L356 35L356 41L338 43C334.5 39 334.5 35 338 31Z" fill="#E2788A" />
            <path d="M340 33L353 36" stroke="#F5A6B2" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}
