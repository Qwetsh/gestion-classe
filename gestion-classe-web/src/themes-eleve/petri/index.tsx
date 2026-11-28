import { seeded, vars } from '../shared';
import './theme.css';

/**
 * Thème « Boîte de Pétri » : la paillasse du labo de SVT, un jour de culture de bactéries.
 * Plans, du fond vers l'avant : mur carrelé et horloge, étagère (erlenmeyer qui bulle, flacon brun,
 * ballon, éprouvette graduée), paillasse avec le bec Bunsen, le portoir de tubes et l'étuve à 37 °C,
 * les trois boîtes de Pétri (cultures sous couvercle, antibiogramme, gélose neuve), puis le devant
 * de la paillasse (gant, anse de platine) et un sol uni.
 * Mouvement, sans que l'élève touche à rien : la flamme bleue du bec vacille et l'air chaud ondule
 * au-dessus, l'erlenmeyer fait des bulles, la trotteuse de l'horloge tourne, le voyant de l'étuve
 * respire, les colonies grossissent lentement, les halos clairs de l'antibiogramme respirent, un
 * reflet de lumière glisse sur le couvercle. De temps en temps (toutes les 19 s), une main gantée
 * descend avec une pipette et dépose une goutte sur la gélose neuve.
 * Au toucher : l'antibiogramme (une pince pose un nouveau disque d'antibiotique, un halo clair
 * s'ouvre autour et les colonies voisines reculent, puis tout revient), la gélose neuve ou l'anse
 * (l'anse ensemence une strie en zigzag, des colonies poussent le long du trait puis s'effacent),
 * le bec Bunsen (la virole s'ouvre, la flamme ronfle, haute et bleue, puis se calme).
 */

const f = (n: number) => n.toFixed(1);

/* ---------- Colonies : couleurs (corps, bord, reflet) ---------- */

type Tint = readonly [string, string, string];
const CREAM: Tint = ['#FFF3D2', '#E3CF98', '#FFFFFF'];
const YELLOW: Tint = ['#F6D04A', '#D3A421', '#FFF1B0'];
const ORANGE: Tint = ['#F29A3A', '#CF731D', '#FFD6A6'];
const WHITE: Tint = ['#FFFFFF', '#D9D5C0', '#FFFFFF'];
const BEIGE: Tint = ['#EED9A6', '#CDB37A', '#FFF6DE'];
const TINTS = [CREAM, YELLOW, ORANGE, WHITE, BEIGE, CREAM, YELLOW];

type Colony = { x: number; y: number; r: number; t: Tint; d: string; delay: string };

/** Des colonies rondes semées dans une ellipse de gélose, sans se chevaucher (hasard à graine). */
function sow(seed: number, cx: number, cy: number, rx: number, ry: number, count: number, rMin: number, rMax: number): Colony[] {
  const r = seeded(seed);
  const out: Colony[] = [];
  for (let tries = 0; out.length < count && tries < 600; tries++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.86;
    const size = rMin + (rMax - rMin) * r() * r();
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (((x - cx) / (rx - size)) ** 2 + ((y - cy) / (ry - size * 0.5)) ** 2 > 1) continue;
    if (out.some((c) => Math.hypot(c.x - x, (c.y - y) * 2.2) < c.r + size + 1.6)) continue;
    out.push({
      x, y, r: size,
      t: TINTS[Math.floor(r() * TINTS.length)] ?? CREAM,
      d: `${(r() * 10 + 14).toFixed(1)}s`,
      delay: `${(-r() * 24).toFixed(1)}s`,
    });
  }
  return out;
}

/** Une colonie vue de trois quarts : une petite coupole, son bord, un reflet. */
function Col({ c, className }: { c: Colony; className?: string }) {
  return (
    <g className={className ?? 'pe-col'} style={vars({ '--d': c.d, '--delay': c.delay })}>
      <ellipse cx={f(c.x)} cy={f(c.y + c.r * 0.12)} rx={f(c.r)} ry={f(c.r * 0.5)} fill={c.t[1]} />
      <ellipse cx={f(c.x)} cy={f(c.y)} rx={f(c.r * 0.9)} ry={f(c.r * 0.44)} fill={c.t[0]} />
      {c.r > 2.2 && <ellipse cx={f(c.x - c.r * 0.3)} cy={f(c.y - c.r * 0.14)} rx={f(c.r * 0.34)} ry={f(c.r * 0.15)} fill={c.t[2]} opacity="0.85" />}
    </g>
  );
}

/* ---------- Les trois boîtes ---------- */

type Dish = { cx: number; cy: number; rx: number; ry: number };

/** Boîte A : cultures sous couvercle (gélose nutritive). */
const A: Dish = { cx: 140, cy: 186, rx: 62, ry: 24 };
const A_COLS = sow(11, A.cx, A.cy + 2.5, A.rx - 4, A.ry - 2, 22, 1.8, 6.6);

/** Boîte B : l'antibiogramme (tapis de bactéries, disques, halos). */
const B: Dish = { cx: 292, cy: 164, rx: 72, ry: 28 };
/** Disques en place : position, numéro, rayon du halo (0 = bactéries résistantes). */
const DISKS: { x: number; y: number; n: string; halo: number }[] = [
  { x: 255, y: 163, n: '1', halo: 17 },
  { x: 291, y: 148, n: '2', halo: 9 },
  { x: 287, y: 181, n: '3', halo: 13 },
  { x: 330, y: 176, n: '4', halo: 0 },
];
/** Le disque posé au toucher, et les colonies qui reculent devant son halo. */
const NEW_DISK = { x: 327, y: 154 };
const VICTIMS: Colony[] = [
  { x: 316, y: 151, r: 3.2, t: CREAM, d: '0s', delay: '0s' },
  { x: 339, y: 156, r: 2.8, t: BEIGE, d: '0s', delay: '0s' },
  { x: 328, y: 161, r: 2.4, t: CREAM, d: '0s', delay: '0s' },
  { x: 334, y: 147, r: 2, t: WHITE, d: '0s', delay: '0s' },
  { x: 317, y: 158.5, r: 1.8, t: BEIGE, d: '0s', delay: '0s' },
];

/** Boîte C : gélose neuve, où l'anse trace sa strie. */
const C: Dish = { cx: 372, cy: 204, rx: 52, ry: 19 };
/** La strie en zigzag : cinq traits de même longueur, pour que l'anse suive le tracé à vitesse égale. */
const ZIG: [number, number][] = [[341, 201], [354, 213], [367, 201], [380, 213], [393, 201], [406, 213]];
const ZIG_D = ZIG.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const ZIG_LEN = Math.round(Math.hypot(13, 12) * 5) + 1;
/** Les colonies qui poussent le long de la strie. */
const STREAK_COLS = (() => {
  const r = seeded(29);
  const out: { c: Colony; o: string }[] = [];
  for (let i = 0; i < ZIG.length - 1; i++) {
    const [x0, y0] = ZIG[i] ?? [0, 0];
    const [x1, y1] = ZIG[i + 1] ?? [0, 0];
    [0.25, 0.7].forEach((t, j) => {
      const c: Colony = { x: x0 + (x1 - x0) * t + (r() - 0.5) * 2, y: y0 + (y1 - y0) * t + (r() - 0.5), r: 1.9 + r() * 1.9, t: r() < 0.5 ? YELLOW : ORANGE, d: '0s', delay: '0s' };
      out.push({ c, o: `${((i * 2 + j) * 0.07).toFixed(2)}s` });
    });
  }
  return out;
})();

/** Le verre et la gélose d'une boîte vue de trois quarts. `gel` : dessus, `side` : tranche vue à travers le verre. */
function DishBase({ d, gel, side }: { d: Dish; gel: string; side: string }) {
  const { cx, cy, rx, ry } = d;
  const h = 8;
  return (
    <>
      <ellipse cx={cx + 5} cy={cy + h + 3} rx={rx + 3} ry={ry + 2.5} fill="#53663A" opacity="0.16" />
      <ellipse cx={cx} cy={cy + h} rx={rx} ry={ry} fill={side} />
      <rect x={cx - rx} y={cy} width={rx * 2} height={h} fill={side} />
      <ellipse cx={cx} cy={cy + 2.6} rx={rx - 2.6} ry={ry - 1.3} fill={gel} />
      {/* Bord de verre : tranche claire, contour, reflets */}
      <path d={`M${cx - rx} ${cy}V${cy + h}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + h}V${cy}`} fill="none" stroke="#A9C6C1" strokeWidth="1.1" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.95" />
      <ellipse cx={cx} cy={cy} rx={rx + 0.9} ry={ry + 0.5} fill="none" stroke="#A9C6C1" strokeWidth="0.7" />
      <path d={`M${f(cx - rx * 0.72)} ${f(cy + ry * 0.74 + 2)}l0 ${f(h - 1)}M${f(cx - rx * 0.6)} ${f(cy + ry * 0.83 + 2)}l0 ${f(h - 2)}`} stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
    </>
  );
}

/** Une étiquette de ruban adhésif écrite au feutre. */
function Tape({ x, y, w, rot, text }: { x: number; y: number; w: number; rot: number; text: string }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <path d={`M${x - w / 2} ${y - 4.6}h${w}l-1 2.3 1 2.3 -1 2.3 1 2.3h${-w}l1 -2.3 -1 -2.3 1 -2.3Z`} fill="#FBF5DC" />
      <path d={`M${x - w / 2} ${y + 4.6}h${w}`} stroke="#E2D9AE" strokeWidth="0.8" />
      <text x={x} y={y + 2.4} textAnchor="middle" className="pe-ink">{text}</text>
    </g>
  );
}

/* ---------- Objets ---------- */

/** Le bec Bunsen, pied en (96, 150). */
function Bunsen() {
  return (
    <g transform="translate(96 150)">
      <g className="pe-bunsen" data-tap="flamme" data-tap-ms="3200">
        <path d="M-8 -5C-24 -2 -30 12 -52 10C-62 9 -70 4 -84 8" fill="none" stroke="#D96A33" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M-8 -5C-24 -2 -30 12 -52 10" fill="none" stroke="#F08A52" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="0" cy="1" rx="16" ry="5.5" fill="#4D5762" />
        <ellipse cx="0" cy="-1" rx="15" ry="5" fill="#76818C" />
        <path d="M-11 -6H-4V-3H-11Z" fill="#59636E" />
        <rect x="-4" y="-54" width="8" height="52" fill="#9AA5B0" />
        <rect x="1.4" y="-54" width="2.6" height="52" fill="#7E8994" />
        <rect x="-2.8" y="-54" width="1.8" height="52" fill="#CBD3DA" />
        <rect x="-5.6" y="-20" width="11.2" height="8" rx="1.2" fill="#66707B" />
        <ellipse className="pe-airhole" cx="-0.6" cy="-16" rx="1.6" ry="2" fill="#2A3138" />
        <ellipse cx="0" cy="-54" rx="4.4" ry="1.6" fill="#5B6570" />
        {/* La flamme : manteau bleu pâle, cône bleu vif */}
        <g className="pe-flame">
          <path d="M0 -88C6 -76 7.4 -66 5.2 -60.4C3.6 -56.6 -3.6 -56.6 -5.2 -60.4C-7.4 -66 -6 -76 0 -88Z" fill="#9CC0FF" />
          <path className="pe-flame__in" d="M0 -73C3 -66.5 3.6 -61.6 2.5 -59.2C1.5 -57.4 -1.5 -57.4 -2.5 -59.2C-3.6 -61.6 -3 -66.5 0 -73Z" fill="#3D6CF0" />
          <path d="M0 -88C1.6 -84 2.2 -81 1.6 -79C0.8 -80.5 -0.8 -80.5 -1.6 -79C-2.2 -81 -1.6 -84 0 -88Z" fill="#D9E6FF" />
        </g>
        <g className="pe-whoosh" fill="none" stroke="#7FA8F5" strokeWidth="1.4" strokeLinecap="round">
          <path d="M-10 -78q-3 -8 0 -16" /><path d="M10 -78q3 -8 0 -16" /><path d="M-15 -66q-3 -6 -1 -12" /><path d="M15 -66q3 -6 1 -12" />
        </g>
        <g className="pe-heat" fill="none" stroke="#B4C6DE" strokeWidth="1.1" strokeLinecap="round">
          <path d="M-3 -94q3 -4 0 -8t0 -8" /><path d="M3 -96q3 -4 0 -8t0 -8" /><path d="M0 -92q-3 -4 0 -8t0 -8" />
        </g>
      </g>
    </g>
  );
}

/** Le portoir de tubes de bouillon de culture, coin haut gauche en (x, y). */
function Rack({ x, y }: { x: number; y: number }) {
  const tubes: [string, string][] = [['#F29A3A', '#F2E1A2'], ['#5FA8E0', '#EFD687'], ['#F6D04A', '#EDE5C2'], ['#A897DE', '#E7CB76']];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M3 10V38M53 10V38" stroke="#7FA6C8" strokeWidth="3" strokeLinecap="round" />
      {tubes.map(([cap, broth], i) => {
        const tx = 7 + i * 12.5;
        return (
          <g key={i}>
            <path d={`M${tx} -4H${tx + 7}V31a3.5 3.5 0 0 1 -7 0Z`} fill="#EEF6F4" stroke="#A9C6C1" strokeWidth="0.8" />
            <path d={`M${tx + 0.6} ${14 + (i % 2) * 3}H${tx + 6.4}V31a2.9 2.9 0 0 1 -5.8 0Z`} fill={broth} />
            <path d={`M${tx + 1.4} 0V26`} stroke="#FFFFFF" strokeWidth="1" opacity="0.9" />
            <rect x={tx - 0.8} y="-10" width="8.6" height="7" rx="1.6" fill={cap} />
          </g>
        );
      })}
      <rect x="0" y="9" width="56" height="5" rx="1.5" fill="#9CC0E0" />
      <rect x="0" y="35" width="56" height="5" rx="1.5" fill="#86AED3" />
    </g>
  );
}

/** L'anse de platine, pointe (la boucle) en (0, 0), manche vers la droite. */
function Loop() {
  return (
    <g className="pe-loop" data-tap="strie" data-tap-ms="7000">
      <rect x="-4" y="-6" width="84" height="12" fill="#FFFFFF" opacity="0" />
      <circle cx="2.4" cy="0" r="2.3" fill="none" stroke="#AEB7BE" strokeWidth="1" />
      <path d="M4.7 0H34" stroke="#A6B0B8" strokeWidth="0.9" />
      <path d="M34 0H47" stroke="#8C969E" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="46" y="-2.8" width="32" height="5.6" rx="2.8" fill="#4E7A1E" />
      <path d="M52 -2.6V2.6M56 -2.6V2.6M60 -2.6V2.6" stroke="#3A5E14" strokeWidth="0.9" />
      <path d="M48 -1.4H76" stroke="#7FA64A" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  );
}

/** Un gant de laboratoire posé à plat (paume, quatre doigts, pouce). */
function Glove({ transform }: { transform: string }) {
  const fingers = 'M-7 -14L-9 -28M-2.4 -16L-3 -32M2.4 -16L3.4 -31M7 -13L9 -25';
  return (
    <g transform={transform}>
      <g stroke="#8E7AD0" strokeLinecap="round" fill="none" transform="translate(1.2 1.4)">
        <path d={fingers} strokeWidth="5.4" /><path d="M-9 -2L-16 -11" strokeWidth="5.6" />
      </g>
      <g stroke="#B6A5EC" strokeLinecap="round" fill="none">
        <path d={fingers} strokeWidth="5" /><path d="M-9 -2L-16 -11" strokeWidth="5.2" />
      </g>
      <path d="M-10 -15C-10 -19 10 -19 10 -15L9 8H-9Z" fill="#B6A5EC" />
      <path d="M-9.4 4H9.4L10 14H-10Z" fill="#A08DE0" />
      <path d="M-5 -8C-2 -6 2 -6 5 -8" fill="none" stroke="#9C89D8" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  );
}

/** La main gantée qui dépose une goutte (pointe de la pipette en (0, 0)). */
function Hand() {
  const fingers = 'M-5 -95H4M-5.5 -88.5H4M-5.5 -82H4M-4.5 -75.5H3';
  return (
    <g className="pe-hand">
      <path d="M18 -330H56L32 -108L8 -116Z" fill="#FFFFFF" />
      <path d="M44 -330H56L32 -108L26 -110Z" fill="#E4EADB" />
      <path d="M7 -117L32 -108L29 -95L5 -103Z" fill="#9C89D8" />
      <path d="M-2.6 -98H2.6V-40L0.8 0H-0.8L-2.6 -40Z" fill="#EAF4F3" stroke="#9FBFBF" strokeWidth="0.8" />
      <path d="M-1.7 -34L-0.5 -2H0.5L1.7 -34Z" fill="#F1D36E" />
      <g className="pe-bulb">
        <path d="M-5.2 -98C-7 -110 -5 -125 0 -125C5 -125 7 -110 5.2 -98Z" fill="#E2643A" />
        <path d="M-2.6 -104C-3.6 -112 -2.6 -119 -0.6 -121" fill="none" stroke="#F49A73" strokeWidth="1.3" strokeLinecap="round" />
      </g>
      <path d="M2 -104C14 -108 26 -101 25 -89C24 -77 14 -70 4 -71C-3 -72 -6 -80 -5 -90Z" fill="#B6A5EC" />
      <path d="M4 -71C14 -70 24 -77 25 -89C21 -80 13 -75 4 -75Z" fill="#9C89D8" />
      <path d={fingers} stroke="#8E7AD0" strokeWidth="5.6" strokeLinecap="round" transform="translate(0.8 0.8)" />
      <path d={fingers} stroke="#BFB0F0" strokeWidth="5" strokeLinecap="round" />
      <path d="M8 -104C5 -112 2 -120 -1 -124" fill="none" stroke="#B6A5EC" strokeWidth="5.4" strokeLinecap="round" />
      <ellipse className="pe-drop" cx="0" cy="1.6" rx="1.4" ry="1.9" fill="#F1D36E" />
    </g>
  );
}

/** La pince qui apporte le disque d'antibiotique (pointes en (0, 0)). */
function Forceps() {
  return (
    <g className="pe-forceps">
      <path d="M-1.6 -1L-7 -76L-3 -78L0.2 -2Z" fill="#AEB8C1" />
      <path d="M1.6 -1L7 -76L3 -78L-0.2 -2Z" fill="#8F9AA4" />
      <path d="M-7 -76L-3 -78L3 -78L7 -76L5 -88H-5Z" fill="#9AA5AF" />
      <path d="M-5.4 -40L-4.6 -60M5.4 -40L4.6 -60" stroke="#C9D1D8" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse className="pe-forceps__disk" cx="0" cy="1.2" rx="6.6" ry="3" fill="#FFFFFF" stroke="#D5D9CC" strokeWidth="0.6" />
    </g>
  );
}

const BUBBLES = [0, 1, 2, 3, 4, 5];
const DISHES_IN_ETUVE: [number, number][] = [[374, 80], [399, 80], [374, 103], [399, 103], [386, 126]];

/* ---------- La scène ---------- */

export default function PetriScene() {
  return (
    <>
      {/* Mur carrelé, et son aplat jusqu'en bas */}
      <div className="el-layer pe-wall" style={vars({ top: '0px', '--k': 0.3 })} />

      {/* Horloge, étagère et verrerie */}
      <div className="el-layer pe-shelf" style={vars({ top: '0px', '--k': 0.34, '--kx': 2 })}>
        <div className="pe-set">
          <svg viewBox="0 0 480 240" width="480">
            <g transform="translate(134 29)">
              <circle r="17" fill="#FFFFFF" stroke="#5E7046" strokeWidth="3" />
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d="M0 -14V-11.4" stroke="#5E7046" strokeWidth={i % 3 ? 1 : 1.8} transform={`rotate(${i * 30})`} />
              ))}
              <path d="M0 1V-8" stroke="#1E2A14" strokeWidth="2" strokeLinecap="round" transform="rotate(-62)" />
              <path d="M0 1V-12" stroke="#1E2A14" strokeWidth="1.5" strokeLinecap="round" transform="rotate(40)" />
              <path className="pe-second" d="M0 3V-13" stroke="#D9542B" strokeWidth="0.9" strokeLinecap="round" />
              <circle r="1.6" fill="#D9542B" />
            </g>
            {/* L'étagère */}
            <path d="M178 63L186 63L186 72Z M302 63L310 63L302 72Z" fill="#B19A6E" />
            <rect x="166" y="57" width="156" height="6" rx="1.2" fill="#CDB68A" />
            <rect x="166" y="61" width="156" height="2" fill="#B19A6E" />
            {/* Erlenmeyer de bouillon, qui bulle */}
            <g transform="translate(196 57)">
              <path d="M-5 -34H5V-22L16 -2.5C17 -0.6 16.2 0.6 14 0.6H-14C-16.2 0.6 -17 -0.6 -16 -2.5L-5 -22Z" fill="#EEF6F4" stroke="#A9C6C1" strokeWidth="0.9" />
              <path d="M-10.6 -12.4H10.6L16 -2.5C17 -0.6 16.2 0.6 14 0.6H-14C-16.2 0.6 -17 -0.6 -16 -2.5Z" fill="#CFDF78" />
              <path d="M-10.6 -12.4H10.6" stroke="#E4EEA6" strokeWidth="1.2" />
              <path d="M-2.8 -31V-23L-11 -6" fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
              <path d="M-5.6 -37C-7 -40 -3 -43 0 -41C3 -43 7 -40 5.6 -37C6 -34 -6 -34 -5.6 -37Z" fill="#FFFFFF" stroke="#DCD6C4" strokeWidth="0.7" />
              {BUBBLES.map((i) => (
                <circle key={i} className="pe-bubble" cx={-8 + i * 3.2} cy="-1.5" r={0.9 + (i % 3) * 0.35} fill="#F3F8D2" style={vars({ '--d': `${2.2 + (i % 3) * 0.6}s`, '--delay': `${-i * 0.55}s` })} />
              ))}
            </g>
            {/* Flacon brun étiqueté */}
            <g transform="translate(233 57)">
              <rect x="-9" y="-30" width="18" height="30" rx="3" fill="#8A4B22" />
              <rect x="-4.6" y="-37" width="9.2" height="8" fill="#7A3F1B" />
              <rect x="-5.6" y="-42" width="11.2" height="6" rx="1.4" fill="#2E3A24" />
              <rect x="-7" y="-22" width="14" height="13" rx="1" fill="#FBF5DC" />
              <path d="M-4.6 -18H4.6M-4.6 -15H2.4M-4.6 -12H3.6" stroke="#9C8E62" strokeWidth="0.9" />
              <path d="M-6.4 -27V-4" stroke="#B27245" strokeWidth="1.4" strokeLinecap="round" />
            </g>
            {/* Ballon de liquide bleu sur son valet */}
            <g transform="translate(266 57)">
              <path d="M-9 0L-6 -5H6L9 0Z" fill="#9C8664" />
              <path d="M-3.4 -40H3.4V-23.4A12.6 12.6 0 1 1 -3.4 -23.4Z" fill="#EEF6F4" stroke="#A9C6C1" strokeWidth="0.9" />
              <path d="M-11.8 -14.4H11.8A12 12 0 0 1 -11.8 -14.4Z" fill="#6FB2E6" />
              <path d="M-11.8 -14.4H11.8" stroke="#A6D1F1" strokeWidth="1.1" />
              <path d="M-7 -20A8 8 0 0 0 -8.4 -12" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
            </g>
            {/* Éprouvette graduée */}
            <g transform="translate(300 57)">
              <path d="M-8 0H8L6 -3H-6Z" fill="#A9C6C1" />
              <path d="M-4.6 -48H4.6V-3H-4.6Z" fill="#EEF6F4" stroke="#A9C6C1" strokeWidth="0.9" />
              <path d="M-4 -24H4V-3.4H-4Z" fill="#EE9EAE" />
              <path d="M-4.6 -42H-1.6M-4.6 -36H-1.6M-4.6 -30H-1.6M-4.6 -24H-1.6M-4.6 -18H-1.6M-4.6 -12H-1.6" stroke="#7E9B97" strokeWidth="0.7" />
              <path d="M2.6 -45V-6" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </div>

      {/* Paillasse : plan de travail (aplat), bec Bunsen, portoir, étuve */}
      <div className="el-layer pe-bench" style={vars({ top: '0px', '--k': 0.42, '--kx': 4 })}>
        <div className="pe-set">
          <svg viewBox="0 0 480 240" width="480">
            <Rack x={124} y={106} />
            <Bunsen />
            {/* L'étuve à 37 °C */}
            <path d="M343 141H439V145H343Z" fill="#53663A" opacity="0.14" />
            <rect x="348" y="139" width="6" height="4" fill="#8A977A" /><rect x="428" y="139" width="6" height="4" fill="#8A977A" />
            <path d="M346 24L352 18H440L436 24Z" fill="#FFFFFF" />
            <path d="M436 24L440 18V134L436 140Z" fill="#D2DBC6" />
            <rect x="346" y="24" width="90" height="116" rx="4" fill="#F4F7EE" stroke="#C9D3BA" strokeWidth="1" />
            <rect x="352" y="30" width="78" height="16" rx="3" fill="#2C3A22" />
            <text x="358" y="42" className="pe-digits">37,0 °C</text>
            <circle className="pe-lamp" cx="421" cy="38" r="3.2" fill="#FFB347" />
            <rect x="352" y="51" width="78" height="83" rx="4" fill="#E6ECDD" stroke="#C3CEB3" strokeWidth="1" />
            <rect x="359" y="58" width="56" height="69" rx="3" fill="#F9E2A6" />
            <rect className="pe-glow" x="359" y="58" width="56" height="69" rx="3" fill="#FFF3CC" />
            <path d="M359 81H415M359 104H415" stroke="#DDB66A" strokeWidth="1.6" />
            {DISHES_IN_ETUVE.map(([x, y], i) => (
              <g key={i}>
                <rect x={x - 9} y={y - 7} width="18" height="6" fill="#E9D38F" />
                <ellipse cx={x} cy={y - 1} rx="9" ry="2.2" fill="#E2C47A" />
                <ellipse cx={x} cy={y - 7} rx="9" ry="2.2" fill="#F6EBC8" stroke="#D9C38A" strokeWidth="0.6" />
                <rect x={x - 9} y={y - 10.6} width="18" height="3.6" fill="#F0E2B4" />
                <ellipse cx={x} cy={y - 10.6} rx="9" ry="2.2" fill="#FBF3DA" stroke="#D9C38A" strokeWidth="0.6" />
              </g>
            ))}
            <path d="M366 60L372 60L362 90L359 90Z M380 60L390 60L366 125L359 125Z" fill="#FFFFFF" opacity="0.35" />
            <rect x="421" y="78" width="4.4" height="24" rx="2.2" fill="#93A27F" />
          </svg>
        </div>
      </div>

      {/* Les trois boîtes de Pétri, la main qui passe de temps en temps, la pince */}
      <div className="el-layer pe-dishes" style={vars({ top: '0px', '--k': 0.55, '--kx': 7 })}>
        <div className="pe-set">
          <svg viewBox="0 0 480 240" width="480">
            <defs>
              <clipPath id="pe-lid-clip"><ellipse cx={A.cx + 1} cy={A.cy - 5} rx={A.rx + 2} ry={A.ry + 1} /></clipPath>
            </defs>

            {/* Boîte A : cultures, sous le couvercle */}
            <g>
              <DishBase d={A} gel="#E8D38E" side="#CDB46C" />
              {A_COLS.map((c, i) => <Col key={i} c={c} />)}
              <ellipse cx={A.cx + 1} cy={A.cy - 5} rx={A.rx + 2} ry={A.ry + 1} fill="#FFFFFF" opacity="0.16" />
              <path d={`M${A.cx - A.rx - 1} ${A.cy - 5}v4.5A${A.rx + 2} ${A.ry + 1} 0 0 0 ${A.cx + A.rx + 3} ${A.cy - 0.5}v-4.5`} fill="#FFFFFF" fillOpacity="0.2" stroke="#B9D2CD" strokeWidth="0.8" />
              <ellipse cx={A.cx + 1} cy={A.cy - 5} rx={A.rx + 2} ry={A.ry + 1} fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
              <g clipPath="url(#pe-lid-clip)">
                <path className="pe-sheen" d={`M${A.cx - 70} ${A.cy - 40}h12l-22 70h-12Z M${A.cx - 50} ${A.cy - 40}h5l-22 70h-5Z`} fill="#FFFFFF" opacity="0.55" />
              </g>
              <path d={`M${f(A.cx - A.rx * 0.78)} ${f(A.cy - 5 - A.ry * 0.55)}A${A.rx} ${A.ry} 0 0 1 ${f(A.cx - A.rx * 0.1)} ${f(A.cy - 5 - A.ry * 0.98)}`} fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              <Tape x={A.cx + 26} y={A.cy + 20} w={26} rot={-4} text="J+2" />
            </g>

            {/* Boîte B : l'antibiogramme */}
            <g data-tap="disque" data-tap-ms="5200">
              <DishBase d={B} gel="#E6CB86" side="#CDB06A" />
              <ellipse cx={B.cx} cy={B.cy + 2.4} rx={B.rx - 4.6} ry={B.ry - 2.3} fill="#F7EDD0" />
              <ellipse cx={B.cx - 8} cy={B.cy - 4} rx={B.rx - 26} ry={B.ry - 12} fill="#F9EFD2" opacity="0.7" />
              {DISKS.filter((d) => d.halo).map((d, i) => (
                <ellipse key={d.n} className="pe-halo" cx={d.x} cy={d.y + 0.6} rx={d.halo} ry={d.halo * 0.4} fill="#E2C277" stroke="#F1E1B2" strokeWidth="1" style={vars({ '--delay': `${-i * 2.3}s` })} />
              ))}
              <ellipse className="pe-newhalo" cx={NEW_DISK.x} cy={NEW_DISK.y + 0.6} rx="13" ry="5.2" fill="#E2C277" stroke="#F1E1B2" strokeWidth="1" />
              {VICTIMS.map((c, i) => <Col key={i} c={c} className="pe-victim" />)}
              {DISKS.map((d) => (
                <g key={d.n}>
                  <ellipse cx={d.x + 0.6} cy={d.y + 1.4} rx="6.6" ry="3" fill="#B99A55" opacity="0.4" />
                  <ellipse cx={d.x} cy={d.y + 0.6} rx="6.6" ry="3" fill="#FFFFFF" stroke="#D8D4C2" strokeWidth="0.5" />
                  <text x={d.x} y={d.y + 2.3} textAnchor="middle" className="pe-num">{d.n}</text>
                </g>
              ))}
              <g className="pe-newdisk">
                <ellipse cx={NEW_DISK.x + 0.6} cy={NEW_DISK.y + 1.4} rx="6.6" ry="3" fill="#B99A55" opacity="0.4" />
                <ellipse cx={NEW_DISK.x} cy={NEW_DISK.y + 0.6} rx="6.6" ry="3" fill="#FFFFFF" stroke="#D8D4C2" strokeWidth="0.5" />
                <text x={NEW_DISK.x} y={NEW_DISK.y + 2.3} textAnchor="middle" className="pe-num">5</text>
              </g>
              <Tape x={B.cx - 34} y={B.cy + 27} w={30} rot={3} text="ATB" />
            </g>

            {/* Boîte C : gélose neuve */}
            <g data-tap="strie" data-tap-ms="7000">
              <DishBase d={C} gel="#DCE7AA" side="#C1CF8A" />
              <ellipse cx={C.cx + 6} cy={C.cy - 1} rx={C.rx - 18} ry={C.ry - 8} fill="#E8F0C2" opacity="0.8" />
              <path className="pe-streak" d={ZIG_D} fill="none" stroke="#C3D08E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={vars({ '--len': ZIG_LEN })} />
              {STREAK_COLS.map(({ c, o }, i) => (
                <g key={i} className="pe-sc" style={vars({ '--o': o })}><Col c={c} className="pe-sc__in" /></g>
              ))}
              <ellipse className="pe-wet" cx="367" cy="207.5" rx="6.5" ry="2.6" fill="#EDF3CF" stroke="#CBD898" strokeWidth="0.7" />
              <Tape x={C.cx + 22} y={C.cy + 19} w={22} rot={-3} text="J0" />
            </g>

            <g transform="translate(367 206)"><Hand /></g>
            <g transform={`translate(${NEW_DISK.x} ${NEW_DISK.y - 0.6})`}><Forceps /></g>
          </svg>
        </div>
      </div>

      {/* Devant de la paillasse : gant et anse ; puis le sol uni */}
      <div className="el-layer pe-front" style={vars({ top: '0px', '--k': 0.7, '--kx': 10 })}>
        <div className="pe-set">
          <svg viewBox="0 0 480 240" width="480">
            <Glove transform="translate(228 221) rotate(-100)" />
            <Loop />
          </svg>
        </div>
      </div>
    </>
  );
}
