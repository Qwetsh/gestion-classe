import type { CSSProperties } from 'react';
import { scatter, seeded, vars } from '../shared';
import './theme.css';

/**
 * Thème « Conte » : il était une fois, dans la forêt. Un livre d'images en papier découpé.
 * Plans, du fond vers l'avant : ciel rose du matin et soleil, nuages de papier, colline lointaine
 * et son petit château aux toits pointus, forêt lointaine, forêt de sapins et de feuillus avec la
 * chaumière au toit de chaume, prairie avec le chemin semé de miettes de pain, le potager (citrouille,
 * haricot), le buisson du loup et les champignons, grands arbres du premier plan, feuilles qui
 * tombent. La prairie se termine par le bord d'une page, puis un sol uni couleur papier.
 * Mouvement, sans que l'élève touche à rien : les nuages passent, le soleil tourne doucement, la
 * cheminée fume, les drapeaux du château flottent, un rouge-gorge picore les miettes du chemin, deux
 * papillons volent, le loup cligne de l'œil derrière son buisson, des feuilles tombent. De temps
 * en temps, le loup traverse la forêt à pas de velours derrière les troncs (toutes les 22 s), et
 * une fée-lumière passe dans le ciel avec sa traînée d'étoiles (toutes les 27 s).
 * Au toucher : la citrouille (elle se change en carrosse, puis redevient citrouille), la chaumière
 * (la fenêtre s'allume, la porte s'ouvre, la grand-mère salue), la pousse de haricot (elle grimpe
 * jusqu'aux nuages puis redescend), le buisson (le loup surgit, s'enfuit, puis revient s'y cacher).
 */

/* ---------- Petits outils de dessin (chemins tracés dans le sens des aiguilles d'une montre) ---------- */

const f = (n: number) => n.toFixed(1);
/** Un disque. */
const disc = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
/** Un sapin à trois étages, pointe en (x, top), largeur w, pied du tronc en base. */
function fir(x: number, top: number, w: number, base: number) {
  const h = base - top - 7;
  const y1 = top + h * 0.38, y2 = top + h * 0.7, y3 = top + h;
  const w1 = w * 0.56, w2 = w * 0.8;
  const right = `M${f(x)} ${f(top)}L${f(x + w1 / 2)} ${f(y1)}L${f(x + w1 * 0.24)} ${f(y1)}L${f(x + w2 / 2)} ${f(y2)}L${f(x + w2 * 0.26)} ${f(y2)}L${f(x + w / 2)} ${f(y3)}`;
  const body = `${right}Q${f(x)} ${f(y3 + 4)} ${f(x - w / 2)} ${f(y3)}L${f(x - w2 * 0.26)} ${f(y2)}L${f(x - w2 / 2)} ${f(y2)}L${f(x - w1 * 0.24)} ${f(y1)}L${f(x - w1 / 2)} ${f(y1)}Z`;
  const shade = `${right}Q${f(x + w / 4)} ${f(y3 + 3)} ${f(x)} ${f(y3 + 4)}Z`;
  const trunk = `M${f(x - 2.6)} ${f(y3)}H${f(x + 2.6)}V${f(base)}H${f(x - 2.6)}Z`;
  return { body, shade, trunk };
}
/** Un feuillu au houppier arrondi, centre (x, cy), rayon r, pied du tronc en base. */
function leafy(x: number, cy: number, r: number, base: number) {
  const body = disc(x, cy, r) + disc(x - r * 0.62, cy + r * 0.36, r * 0.68) + disc(x + r * 0.6, cy + r * 0.32, r * 0.72);
  const light = disc(x - r * 0.3, cy - r * 0.28, r * 0.46);
  const trunk = `M${f(x - 3)} ${f(cy + r * 0.5)}H${f(x + 3)}V${f(base)}H${f(x - 3)}Z`;
  return { body, light, trunk };
}

/** Un dessin en papier découpé : l'ombre portée du papier, puis la forme. */
function Cut({ d, fill, shadow = 'rgba(70, 40, 70, 0.16)', dx = 2, dy = 2.5 }: { d: string; fill: string; shadow?: string; dx?: number; dy?: number }) {
  return (
    <>
      <path d={d} fill={shadow} transform={`translate(${dx} ${dy})`} />
      <path d={d} fill={fill} />
    </>
  );
}

/* ---------- Les plans, calculés une fois (hasard à graine : toujours la même forêt) ---------- */

/** Les plans sont dessinés bien au-delà du cadre de 480 px, pour les grands écrans. */
const X0 = -800;
const X1 = 1280;
const WIDE = `${X0} 0 ${X1 - X0}`;

/** Forêt lointaine : deux rangées de petits arbres tout le long de l'horizon. */
const FAR = (() => {
  const r = seeded(23);
  let back = '';
  let front = '';
  for (let x = X0; x < X1; x += 11 + r() * 8) {
    const fy = 100 + r() * 14;
    back += r() < 0.5 ? fir(x, fy, 15 + r() * 6, 150).body : disc(x, fy + 10, 9 + r() * 4);
  }
  for (let x = X0 + 6; x < X1; x += 12 + r() * 9) {
    const fy = 114 + r() * 14;
    front += r() < 0.55 ? fir(x, fy, 16 + r() * 7, 152).body : disc(x, fy + 10, 9 + r() * 5);
  }
  back += `M${X0} 118H${X1}V152H${X0}Z`;
  front += `M${X0} 134H${X1}V160H${X0}Z`;
  return { back, front };
})();

/** Forêt du milieu : les arbres placés à la main autour de la chaumière, puis d'autres, au hasard, plus loin. */
const MID = (() => {
  const r = seeded(41);
  const firs: [number, number, number][] = [[70, 48, 52], [116, 76, 38], [206, 86, 34], [446, 72, 40], [-22, 70, 44]];
  const leafs: [number, number, number][] = [[162, 110, 24], [232, 124, 17], [492, 108, 24], [20, 112, 22]];
  const add = (x: number) => (r() < 0.55 ? firs.push([x, 56 + r() * 34, 34 + r() * 18]) : leafs.push([x, 100 + r() * 20, 18 + r() * 8]));
  for (let x = -64; x > X0; x -= 40 + r() * 26) add(x);
  for (let x = 534; x < X1; x += 40 + r() * 26) add(x);
  const fb = firs.map(([x, t, w]) => fir(x, t, w, 182));
  const lb = leafs.map(([x, cy, rr]) => leafy(x, cy, rr, 182));
  return {
    firBody: fb.map((t) => t.body).join(''),
    firShade: fb.map((t) => t.shade).join(''),
    leafBody: lb.map((t) => t.body).join(''),
    leafLight: lb.map((t) => t.light).join(''),
    trunks: [...fb, ...lb].map((t) => t.trunk).join(''),
  };
})();

/** Prairie : bord d'herbe découpé ; en bas, le bord de la page. */
const MEADOW = (() => {
  const top = (x: number) => 175 + 2.5 * Math.sin(x / 37) + 1.5 * Math.sin(x / 13);
  let d = `M${X0} 262V${f(top(X0))}`;
  for (let x = X0; x <= X1; x += 8) d += `L${f(x)} ${f(top(x))}`;
  d += 'V262Z';
  const r = seeded(7);
  let tufts = '';
  for (let x = X0 + 4; x < X1; x += 9 + r() * 10) {
    const y = top(x) + 0.6;
    const h = 4 + r() * 3;
    tufts += `M${f(x - 4)} ${f(y)}L${f(x - 2.2)} ${f(y - h * 0.8)}L${f(x - 0.4)} ${f(y - 1)}L${f(x + 1.6)} ${f(y - h)}L${f(x + 4)} ${f(y)}Z`;
  }
  let page = `M${X0} 264V231`;
  for (let x = X0; x < X1; x += 14) page += `Q${f(x + 7)} ${f(226 + r() * 3)} ${f(x + 14)} ${f(230 + r() * 2)}`;
  page += 'V264Z';
  return { d, tufts, page };
})();

/** Fleurs de la prairie (pas sur le chemin, le buisson ni le potager). */
const FLOWERS = scatter(30, 13, (r, i) => ({
  x: X0 + 40 + ((i * 83 + r() * 60) % (X1 - X0 - 80)),
  y: 186 + r() * 36,
  c: ['#FFFFFF', '#F7C6D9', '#FFE08A'][i % 3],
})).filter((p) => (p.x < 84 || p.x > 158) && (p.x < 150 || p.x > 310) && (p.x < 336 || p.x > 438));

const LEAVES = scatter(6, 67, (r, i) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  d: `${(r() * 6 + 13).toFixed(1)}s`,
  delay: `${(-r() * 19).toFixed(1)}s`,
  dx: `${Math.round(r() * 120 - 60)}px`,
  spin: `${Math.round(r() * 360 + 260)}deg`,
  c: ['#E08A4A', '#E9B34E', '#B6C870', '#C7633F'][i % 4],
}));

const SMOKE = [0, 1, 2, 3];
const TRAIL = [1, 2, 3, 4, 5, 6];
const BUSH = disc(14, 26, 12) + disc(30, 18, 14) + disc(48, 24, 12) + disc(36, 30, 12) + 'M2 30H62V42H2Z';
const FRONT_FIR = fir(28, 14, 92, 238);
const FRONT_TREE = leafy(472, 92, 34, 238);

/* ---------- Personnages et objets ---------- */

/** Le loup, de profil, tourné vers la droite. Pas méchant : un air rusé, de grandes oreilles. */
function Wolf({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 -3 86 56" className={`ct-wolf ${className ?? ''}`} style={style}>
      <g className="ct-wolf__turn">
        <g className="ct-wolf__all">
          <path className="ct-wolf__tail" d="M17 22C8 17 0 23 1 35C3 41 9 41 11 37C10 32 13 28 19 28Z" fill="#6E7790" />
          <path d="M1 35C3 41 9 41 11 37C8 37 4 36 1 35Z" fill="#E4E6EE" />
          <path className="ct-wolf__leg ct-wolf__leg--b1" d="M19 31L18 49H22L24 33Z" fill="#646D86" />
          <path className="ct-wolf__leg ct-wolf__leg--f1" d="M49 31L50 49H54L54 32Z" fill="#646D86" />
          <path d="M14 23C19 15 42 12 55 17C62 21 63 31 57 36C46 41 25 41 17 35C12 32 11 27 14 23Z" fill="#7F889E" />
          <path d="M21 34C30 39 46 39 55 34C51 39 41 41 31 40C26 39 23 37 21 34Z" fill="#C9CDD8" />
          <path className="ct-wolf__leg ct-wolf__leg--b2" d="M25 32L25 49H29L31 34Z" fill="#7F889E" />
          <path className="ct-wolf__leg ct-wolf__leg--f2" d="M43 32L44 49H48L49 33Z" fill="#7F889E" />
          <g className="ct-wolf__head">
            <path d="M53 19C55 10 61 6 68 7C72 8 74 10 76 13L84 16.5C85.5 18 85 20.5 82.5 21L71 23.5C64 26 58 26 54 24Z" fill="#7F889E" />
            <path d="M59 22C64 24.5 70 24.5 75 21.5L82 21C79 24 71 26.5 64 26C61 25.6 59.5 24 59 22Z" fill="#E4E6EE" />
            <path d="M61 9.5L62.5 -1.5L68.5 7Z" fill="#6E7790" /><path d="M62.6 7.2L63.3 1.5L66.6 6Z" fill="#E7A7BA" />
            <path d="M66 8L70 -2L73 8.5Z" fill="#7F889E" /><path d="M68 7.3L70.3 1.4L71.6 7.6Z" fill="#E7A7BA" />
            <circle cx="84" cy="17.4" r="1.9" fill="#2D2140" />
            <path d="M75.5 20.4Q79 22.2 82.4 20.6" fill="none" stroke="#2D2140" strokeWidth="0.9" strokeLinecap="round" />
            <g className="ct-wolf__eye">
              <path d="M67.6 12.4Q70.6 9.8 73.6 12.2Q70.6 14 67.6 12.4Z" fill="#FFFDF4" />
              <circle cx="71.4" cy="12" r="1.15" fill="#2D2140" />
            </g>
            <path className="ct-wolf__lid" d="M67.2 12.6Q70.6 8.4 74 12.4Q70.6 13.6 67.2 12.6Z" fill="#7F889E" />
            <path d="M66.8 9.4Q70 7.6 73.6 9.2" fill="none" stroke="#4F5770" strokeWidth="1" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Le rouge-gorge qui picore les miettes. */
function Robin() {
  return (
    <svg viewBox="0 0 22 18" className="ct-robin">
      <g className="ct-robin__body">
        <path d="M4.5 9L0 6.4L1.2 11.2Z" fill="#6D5444" />
        <path d="M4 10C4 6 7.5 4 11.5 4.6C15 5 17 7.4 17 10.4C17 13.4 13.4 15.2 9.6 14.6C6.2 14.2 4 12.6 4 10Z" fill="#8C6C58" />
        <path d="M12 6.6C15 6.4 17 8.6 16.4 11.2C15.6 13.4 12.4 14 10.6 13C11 11 11 8.6 12 6.6Z" fill="#E36B3B" />
        <circle cx="15" cy="5.8" r="3.5" fill="#8C6C58" />
        <path d="M14.6 5.8C15.8 5.2 17.6 6 18 7.6C16.6 8.6 14.8 8.2 14.6 5.8Z" fill="#E36B3B" />
        <circle cx="15.9" cy="5" r="0.75" fill="#2D2140" />
        <path d="M18.2 5.4L21 6.2L18.2 7.1Z" fill="#E9B13A" />
        <path d="M7.5 9.2C9 8 11 8.4 11.4 10C9.8 10.8 8.4 10.6 7.5 9.2Z" fill="#6D5444" />
      </g>
      <path d="M9 14.4V17.4M11.6 14.6V17.4" stroke="#8A6247" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function Butterfly({ className, color }: { className: string; color: string }) {
  return (
    <div className={`ct-bfly ${className}`}>
      <svg viewBox="0 0 24 18" width="16">
        <g className="ct-bfly__wing"><path d="M12 9C8 0 1 2 2 7.5C3 12 8 12.5 12 9ZM12 9C8.5 12 4.5 13.5 5.5 16.6C8 17.6 11 14.5 12 9Z" fill={color} /></g>
        <g className="ct-bfly__wing ct-bfly__wing--r"><path d="M12 9C16 0 23 2 22 7.5C21 12 16 12.5 12 9ZM12 9C15.5 12 19.5 13.5 18.5 16.6C16 17.6 13 14.5 12 9Z" fill={color} /></g>
        <path d="M12 4.5V14" stroke="#2D2140" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Une petite étoile à quatre branches (étincelles de la fée, de la citrouille, du haricot). */
const STAR = 'M0 -5C0.6 -1.2 1.2 -0.6 5 0C1.2 0.6 0.6 1.2 0 5C-0.6 1.2 -1.2 0.6 -5 0C-1.2 -0.6 -0.6 -1.2 0 -5Z';
const CLOUD = 'M2 24C0 17 6 12 13 14C14 6 24 1 32 6C37 0 50 1 52 11C59 10 64 16 62 24Z';

/** Un nuage de papier (bas plat). */
function Cloud({ x, y, w }: { x: string; y: number; w: number }) {
  return (
    <svg viewBox="0 0 64 26" className="ct-cloud" style={{ left: x, top: y, width: w }}>
      <path d={CLOUD} fill="#EBCFCB" transform="translate(1.5 2)" />
      <path d={CLOUD} fill="#FFFFFF" />
    </svg>
  );
}

/* ---------- La scène ---------- */

export default function ConteScene() {
  return (
    <>
      {/* Ciel et soleil */}
      <div className="el-layer ct-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        <div className="ct-set">
          <svg viewBox="0 0 480 120" width="480">
            <g className="ct-rays">
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d="M176 9L180.5 16.5L171.5 16.5Z" fill="#FBD9A2" transform={`rotate(${i * 30} 176 40)`} />
              ))}
            </g>
            <circle cx="176" cy="40" r="19" fill="#FCD993" />
            <circle cx="176" cy="40" r="15" fill="#FFE8B2" />
          </svg>
        </div>
      </div>

      {/* Nuages de papier qui dérivent */}
      <div className="el-layer ct-clouds" style={vars({ top: '6px', '--k': 0.34, '--kx': 3 })}>
        <div className="ct-drift">
          {[0, 1].map((set) => (
            <div key={set} className="ct-cloudset">
              <Cloud x="4%" y={10} w={74} />
              <Cloud x="40%" y={30} w={52} />
              <Cloud x="70%" y={2} w={92} />
            </div>
          ))}
        </div>
      </div>

      {/* Colline lointaine et son château */}
      <div className="el-layer ct-hill" style={vars({ top: '0px', '--k': 0.38, '--kx': 4 })}>
        <div className="ct-set">
          <svg viewBox={`${WIDE} 262`} width={X1 - X0} className="ct-wide">
            <path d={`M${X0} 104C-600 92 -420 98 -300 106C-200 112 -60 92 40 98C150 104 250 96 330 92C370 89 420 88 460 94C560 110 700 96 820 104C960 112 1100 96 ${X1} 104V262H${X0}Z`} fill="#E6D8E6" />
            <g className="ct-castle">
              <path d="M391 20V11.5M368 34V27" stroke="#7B5C83" strokeWidth="1.2" />
              <path className="ct-flag" d="M391 11.5L400 13.5L391 16Z" fill="#9C2F6B" />
              <path className="ct-flag ct-flag--b" d="M368 27L375 28.6L368 30.4Z" fill="#9C2F6B" />
              <path d="M372 66H412V96H372Z" fill="#EFE3EC" />
              <path d="M372 62h4.4v4h-4.4ZM380 62h4.4v4h-4.4ZM404 62h4.4v4h-4.4Z" fill="#EFE3EC" />
              <path d="M404 66H412V96H404Z" fill="#DCCADC" />
              <path d="M362 56H374V97H362Z" fill="#F3E9F0" /><path d="M370 56H374V97H370Z" fill="#DCCADC" />
              <path d="M360 57L368 34L376 57Z" fill="#BC6893" /><path d="M368 34L376 57H368Z" fill="#A0517B" />
              <path d="M410 60H421V97H410Z" fill="#F3E9F0" /><path d="M417.5 60H421V97H417.5Z" fill="#DCCADC" />
              <path d="M408 61L415.5 40L423 61Z" fill="#BC6893" /><path d="M415.5 40L423 61H415.5Z" fill="#A0517B" />
              <path d="M382 46H400V82H382Z" fill="#F6EEF3" /><path d="M395.5 46H400V82H395.5Z" fill="#DCCADC" />
              <path d="M379 47L391 20L403 47Z" fill="#BC6893" /><path d="M391 20L403 47H391Z" fill="#A0517B" />
              <path d="M398 40H404.5V54H398Z" fill="#F6EEF3" />
              <path d="M396.5 41L401.2 28L406 41Z" fill="#BC6893" /><path d="M401.2 28L406 41H401.2Z" fill="#A0517B" />
              <path d="M388.6 59V55.4A2.4 2.4 0 0 1 393.4 55.4V59ZM366 66h3v5h-3ZM413.5 70h3v5h-3ZM386 96V89A5 5 0 0 1 396 89V96Z" fill="#7B5C83" />
            </g>
            <path d="M340 97C360 93 380 92 400 93C420 94 440 95 460 98C450 104 350 104 340 97Z" fill="#E6D8E6" />
          </svg>
        </div>
      </div>

      {/* Forêt lointaine */}
      <div className="el-layer ct-far" style={vars({ top: '0px', '--k': 0.44, '--kx': 5 })}>
        <div className="ct-set">
          <svg viewBox={`${WIDE} 160`} width={X1 - X0} className="ct-wide">
            <Cut d={FAR.back} fill="#C8D9B6" shadow="rgba(90, 60, 100, 0.10)" dx={1.5} dy={2} />
            <Cut d={FAR.front} fill="#AFC89F" shadow="rgba(60, 70, 60, 0.14)" dx={1.5} dy={2} />
          </svg>
        </div>
      </div>

      {/* Forêt du milieu, la chaumière, et le loup qui passe derrière les arbres */}
      <div className="el-layer ct-mid" style={vars({ top: '0px', '--k': 0.52, '--kx': 7 })}>
        <div className="ct-set">
          <div className="ct-prowl"><Wolf className="ct-wolf--walk" style={{ width: 44 }} /></div>
          <svg viewBox={`${WIDE} 190`} width={X1 - X0} className="ct-wide">
            <path d={MID.trunks} fill="#8A6650" />
            <Cut d={MID.leafBody} fill="#8DB878" />
            <path d={MID.leafLight} fill="#A3C78C" />
            <Cut d={MID.firBody} fill="#6F9D6B" />
            <path d={MID.firShade} fill="#5E8C5F" />

            {/* La chaumière (toucher : la grand-mère salue) */}
            <g data-tap="chaumiere" data-tap-ms="4800">
              <path d="M314 112V84H328V112Z" fill="#AD9C93" />
              <path d="M314 92H321M321 99H328M314 105H322" stroke="#8F7E77" strokeWidth="1.2" />
              <path d="M312 80H330V86H312Z" fill="#8F7E77" />
              <path d="M248 128H326V186H248Z" fill="rgba(70, 40, 70, 0.16)" transform="translate(2.5 2)" />
              <path d="M248 128H326V186H248Z" fill="#F6E7CD" />
              <path d="M248 128H251V186H248ZM323 128H326V186H323ZM248 128H326V132H248ZM251 132L262 145H265L254 132ZM323 132L312 145H309L320 132Z" fill="#9B6B4B" />
              {/* Fenêtre et volets */}
              <path d="M251 145H257V165H251ZM279 145H285V165H279Z" fill="#9C2F6B" />
              <path d="M252.5 149H255.5M252.5 153H255.5M252.5 157H255.5M252.5 161H255.5M280.5 149H283.5M280.5 153H283.5M280.5 157H283.5M280.5 161H283.5" stroke="#7C2254" strokeWidth="1" />
              <path d="M257 144H279V166H257Z" fill="#9B6B4B" />
              <path d="M259 146H277V164H259Z" fill="#4E4262" />
              <path className="ct-lamp" d="M259 146H277V164H259Z" fill="#FFD56B" />
              <path className="ct-lamp" d="M262 152C264 149 269 149 271 152C269 155 264 155 262 152Z" fill="#FFF3C9" />
              <path d="M268 146V164M259 155H277" stroke="#9B6B4B" strokeWidth="1.8" />
              <path d="M255 165H281V170H255Z" fill="#8C5A3C" />
              <circle cx="259" cy="164" r="1.8" fill="#D2483E" /><circle cx="264" cy="163.4" r="1.8" fill="#FFFFFF" /><circle cx="269" cy="164" r="1.8" fill="#D2483E" /><circle cx="274" cy="163.4" r="1.8" fill="#F7C6D9" /><circle cx="278" cy="164" r="1.6" fill="#D2483E" />
              {/* La porte, et derrière elle la grand-mère */}
              <path d="M290 186V156C290 151 294 148 299 148C304 148 308 151 308 156V186Z" fill="#3B2A35" />
              <g className="ct-granny">
                <path d="M292 184C292 172 295 165 299 165C303 165 306 172 306 184Z" fill="#5B6BA6" />
                <path d="M296 184V172C296 170 302 170 302 172V184Z" fill="#FFFFFF" />
                <path d="M293 169.5C294 164.5 304 164.5 305 169.5C302 172.4 296 172.4 293 169.5Z" fill="#9C2F6B" />
                <circle cx="299" cy="159.4" r="4.7" fill="#F3C9AC" />
                <path d="M294.3 158.6C293.6 153.2 304.4 153.2 303.7 158.6C302.2 155.8 295.8 155.8 294.3 158.6Z" fill="#EDEDF4" />
                <circle cx="299" cy="153.4" r="2.3" fill="#EDEDF4" />
                <circle cx="297.3" cy="159.8" r="1.35" fill="none" stroke="#2D2140" strokeWidth="0.6" />
                <circle cx="300.7" cy="159.8" r="1.35" fill="none" stroke="#2D2140" strokeWidth="0.6" />
                <circle cx="296" cy="161.8" r="0.9" fill="#EBA0A0" /><circle cx="302" cy="161.8" r="0.9" fill="#EBA0A0" />
                <path d="M297.8 162.4Q299 163.4 300.2 162.4" fill="none" stroke="#7C2254" strokeWidth="0.6" strokeLinecap="round" />
                <g className="ct-granny__arm">
                  <path d="M304 168.5C307 166.5 309.2 163.6 310.4 159.6" fill="none" stroke="#9C2F6B" strokeWidth="2.8" strokeLinecap="round" />
                  <circle cx="310.6" cy="158.4" r="1.8" fill="#F3C9AC" />
                </g>
              </g>
              <g className="ct-door">
                <path d="M290 186V156C290 151 294 148 299 148C304 148 308 151 308 156V186Z" fill="#8C5A3C" />
                <path d="M294.5 150V186M299 148V186M303.5 150V186" stroke="#744830" strokeWidth="0.9" />
                <path d="M291 158H307M291 174H307" stroke="#744830" strokeWidth="1.6" />
                <circle cx="305" cy="167" r="1.2" fill="#E2B43B" />
              </g>
              {/* Le toit de chaume */}
              <path d="M236 142C234 124 246 104 262 97C274 92 300 90 314 94C330 100 342 122 340 142C334 148 318 147 312 143C300 149 284 149 274 143C262 149 244 149 236 142Z" fill="rgba(70, 40, 70, 0.16)" transform="translate(2 3)" />
              <path d="M236 142C234 124 246 104 262 97C274 92 300 90 314 94C330 100 342 122 340 142C334 148 318 147 312 143C300 149 284 149 274 143C262 149 244 149 236 142Z" fill="#DFAE5A" />
              <path d="M258 104C254 118 252 130 250 144M272 96C270 112 268 128 268 145M288 93C288 110 288 128 289 146M304 93C306 110 308 126 310 143M320 98C324 112 328 126 330 143M246 120C244 128 242 134 241 141" fill="none" stroke="#C48E40" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M258 100C274 90 302 88 320 97C302 93 276 94 258 100Z" fill="#EDC77E" />
            </g>
            {/* Fumée de la cheminée */}
            {SMOKE.map((i) => (
              <circle key={i} className="ct-puff" cx="321" cy="76" r={5 + i * 0.4} style={vars({ '--delay': `${-i * 1.25}s` })} />
            ))}
          </svg>
        </div>
      </div>

      {/* Prairie, chemin aux miettes, potager, buisson du loup */}
      <div className="el-layer ct-meadow" style={vars({ top: '0px', '--k': 0.62, '--kx': 9 })}>
        <div className="ct-fill" />
        <div className="ct-set">
          <svg viewBox={`${WIDE} 264`} width={X1 - X0} className="ct-wide">
            <path d={MEADOW.d} fill="rgba(70, 60, 50, 0.16)" transform="translate(0 -2)" />
            <path d={MEADOW.d} fill="#C9DE9C" />
            <path d={MEADOW.tufts} fill="#C9DE9C" />
            <path d={`M${X0} 264V206C-400 200 0 212 240 204C480 198 800 210 ${X1} 204V264Z`} fill="#BFD78F" />
            {FLOWERS.map((p, i) => (
              <g key={i}><circle cx={f(p.x)} cy={f(p.y)} r="2.2" fill={p.c} /><circle cx={f(p.x)} cy={f(p.y)} r="0.9" fill="#E9A23B" /></g>
            ))}
            {/* Le chemin et ses miettes de pain */}
            <path d="M150 234C170 214 232 212 248 200C262 190 282 188 291 178H306C306 192 286 198 272 206C252 220 216 222 214 234Z" fill="#E3C99B" transform="translate(0 1.5)" />
            <path d="M150 234C170 214 232 212 248 200C262 190 282 188 291 178H306C306 192 286 198 272 206C252 220 216 222 214 234Z" fill="#F4E5C6" />
            <path d="M196 226h2.6v1.8h-2.6ZM214 220h2.2v1.6h-2.2ZM229 214.5h2.6v1.8h-2.6ZM252 204h2.2v1.6h-2.2ZM265 197h2.6v1.8h-2.6ZM279 190h2.2v1.6h-2.2ZM293 184h2.4v1.7h-2.4Z" fill="#C2894E" />
            {/* Champignons */}
            <path d="M168.5 207H171.5V214H168.5ZM181 210.5H183.4V215H181ZM223.6 194H226V199H223.6Z" fill="#F6EBDD" />
            <path d="M162 208C162 200 178 200 178 208Z" fill="#D2483E" />
            <path d="M177 211.4C177 206 187.4 206 187.4 211.4Z" fill="#D2483E" />
            <path d="M220 195.5C220 190.5 229.6 190.5 229.6 195.5Z" fill="#B57B4E" />
            <circle cx="166" cy="205" r="1.2" fill="#FFFFFF" /><circle cx="171" cy="203" r="1.4" fill="#FFFFFF" /><circle cx="175" cy="206" r="1" fill="#FFFFFF" /><circle cx="181" cy="208.6" r="0.9" fill="#FFFFFF" /><circle cx="184.6" cy="209.4" r="0.8" fill="#FFFFFF" />
            {/* Le potager : clôture, terre */}
            <path d="M344 182H432M344 188H432" stroke="#B88D63" strokeWidth="1.8" />
            <path d="M345 176l2 -3l2 3v16h-4ZM359 176l2 -3l2 3v16h-4ZM373 176l2 -3l2 3v16h-4ZM387 176l2 -3l2 3v16h-4ZM401 176l2 -3l2 3v16h-4ZM415 176l2 -3l2 3v16h-4ZM429 176l2 -3l2 3v16h-4Z" fill="#CFA77C" />
            <path d="M340 206C344 196 428 194 436 204C432 214 344 216 340 206Z" fill="#B98B60" />
            <path d="M350 205C370 202 400 202 426 205M352 210C372 207 400 207 422 210" fill="none" stroke="#A47850" strokeWidth="1.2" strokeLinecap="round" />
            {/* Le bord de la page */}
            <path d={MEADOW.page} fill="rgba(90, 60, 50, 0.14)" transform="translate(0 -2)" />
            <path d={MEADOW.page} fill="#FBF1E6" />
          </svg>

          {/* La citrouille, qui devient carrosse */}
          <svg viewBox="0 0 70 60" className="ct-pumpkin">
            <g className="ct-pumpkin__fruit" data-tap="citrouille" data-tap-ms="4400">
              <path d="M13 52C10 46 14 40 22 41" fill="none" stroke="#6E9A45" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M14 46C8 44 6 38 10 34C15 36 17 41 14 46Z" fill="#7FAE52" />
              <ellipse cx="25" cy="47" rx="10" ry="9.5" fill="#DC7A24" />
              <ellipse cx="45" cy="47" rx="10" ry="9.5" fill="#DC7A24" />
              <ellipse cx="35" cy="46.5" rx="15" ry="10.5" fill="#E8892F" />
              <ellipse cx="35" cy="47" rx="7" ry="10.5" fill="#F39B3C" />
              <path d="M28 39C26 44 26 50 28 55M42 39C44 44 44 50 42 55" fill="none" stroke="#C86A1C" strokeWidth="1" />
              <path d="M34 37C34 33 36 31 39 30L40 32C38 33 37 35 37 37.5Z" fill="#6B8B3E" />
              <path d="M38 32C42 28 48 30 48 34" fill="none" stroke="#6E9A45" strokeWidth="1.2" strokeLinecap="round" />
            </g>
            <g className="ct-coach">
              <path d="M10 49H60" stroke="#C99A2E" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M13 42C10 22 22 10 35 10C48 10 60 22 57 42C50 48 20 48 13 42Z" fill="#F2A541" />
              <path d="M24 13C19 22 19 34 22 45M46 13C51 22 51 34 48 45" fill="none" stroke="#DB8A2B" strokeWidth="1.4" />
              <path d="M26 20H44C46 20 47 21 47 23V33H23V23C23 21 24 20 26 20Z" fill="#FFF3D2" />
              <path d="M23 23C27 26 31 26 33 22V33H23ZM47 23C43 26 39 26 37 22V33H47Z" fill="#9C2F6B" />
              <path d="M31 10C31 5 35 4 35 0C35 4 39 5 39 10Z" fill="#E2B43B" />
              <circle cx="35" cy="1" r="1.6" fill="#E2B43B" />
              <path d="M11 40C6 38 5 34 7 31M59 40C64 38 65 34 63 31" fill="none" stroke="#E2B43B" strokeWidth="1.6" strokeLinecap="round" />
              <g className="ct-wheel">
                <circle cx="19" cy="49" r="8.5" fill="none" stroke="#E2B43B" strokeWidth="2.4" />
                <path d="M19 41V57M11 49H27M13.4 43.4L24.6 54.6M24.6 43.4L13.4 54.6" stroke="#C99A2E" strokeWidth="1.1" />
                <circle cx="19" cy="49" r="2" fill="#C99A2E" />
              </g>
              <g className="ct-wheel ct-wheel--b">
                <circle cx="51" cy="49" r="8.5" fill="none" stroke="#E2B43B" strokeWidth="2.4" />
                <path d="M51 41V57M43 49H59M45.4 43.4L56.6 54.6M56.6 43.4L45.4 54.6" stroke="#C99A2E" strokeWidth="1.1" />
                <circle cx="51" cy="49" r="2" fill="#C99A2E" />
              </g>
            </g>
            <g className="ct-poof">
              {[[12, 26], [58, 24], [35, 6], [6, 46], [64, 46], [24, 14], [48, 12]].map(([x, y], i) => (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <path className="ct-poof__star" d={STAR} fill={i % 3 ? '#F6C453' : '#FFFFFF'} style={vars({ '--n': i })} />
                </g>
              ))}
            </g>
          </svg>

          {/* Le haricot magique */}
          <svg viewBox="0 0 60 220" className="ct-bean">
            <g className="ct-bean__stalk">
              <path d="M30 216C22 190 40 170 30 146C20 122 40 102 30 78C22 56 38 36 30 16" fill="none" stroke="#5E9B48" strokeWidth="4.4" strokeLinecap="round" />
              <path d="M30 216C38 196 22 176 32 154C42 132 22 112 32 90C40 70 24 50 32 26" fill="none" stroke="#7DB85E" strokeWidth="2" strokeLinecap="round" />
            </g>
            {[[30, 190, 1], [30, 164, -1], [30, 136, 1], [30, 108, -1], [31, 82, 1], [30, 56, -1], [31, 32, 1]].map(([x, y, s], i) => (
              <path key={i} className="ct-bean__leaf" style={vars({ '--n': i, transformOrigin: `${x}px ${y}px` })} d={`M${x} ${y}C${x + 6 * s} ${y - 9} ${x + 18 * s} ${y - 8} ${x + 19 * s} ${y - 1}C${x + 16 * s} ${y + 6} ${x + 7 * s} ${y + 6} ${x} ${y}Z`} fill={i % 2 ? '#6FAE52' : '#86C266'} />
            ))}
            <g transform="translate(0 22)"><g className="ct-bean__cloud">
              <path d="M6 22C4 15 10 10 17 12C18 4 28 0 34 5C39 0 50 2 51 11C57 10 60 16 58 22Z" fill="#EBCFCB" transform="translate(1.5 2)" />
              <path d="M6 22C4 15 10 10 17 12C18 4 28 0 34 5C39 0 50 2 51 11C57 10 60 16 58 22Z" fill="#FFFFFF" />
            </g></g>
            <g className="ct-bean__sprout" data-tap="haricot" data-tap-ms="5200">
              <path d="M27.6 194H32.4V216H27.6Z" fill="#B88D63" />
              <path d="M30 216C30 210 30 206 30 201" stroke="#5E9B48" strokeWidth="2" strokeLinecap="round" />
              <path d="M30 205C26 198 20 199 19 203C22 207 27 207 30 205ZM30 202C34 195 40 196 41 200C38 204 33 204 30 202Z" fill="#7DB85E" />
            </g>
            <g transform="translate(40 188)"><path className="ct-bean__glint" d={STAR} fill="#F6C453" /></g>
          </svg>

          {/* Le rouge-gorge sur le chemin */}
          <div className="ct-robinbox"><Robin /></div>

          {/* Le loup caché derrière son buisson (toucher : il surgit et s'enfuit) */}
          <div className="ct-hideout">
            <Wolf className="ct-wolf--bush" style={{ width: 56 }} />
          </div>
          <svg viewBox="0 0 70 44" className="ct-bush">
            <g className="ct-bush__shake" data-tap="loup" data-tap-ms="3800">
              <path d={BUSH} fill="rgba(70, 40, 70, 0.16)" transform="translate(2 2)" />
              <path d={BUSH} fill="#6E9E5E" />
              <path d={disc(26, 14, 6) + disc(46, 21, 5) + disc(11, 23, 5)} fill="#84B272" />
              <circle cx="20" cy="32" r="1.6" fill="#D2483E" /><circle cx="40" cy="34" r="1.6" fill="#D2483E" /><circle cx="52" cy="28" r="1.5" fill="#D2483E" /><circle cx="31" cy="26" r="1.4" fill="#D2483E" />
            </g>
          </svg>

          <Butterfly className="ct-bfly--a" color="#F3D55B" />
          <Butterfly className="ct-bfly--b" color="#D7B0EA" />
        </div>
      </div>

      {/* Grands arbres du premier plan, sur les bords */}
      <div className="el-layer ct-front" style={vars({ top: '0px', '--k': 0.8, '--kx': 13 })}>
        <div className="ct-set">
          <svg viewBox="0 0 480 240" width="480">
            <Cut d={FRONT_FIR.body} fill="#4F7D57" shadow="rgba(50, 30, 50, 0.2)" dx={3} dy={3} />
            <path d={FRONT_FIR.shade} fill="#426F4C" />
            <path d={FRONT_FIR.trunk} fill="#6E4F3E" />
            <path d="M465 110H473V238H465Z" fill="#6E4F3E" />
            <Cut d={FRONT_TREE.body} fill="#6B9A5D" shadow="rgba(50, 30, 50, 0.2)" dx={3} dy={3} />
            <path d={FRONT_TREE.light} fill="#80AE70" />
          </svg>
        </div>
      </div>

      {/* La fée-lumière, qui passe de temps en temps avec sa traînée d'étoiles */}
      <div className="el-layer ct-fairylayer" style={vars({ top: '0px', '--k': 0.4, '--kx': 4 })}>
        <div className="ct-set">
          {TRAIL.map((i) => (
            <div key={i} className="ct-fairy-x" style={vars({ '--lag': `${i * 0.09}s` })}>
              <div className="ct-fairy-y">
                <svg viewBox="-6 -6 12 12" className="ct-spark" style={vars({ '--s': (1 - i * 0.11).toFixed(2) })}><path d={STAR} fill={i % 2 ? '#F6C453' : '#FFF3C2'} /></svg>
              </div>
            </div>
          ))}
          <div className="ct-fairy-x"><div className="ct-fairy-y"><span className="ct-fairy" /></div></div>
        </div>
      </div>

      {/* Feuilles qui tombent */}
      <div className="ct-leaves">
        {LEAVES.map((l, i) => (
          <svg key={i} viewBox="0 0 12 8" className="ct-leaf" style={vars({ '--x': l.x, '--d': l.d, '--delay': l.delay, '--dx': l.dx, '--spin': l.spin })}>
            <path d="M0 4C3 -0.5 9 -0.5 12 4C9 8.5 3 8.5 0 4Z" fill={l.c} />
          </svg>
        ))}
      </div>
    </>
  );
}
