import type { CSSProperties } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Théâtre » : lever de rideau sur une scène à l'italienne, vue depuis la salle.
 * Plans, du fond vers l'avant : toile de fond peinte (un ciel en bandes, des collines), machinerie
 * suspendue à des fils (soleil, lune, nuage en carton), trois rangs de vagues en carton, plancher
 * de scène avec deux comédiens en costume du XVIIe siècle, la rampe de lumières et les faisceaux
 * des projecteurs, puis le cadre de scène doré (lambrequin, grands rideaux rouges retenus par des
 * embrasses, masques de la comédie et de la tragédie), enfin les têtes des spectateurs en ombres
 * chinoises.
 * Mouvement, sans que l'élève touche à rien : les vagues roulent en rangs alternés, le nuage et
 * les astres se balancent au bout de leur fil, le comédien déclame en levant le bras, la dame
 * s'évente, les flammes de la rampe vacillent, des poussières flottent dans la lumière, une
 * spectatrice lève sa lorgnette, un spectateur se penche vers son voisin. De temps en temps : un
 * projecteur balaye la scène ; le soleil en carton descend derrière les vagues, la toile passe à
 * la nuit, la lune monte et les étoiles s'allument, puis le jour revient.
 * Au toucher : les comédiens (salut profond, le chapeau à plumes balaye le plancher, des roses
 * tombent sur la scène, la salle applaudit), les vagues (tempête : les vagues s'agitent, le nuage
 * s'assombrit, un éclair en carton descend au bout d'un fil, une petite barque traverse la scène),
 * les masques du cadre (la comédie rit aux éclats, la tragédie soupire).
 */

/** Rayons du soleil en carton : étoile à 24 pointes autour de (30, 30). */
const SUN_RAYS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  const r = i % 2 ? 15 : i % 4 ? 22 : 25;
  return `${(30 + Math.cos(a) * r).toFixed(1)},${(30 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

/** Une rangée de vagues en carton : bosses qui se recourbent, de 0 à `w`, posées sur `base`. */
function wavePath(w: number, period: number, amp: number, base: number, h: number): string {
  let d = `M0 ${h}V${base}`;
  for (let x = 0; x < w; x += period) {
    d += `C${x + period * 0.3} ${base - amp * 1.1} ${x + period * 0.62} ${base - amp * 1.25} ${x + period * 0.7} ${base - amp * 0.45}`;
    d += `Q${x + period * 0.8} ${base + 2} ${x + period} ${base}`;
  }
  return `${d}V${h}Z`;
}
/** Les volutes claires peintes sur la crête de chaque vague. */
function curlPath(w: number, period: number, amp: number, base: number): string {
  let d = '';
  for (let x = 0; x < w; x += period) {
    d += `M${x + period * 0.38} ${base - amp * 0.9}q${period * 0.16} ${-amp * 0.42} ${period * 0.3} ${amp * 0.18}q${-period * 0.08} ${-amp * 0.08} ${-period * 0.12} ${amp * 0.26}`;
  }
  return d;
}

function Wave({ top, fill, crest, period, amp, cls }: { top: number; fill: string; crest: string; period: number; amp: number; cls: string }) {
  return (
    <svg viewBox="0 0 560 44" className={`th-wave ${cls}`} style={{ top }}>
      <path d={wavePath(560, period, amp, 16, 44)} fill={fill} />
      <path d={curlPath(560, period, amp, 16)} fill="none" stroke={crest} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Étoiles de la toile de nuit. */
const STARS = scatter(9, 37, (r) => ({
  x: Math.round(140 + r() * 210),
  y: Math.round(50 + r() * 48),
  s: +(r() * 0.5 + 0.7).toFixed(2),
  d: `${(r() * 2 + 3).toFixed(1)}s`,
  delay: `${(-r() * 4).toFixed(1)}s`,
}));
const starPath = (x: number, y: number, s: number) =>
  `M${x} ${y - 4 * s}L${x + s} ${y - s}L${x + 4 * s} ${y}L${x + s} ${y + s}L${x} ${y + 4 * s}L${x - s} ${y + s}L${x - 4 * s} ${y}L${x - s} ${y - s}Z`;

/** Poussières qui flottent dans la lumière des projecteurs. */
const MOTES = scatter(9, 83, (r) => ({
  x: `${Math.round(196 + r() * 110)}px`,
  y: `${Math.round(70 + r() * 90)}px`,
  d: `${(r() * 6 + 8).toFixed(1)}s`,
  delay: `${(-r() * 12).toFixed(1)}s`,
  dx: `${Math.round(r() * 24 - 12)}px`,
}));

/** Roses lancées au salut : point de chute sur le plancher, angle, retard. */
const ROSES = scatter(7, 29, (r, i) => ({
  x: `${Math.round(176 + i * 22 + r() * 10)}px`,
  y: `${Math.round(178 + r() * 12)}px`,
  rot: `${Math.round(r() * 80 - 40)}deg`,
  spin: `${Math.round(r() * 300 + 260)}deg`,
  dx: `${Math.round(r() * 60 - 30)}px`,
  delay: `${(0.55 + r() * 0.9).toFixed(2)}s`,
}));

/** Flammes de la rampe, au bord de la scène. */
const FOOTLIGHTS = Array.from({ length: 10 }, (_, i) => 70 + i * 38);

/** Fil d'un décor suspendu : il monte bien au-delà du lambrequin. */
function Wire({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} -260V${y}`} stroke="#E8D5B0" strokeOpacity="0.55" strokeWidth="0.7" fill="none" />;
}

/** Le comédien : justaucorps, perruque, chapeau à plumes, un bras levé pour déclamer. */
function Actor({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 100" className="th-man" style={style}>
      <g className="th-man__all">
        {/* Jambes, souliers à talons rouges, rhingrave */}
        <path d="M22 74h5.5l-.5 23h-4.5zM32.5 74H38l-.5 23H33z" fill="#F2E8D8" />
        <path d="M21.6 77.5h6.4v2.2h-6.4zM32.2 77.5h6.4v2.2h-6.4z" fill="#C8283A" />
        <path d="M18 100v-2.6q3.4-2.6 9.6-1V100zM32.4 100v-3.6q6.2-1.6 9.6 1V100z" fill="#2A1712" />
        <path d="M18 98.6h2.6V100H18zM39.4 98.6H42V100h-2.6z" fill="#C8283A" />
        <path d="M23.4 95.8l-2.6-1.6v3.2zM23.4 95.8l2.6-1.6v3.2zM36.6 95.8l-2.6-1.6v3.2zM36.6 95.8l2.6-1.6v3.2z" fill="#F2B544" />
        <path d="M17 62h26l2 13q-15 4-30 0z" fill="#8E2F3C" />
        <path d="M15 75q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0" fill="none" stroke="#F2B544" strokeWidth="1.1" />
        <g className="th-man__upper">
          {/* Justaucorps, écharpe, jabot de dentelle */}
          <path d="M19 34Q30 30.5 41 34L44.5 68Q30 72.5 15.5 68Z" fill="#2F6F62" />
          <path d="M30 32.5Q36 32.6 41 34L44.5 68Q37 70.6 30 70.8Z" fill="#285F54" />
          <path d="M30 37V71M15.5 68Q30 72.5 44.5 68" fill="none" stroke="#F2B544" strokeWidth="1.2" />
          <path d="M18.5 57h7l-.5 2.6h-6zM34.5 57h7l.5 2.6h-7z" fill="#24564C" stroke="#F2B544" strokeWidth="0.7" />
          <path d="M21 35L40.5 58.5l-2.8 1.8L19 37.6Z" fill="#C8283A" />
          <circle cx="31.8" cy="45" r="0.9" fill="#FFD77A" /><circle cx="31.8" cy="50" r="0.9" fill="#FFD77A" />
          <circle cx="31.8" cy="64" r="0.9" fill="#FFD77A" />
          <path d="M26.5 30.5h7l.8 6.5q-4.3 4.5-8.6 0z" fill="#FFF6E6" />
          <path d="M27 34.4q3 1.6 6 0M27.4 37q2.6 1.4 5.2 0" fill="none" stroke="#E2D2BC" strokeWidth="0.6" />
          {/* Bras gauche, le poing sur la hanche */}
          <path d="M20.5 37Q14 44 14.5 50.5Q16.5 55 21 56" fill="none" stroke="#2F6F62" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.8 51.4l5.6 1.6-1.4 4.4-5.8-1.8z" fill="#F2B544" />
          <circle cx="22.4" cy="56.6" r="2" fill="#F2C7A0" />
          {/* Bras droit, levé pour déclamer */}
          <g className="th-man__arm">
            <path d="M39.5 37L47 43.5L52.5 36.5" fill="none" stroke="#2F6F62" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M49.4 37.8l4.6-4.4 2.8 2.8-4.4 4.4z" fill="#F2B544" />
            <path d="M54.6 34q1.8-.4 2.8 1.2q-.3 1.6-2 2.4z" fill="#FFF6E6" />
            <circle cx="56.6" cy="32.4" r="2.1" fill="#F2C7A0" />
          </g>
        </g>
        <g className="th-man__head">
          {/* Perruque bouclée, visage, moustache */}
          <path d="M20.5 18Q20.5 9 30 9Q39.5 9 39.5 18Q41.5 26 41.6 34Q42 39 37.8 39.5Q35.5 37 36 31Q35 26 35 24H25Q25 26 24 31Q24.5 37 22.2 39.5Q18 39 18.4 34Q18.5 26 20.5 18Z" fill="#5A3A24" />
          <path d="M20.2 25q2 1.6 0 3.6q2 1.6 0 3.6q2 1.6 0 3.6M39.8 25q-2 1.6 0 3.6q-2 1.6 0 3.6q-2 1.6 0 3.6" fill="none" stroke="#80583A" strokeWidth="1.2" />
          <path d="M27.8 26h4.4v5h-4.4z" fill="#E2B08C" />
          <ellipse cx="30" cy="21" rx="5.6" ry="6.6" fill="#F2C7A0" />
          <path d="M24.4 17.6Q25 12.4 30 12.4Q35 12.4 35.6 17.6Q33 14.8 30 15.2Q27 14.8 24.4 17.6Z" fill="#5A3A24" />
          <circle cx="27.6" cy="20.6" r="0.8" fill="#2A1712" /><circle cx="32.4" cy="20.6" r="0.8" fill="#2A1712" />
          <path d="M26.3 18.8q1.3-.8 2.6 0M31.1 18.8q1.3-.8 2.6 0" fill="none" stroke="#3E2616" strokeWidth="0.7" strokeLinecap="round" />
          <path d="M30 21.2v2.2h.9" fill="none" stroke="#C98B6A" strokeWidth="0.6" strokeLinecap="round" />
          <circle cx="26.4" cy="23.4" r="1.1" fill="#EA9A86" opacity="0.6" /><circle cx="33.6" cy="23.4" r="1.1" fill="#EA9A86" opacity="0.6" />
          <path d="M27.2 25.4q1.4-1.3 2.8-.4q1.4-.9 2.8.4q-1.4-.2-2.8.5q-1.4-.7-2.8-.5z" fill="#3E2616" />
          <path d="M28.7 26.7q1.3.9 2.6 0" fill="none" stroke="#A2483A" strokeWidth="0.7" strokeLinecap="round" />
          <g className="th-man__hat">
            <ellipse cx="30" cy="12.6" rx="12.5" ry="3.2" fill="#1E1626" />
            <path d="M23.6 12.6Q23.4 5 30 4.6Q36.6 5 36.4 12.6Z" fill="#2A2036" />
            <path d="M23.7 10.4Q30 11.8 36.3 10.4v2Q30 13.8 23.7 12.4z" fill="#F2B544" />
            <path d="M35 9Q42 1 50.5 4Q45 4.6 41 8Q46 6.6 49.5 9.4Q43 9.6 36.5 11.6Z" fill="#FFF6E6" />
            <path d="M34 8.6Q38 2 44 1.6Q39 4.4 36.4 9.8Z" fill="#C8283A" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** La comédienne : robe à manteau ouvert sur une jupe dorée, fontange, éventail. */
function Actress({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 100" className="th-lady" style={style}>
      <g className="th-lady__all">
        <path d="M22.5 47Q13 66 6.5 97.5Q30 101.5 53.5 97.5Q47 66 37.5 47Z" fill="#B23A5E" />
        <path d="M30 47.5h7.5Q47 66 53.5 97.5Q42 99.6 33 99.8Q36 72 30 47.5Z" fill="#9C2F50" />
        <path d="M27 50Q22.5 74 19.5 98.6Q30 100.4 40.5 98.6Q37.5 74 33 50Z" fill="#F2C35A" />
        <path d="M25.4 62Q30 63.6 34.6 62M24 74Q30 76 36 74M22.4 86Q30 88.4 37.6 86" fill="none" stroke="#D99A2B" strokeWidth="1.2" />
        <path d="M27 50Q22.5 74 19.5 98.6M33 50Q37.5 74 40.5 98.6" fill="none" stroke="#FFF6E6" strokeWidth="1" />
        <path d="M6.5 97.5Q30 101.5 53.5 97.5" fill="none" stroke="#7E2240" strokeWidth="1.4" />
        <g className="th-lady__upper">
          <path d="M28.2 25h3.6v6h-3.6z" fill="#E9BB98" />
          <path d="M24 33.6Q30 37.4 36 33.6L35 30.6Q30 32.2 25 30.6Z" fill="#F4CDAE" />
          <path d="M23.5 33.5Q30 31 36.5 33.5L35 46L30 53L25 46Z" fill="#B23A5E" />
          <path d="M27.4 34h5.2l-1 12.5L30 50l-1.6-3.5Z" fill="#F2C35A" />
          <path d="M28.6 37.5h2.8M28.8 40.5h2.4M29 43.5h2" fill="none" stroke="#C8283A" strokeWidth="1" />
          <path d="M23.5 33.6Q30 38.4 36.5 33.6" fill="none" stroke="#FFF6E6" strokeWidth="1.6" />
          <circle cx="27.6" cy="30.6" r="0.55" fill="#FFF6E6" /><circle cx="29" cy="31.2" r="0.55" fill="#FFF6E6" />
          <circle cx="30.4" cy="31.3" r="0.55" fill="#FFF6E6" /><circle cx="31.8" cy="30.9" r="0.55" fill="#FFF6E6" />
          {/* Bras gauche : la main tient la jupe */}
          <path d="M23.5 34.5Q18.5 36 18 42Q19.5 44.5 22.5 43.5Z" fill="#B23A5E" />
          <path d="M17.6 42.4Q20 46.8 23 44.2l-.8-1.6Q20 43.8 18.4 41.6Z" fill="#FFF6E6" />
          <path d="M19.6 45.2L18.6 52" fill="none" stroke="#F4CDAE" strokeWidth="2.4" strokeLinecap="round" />
          {/* Bras droit : l'éventail */}
          <path d="M36.5 34.5Q41.5 36 42 42Q40.5 44.5 37.5 43.5Z" fill="#B23A5E" />
          <path d="M42.4 42.4Q40 46.8 37 44.2l.8-1.6Q40 43.8 41.6 41.6Z" fill="#FFF6E6" />
          <path d="M40.4 44.6L44 35.8" fill="none" stroke="#F4CDAE" strokeWidth="2.4" strokeLinecap="round" />
          <g className="th-lady__fan">
            <path d="M44.2 35L35.5 26.5A12 12 0 0 1 51.5 25.3Z" fill="#F6E7C8" />
            <path d="M44.2 35L38.6 24.6M44.2 35L42.6 23.2M44.2 35L46.8 23.4M44.2 35L50 24.2" fill="none" stroke="#D9B98A" strokeWidth="0.6" />
            <path d="M35.5 26.5A12 12 0 0 1 51.5 25.3" fill="none" stroke="#C8283A" strokeWidth="1.8" />
            <circle cx="44.2" cy="35" r="1.6" fill="#F4CDAE" />
          </g>
          <g className="th-lady__head">
            <path d="M23 19Q22.5 11 30 10.6Q37.5 11 37 19Q38.6 23 37.4 27Q35.6 25 35.4 22H24.6Q24.4 25 22.6 27Q21.4 23 23 19Z" fill="#6B2E1F" />
            <circle cx="22.6" cy="24" r="1.8" fill="#6B2E1F" /><circle cx="22.4" cy="27.4" r="1.6" fill="#6B2E1F" />
            <circle cx="37.4" cy="24" r="1.8" fill="#6B2E1F" /><circle cx="37.6" cy="27.4" r="1.6" fill="#6B2E1F" />
            <ellipse cx="30" cy="20.6" rx="5.3" ry="6.2" fill="#F4CDAE" />
            <path d="M24.6 17Q24.2 11 30 10.4Q35.8 11 35.4 17Q33.6 13.6 30 14Q26.4 13.6 24.6 17Z" fill="#6B2E1F" />
            <circle cx="26.8" cy="9.8" r="2.4" fill="#6B2E1F" /><circle cx="33.2" cy="9.8" r="2.4" fill="#6B2E1F" />
            <circle cx="30" cy="8.2" r="2.6" fill="#7E3A28" />
            <path d="M25.5 7Q30-1.5 34.5 7L33 8.4Q30 3.6 27 8.4Z" fill="#FFF6E6" />
            <path d="M28 5.4L30 2.4L32 5.4" fill="none" stroke="#E2D2BC" strokeWidth="0.6" />
            <path d="M30 8.6l-2.2-1.4v2.8zM30 8.6l2.2-1.4v2.8z" fill="#C8283A" />
            <path d="M26.8 19.6q1-.7 2 0M31.2 19.6q1-.7 2 0" fill="none" stroke="#3E2616" strokeWidth="0.75" strokeLinecap="round" />
            <circle cx="26.2" cy="22.8" r="1.1" fill="#EA8F86" opacity="0.6" /><circle cx="33.8" cy="22.8" r="1.1" fill="#EA8F86" opacity="0.6" />
            <path d="M28.8 24.6q1.2.9 2.4 0q-1.2-.4-2.4 0z" fill="#C8283A" />
            <circle cx="33.4" cy="23.4" r="0.35" fill="#2A1712" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Une rose lancée sur la scène. */
function Rose() {
  return (
    <svg viewBox="0 0 22 12">
      <path d="M1.5 8.4L13 6.2" fill="none" stroke="#3E7A3A" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 7.6q1.6-3.6 4.4-2.6q-1.4 2.6-4.4 2.6z" fill="#5A9A4C" />
      <circle cx="15.6" cy="5.6" r="3.9" fill="#C8283A" />
      <path d="M13.6 5.2q2-2.4 4 0q-1 2.2-2.6 1.2q-.4-1 .8-1.4" fill="none" stroke="#8E1426" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

/** Têtes de spectateurs en ombres chinoises (repère de 480 × 46). */
const CROWD = [
  { cls: 'th-head--bun', d: 'M2 46Q4 31 22 29Q40 31 42 46ZM22 12a8.4 8.4 0 1 1 0 16.8a8.4 8.4 0 1 1 0-16.8ZM28.5 8a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 1 1 0-8.4Z' },
  { cls: 'th-head--hat', d: 'M56 46Q58 30 78 28Q98 30 100 46ZM78 11a8.8 8.8 0 1 1 0 17.6a8.8 8.8 0 1 1 0-17.6ZM63 13.6Q78 9.6 93 13.6Q78 17.2 63 13.6ZM71 12.6Q71 5 78 4.6Q85 5 85 12.6ZM84 8Q92 0 100 4Q93 4 87 10Z' },
  { cls: 'th-head--kid', d: 'M120 46Q122 35 138 33Q154 35 156 46ZM138 18a7.4 7.4 0 1 1 0 14.8a7.4 7.4 0 1 1 0-14.8ZM134 19q2-6 6-5q-1 2 1 4Z' },
  { cls: 'th-head--wig', d: 'M174 46Q176 30 196 28Q216 30 218 46ZM196 10q10 0 11 9q4 6 3 14q-3 2-5-1q-1-4-3-6h-12q-2 2-3 6q-2 3-5 1q-1-8 3-14q1-9 11-9Z' },
  { cls: 'th-head--lorgnette', d: 'M240 46Q242 31 262 29Q282 31 284 46ZM262 13a8.4 8.4 0 1 1 0 16.8a8.4 8.4 0 1 1 0-16.8ZM255 15q0-8 7-9q7 1 7 9q-3-3-7-3q-4 0-7 3ZM258 7q4-9 8 0Z' },
  { cls: 'th-head--bald', d: 'M302 46Q304 30 322 28Q340 30 342 46ZM322 11a9 9 0 1 1 0 18a9 9 0 1 1 0-18ZM311 17.5a2.4 3 0 1 0 0 .1ZM333 17.5a2.4 3 0 1 0 0 .1Z' },
  { cls: 'th-head--tail', d: 'M364 46Q366 32 384 30Q402 32 404 46ZM384 14a8 8 0 1 1 0 16a8 8 0 1 1 0-16ZM391 17q8 2 7 12q-3-5-7-7Z' },
  { cls: 'th-head--cap', d: 'M428 46Q430 30 448 28Q466 30 468 46ZM448 12a8.6 8.6 0 1 1 0 17.2a8.6 8.6 0 1 1 0-17.2ZM438 16q1-9 11-9q9 0 11 7q-10-3-22 2Z' },
];

const SWAG = 44.5;
const LAMBREQUIN = `M62 10H418V30${Array.from({ length: 8 }, (_, i) => `Q${418 - i * SWAG - SWAG / 2} 50 ${418 - (i + 1) * SWAG} 30`).join('')}Z`;
const LAMBREQUIN_FOLDS = Array.from({ length: 8 }, (_, i) => `M${62 + i * SWAG + 6} 33Q${62 + i * SWAG + SWAG / 2} 44 ${62 + (i + 1) * SWAG - 6} 33`).join('');
const LAMBREQUIN_FRINGE = `M62 30${Array.from({ length: 8 }, (_, i) => `Q${62 + i * SWAG + SWAG / 2} 50 ${62 + (i + 1) * SWAG} 30`).join('')}`;

export default function TheatreScene() {
  return (
    <>
      {/* Toile de fond peinte : le jour, et la nuit qui passe par-dessus */}
      <div className="el-layer th-back" style={vars({ top: '0px', '--k': 0.3, '--kx': 1 })}>
        <div className="th-set">
          <svg viewBox="0 0 480 170" width="480">
            <path d="M40 0H440V170H40Z" fill="#5C8DB6" />
            <path d="M40 46Q80 40 130 46T230 46T330 46T440 44V170H40Z" fill="#7BA7C9" />
            <path d="M40 76Q80 70 130 76T230 76T330 76T440 74V170H40Z" fill="#A3C4D9" />
            <path d="M40 98Q80 93 130 98T230 98T330 98T440 96V170H40Z" fill="#E7D2A6" />
            <path d="M110 112Q130 92 152 98Q166 88 186 100L204 112ZM300 112Q322 96 344 102Q360 94 380 108L390 112Z" fill="#8FAAB9" />
            <g className="th-night">
              <path d="M40 0H440V170H40Z" fill="#1C2152" />
              <path d="M40 56Q80 50 130 56T230 56T330 56T440 54V170H40Z" fill="#262C64" />
              <path d="M40 90Q80 85 130 90T230 90T330 90T440 88V170H40Z" fill="#363977" />
              <path d="M110 112Q130 92 152 98Q166 88 186 100L204 112ZM300 112Q322 96 344 102Q360 94 380 108L390 112Z" fill="#1A1D44" />
              {STARS.map((s, i) => (
                <path key={i} className="th-star" d={starPath(s.x, s.y, s.s)} style={vars({ '--d': s.d, '--delay': s.delay })} />
              ))}
            </g>
          </svg>
        </div>
      </div>

      {/* Machinerie suspendue : la lune, le nuage, l'éclair (caché), le soleil */}
      <div className="el-layer th-machine" style={vars({ top: '0px', '--k': 0.34, '--kx': 2 })}>
        <div className="th-set">
          <svg viewBox="0 0 50 50" className="th-moon" style={{ left: 150, top: 50, width: 46 }}>
            <g className="th-hang">
              <Wire x={25} y={11} />
              <path d="M25 11A16 16 0 1 0 25 43A20 20 0 0 1 25 11Z" fill="#F3EBC8" />
              <path d="M25 11A16 16 0 0 0 11.4 18.6A20 20 0 0 1 25 11Z" fill="#FFFBEA" />
              <path d="M13.4 24.6q1.8-1.4 3.4.2" fill="none" stroke="#8C7A52" strokeWidth="1" strokeLinecap="round" />
              <circle cx="13.6" cy="29.4" r="1.6" fill="#EBB9A0" opacity="0.7" />
              <path d="M14 33.4q1.6 1 3 .2" fill="none" stroke="#8C7A52" strokeWidth="1" strokeLinecap="round" />
            </g>
          </svg>
          <svg viewBox="0 0 92 50" className="th-cloud" style={{ left: 196, top: 44, width: 88 }}>
            <g className="th-hang th-hang--cloud">
              <Wire x={30} y={14} /><Wire x={64} y={10} />
              <path d="M12 42Q3 42 4 33Q5 25 14 26Q15 15 27 15Q33 6 45 9Q53 3 63 10Q75 8 78 19Q89 20 88 31Q88 42 78 42Z" fill="#9C8A6E" transform="translate(2 3)" />
              <path d="M12 42Q3 42 4 33Q5 25 14 26Q15 15 27 15Q33 6 45 9Q53 3 63 10Q75 8 78 19Q89 20 88 31Q88 42 78 42Z" fill="#F3EADC" />
              <path className="th-cloud__storm" d="M12 42Q3 42 4 33Q5 25 14 26Q15 15 27 15Q33 6 45 9Q53 3 63 10Q75 8 78 19Q89 20 88 31Q88 42 78 42Z" fill="#6F6A80" />
              <path d="M17 27q3-6 10-5M33 16q5-4 11-2M66 13q7 0 9 7" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </svg>
          <svg viewBox="0 0 20 44" className="th-bolt" style={{ left: 232, top: 70, width: 18 }}>
            <Wire x={10} y={2} />
            <path d="M12 2L3 24h7L6 42L18 16h-7L15 2Z" fill="#9C7A1E" transform="translate(1.5 1.5)" />
            <path d="M12 2L3 24h7L6 42L18 16h-7L15 2Z" fill="#FFD23F" />
          </svg>
          <svg viewBox="0 0 60 60" className="th-sun" style={{ left: 298, top: 44, width: 58 }}>
            <g className="th-hang">
              <Wire x={30} y={5} />
              <polygon points={SUN_RAYS} fill="#F0A830" />
              <circle cx="30" cy="30" r="14" fill="#F7C548" stroke="#E39A2A" strokeWidth="1.2" />
              <path d="M23.4 27.6q2-2 4 0M32.6 27.6q2-2 4 0" fill="none" stroke="#8C4E14" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="22.6" cy="32.4" r="2" fill="#F08C5A" opacity="0.6" /><circle cx="37.4" cy="32.4" r="2" fill="#F08C5A" opacity="0.6" />
              <path d="M25.6 34q4.4 4.4 8.8 0" fill="none" stroke="#8C4E14" strokeWidth="1.3" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </div>

      {/* Vagues en carton, en trois rangs qui roulent l'un contre l'autre ; la barque passe entre eux */}
      <div className="el-layer th-sea" style={vars({ top: '0px', '--k': 0.4, '--kx': 3 })}>
        <div className="th-set th-sea__set" data-tap="tempete" data-tap-ms="5200">
          <Wave top={104} fill="#6FA8C8" crest="#C4E3F0" period={46} amp={12} cls="th-wave--a" />
          <Wave top={116} fill="#4A8DB8" crest="#9CCDE5" period={52} amp={13} cls="th-wave--b" />
          <svg viewBox="0 0 50 50" className="th-boat" style={{ left: -76, top: 86, width: 54 }}>
            <g className="th-boat__rock">
              <path d="M25 36V50M25 5V30" stroke="#5A341E" strokeWidth="1.6" />
              <path d="M26.4 7Q39 16 26.4 27Z" fill="#FFF6E6" />
              <path d="M23.6 10Q14 18 23.6 27Z" fill="#F2E3C6" />
              <path d="M25 5l7 1.8-7 1.8z" fill="#C8283A" />
              <path d="M3 28H47L40 38H10Z" fill="#A4643A" />
              <path d="M6 31H44" stroke="#F2B544" strokeWidth="1.4" />
            </g>
          </svg>
          <Wave top={128} fill="#2D6E9C" crest="#79B5D8" period={58} amp={14} cls="th-wave--c" />
        </div>
      </div>

      {/* Plancher de scène, comédiens, rampe, projecteurs */}
      <div className="el-layer th-stage" style={vars({ top: '0px', '--k': 0.46, '--kx': 4 })}>
        <div className="th-set">
          <svg viewBox="0 0 480 240" width="480">
            <path d="M92 146H388L434 198H46Z" fill="#7B4A2B" />
            <path d="M92 146H388L392 151H88Z" fill="#5E3720" />
            {Array.from({ length: 17 }, (_, i) => (
              <path key={i} d={`M${92 + i * 18.5} 146L${46 + i * 24} 198`} stroke="#5A341E" strokeWidth="0.9" />
            ))}
            <path d="M130 162h22M250 170h26M180 184h30M330 178h24M96 178h20" stroke="#5A341E" strokeWidth="0.9" />
            <path d="M196 156h48l2 6h-52z" fill="#6A3E22" stroke="#4E2C17" strokeWidth="0.8" />
            <ellipse cx="252" cy="184" rx="86" ry="11" fill="#FFE2A6" opacity="0.16" />
            <path d="M46 198H434V203H46Z" fill="#A86E40" />
          </svg>
          <div className="th-actors" data-tap="salut" data-tap-ms="4600">
            <Actor style={{ left: 0, top: 0, width: 50 }} />
            <Actress style={{ left: 62, top: 1, width: 50 }} />
          </div>
          {ROSES.map((r, i) => (
            <span key={i} className="th-rose" style={vars({ left: r.x, top: r.y, '--rot': r.rot, '--spin': r.spin, '--dx': r.dx, '--delay': r.delay })}>
              <Rose />
            </span>
          ))}
          <svg viewBox="0 0 480 240" width="480" className="th-lights">
            <defs>
              <linearGradient id="th-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFF1CF" stopOpacity="0.34" />
                <stop offset="1" stopColor="#FFF1CF" stopOpacity="0.06" />
              </linearGradient>
              <radialGradient id="th-glow">
                <stop offset="0" stopColor="#FFD77A" stopOpacity="0.85" />
                <stop offset="1" stopColor="#FFD77A" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path className="th-beam th-beam--l" d="M96 -12L104 -12L238 190L196 192Z" fill="url(#th-beam)" />
            <path className="th-beam th-beam--r" d="M376 -12L384 -12L320 190L276 190Z" fill="url(#th-beam)" />
            <path className="th-sweep" d="M236 -16L244 -16L270 200L210 200Z" fill="url(#th-beam)" />
            {FOOTLIGHTS.map((x) => (
              <g key={x}>
                <circle cx={x} cy="193" r="13" fill="url(#th-glow)" className="th-glow" />
                <path className="th-flame" d={`M${x} 187.6q3.4 4.4 0 8.4q-3.4-4 0-8.4z`} fill="#FFD77A" />
                <path d={`M${x - 6.5} 200a6.5 4.4 0 0 1 13 0z`} fill="#C98E2A" />
              </g>
            ))}
          </svg>
          {MOTES.map((m, i) => (
            <span key={i} className="th-mote" style={vars({ left: m.x, top: m.y, '--d': m.d, '--delay': m.delay, '--dx': m.dx })} />
          ))}
        </div>
      </div>

      {/* Cadre de scène doré, lambrequin, rideaux retenus par des embrasses, masques */}
      <div className="el-layer th-frame" style={vars({ top: '0px', '--k': 0.52, '--kx': 6 })}>
        <span className="th-wing th-wing--l" />
        <span className="th-wing th-wing--r" />
        <div className="th-set">
          <svg viewBox="0 0 480 210" width="480">
            <path d="M-60 0H46V240H-60ZM434 0H540V240H434Z" fill="#1A0C10" />
            <g id="th-drape">
              <path d="M56 26H134C124 64 100 100 90 124C96 150 110 178 124 206H56Z" fill="#8E1426" />
              <path d="M72 28Q70 80 64 124M86 28Q84 84 70 124M100 28Q94 88 76 124M114 28Q104 92 82 124M64 126Q66 170 70 206M70 126Q76 170 82 206M76 126Q86 170 94 206M82 126Q96 170 106 206" fill="none" stroke="#5C0A18" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M78 28Q76 82 67 124M92 28Q88 86 73 124M106 28Q99 90 79 124M120 28Q109 94 85 124M67 126Q71 170 76 206M73 126Q81 170 88 206M79 126Q91 170 100 206M85 126Q101 170 112 206" fill="none" stroke="#B8213A" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M134 26C124 64 100 100 90 124C96 150 110 178 124 206" fill="none" stroke="#D2384E" strokeWidth="2.4" />
              <path d="M56 118Q76 130 96 121" fill="none" stroke="#9C6A1C" strokeWidth="4.6" strokeLinecap="round" />
              <path d="M56 117Q76 128 96 120" fill="none" stroke="#F2B544" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M91.6 127h9.6l3.6 18h-16.8z" fill="#D99A2B" />
              <path d="M90.4 145v-2M93.4 145v-3M96.4 145v-3M99.4 145v-3M102.4 145v-2" stroke="#9C6A1C" strokeWidth="0.9" />
              <path d="M92.6 129.4h7.6" stroke="#9C6A1C" strokeWidth="1.2" />
              <circle cx="96.4" cy="123.4" r="3.6" fill="#F2B544" />
            </g>
            <use href="#th-drape" transform="matrix(-1 0 0 1 480 0)" />
            {/* Lambrequin à festons et franges */}
            <path d={LAMBREQUIN} fill="#8E1426" />
            <path d={LAMBREQUIN_FOLDS} fill="none" stroke="#5C0A18" strokeWidth="1.8" />
            <path d={LAMBREQUIN_FRINGE} fill="none" stroke="#F2B544" strokeWidth="3.4" strokeDasharray="1.4 1.3" />
            <path d="M62 14H418M62 27H418" stroke="#F2B544" strokeWidth="1.6" />
            {Array.from({ length: 7 }, (_, i) => (
              <path key={i} d={`M${106.5 + i * SWAG} 30v5l-2.6 6h5.2l-2.6-6`} fill="#F2B544" stroke="#F2B544" strokeWidth="1.2" />
            ))}
            {/* Cadre doré : fronton et pilastres */}
            <path d="M30 0H450V12H30Z" fill="#C98E2A" />
            <path d="M30 2.2H450" stroke="#F7CB6B" strokeWidth="1.6" />
            <path d="M30 11.4H450" stroke="#8C5E17" strokeWidth="1.2" />
            {Array.from({ length: 27 }, (_, i) => (
              <ellipse key={i} cx={36 + i * 16} cy="6.8" rx="3" ry="2.4" fill="#F2B544" stroke="#9C6A1C" strokeWidth="0.8" />
            ))}
            {[44, 418].map((x) => (
              <g key={x}>
                <path d={`M${x} 10H${x + 18}V206H${x}Z`} fill="#C98E2A" />
                <path d={`M${x + 1.6} 18V200`} stroke="#F7CB6B" strokeWidth="1.6" />
                <path d={`M${x + 6} 22V196M${x + 9.6} 22V196M${x + 13.2} 22V196`} stroke="#9C6A1C" strokeWidth="1.2" />
                <path d={`M${x - 4} 10H${x + 22}V20H${x - 4}Z`} fill="#E0A73C" />
                <circle cx={x - 1} cy="15" r="3.2" fill="#F2B544" stroke="#9C6A1C" strokeWidth="0.9" />
                <circle cx={x + 19} cy="15" r="3.2" fill="#F2B544" stroke="#9C6A1C" strokeWidth="0.9" />
                <path d={`M${x - 4} 196H${x + 22}V208H${x - 4}Z`} fill="#E0A73C" />
                <path d={`M${x - 4} 199H${x + 22}`} stroke="#9C6A1C" strokeWidth="1" />
              </g>
            ))}
            {/* Cartouche et masques de la comédie et de la tragédie */}
            <g data-tap="masques" data-tap-ms="2800">
              <path d="M222 12Q222 30 213 36M258 12Q258 30 267 36" fill="none" stroke="#C8283A" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M212 0H268Q271 18 259 28Q250 35 240 38Q230 35 221 28Q209 18 212 0Z" fill="#C98E2A" />
              <path d="M216 2H264Q266 17 256 25Q248 31 240 34Q232 31 224 25Q214 17 216 2Z" fill="#E0A73C" />
              <g transform="rotate(-14 229 18)">
                <g className="th-mask th-mask--comic">
                  <path d="M220 7Q229 3.6 238 7Q239.4 19 229 28.6Q218.6 19 220 7Z" fill="#FFD77A" stroke="#9C6A1C" strokeWidth="0.8" />
                  <path d="M223 13.4q2-2.4 4 0M231 13.4q2-2.4 4 0" fill="none" stroke="#4A2410" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M223.6 19q5.4 6.4 10.8 0q-5.4 2.4-10.8 0z" fill="#4A2410" />
                  <circle cx="222.6" cy="17.4" r="1.3" fill="#F08C5A" opacity="0.7" /><circle cx="235.4" cy="17.4" r="1.3" fill="#F08C5A" opacity="0.7" />
                </g>
              </g>
              <g transform="rotate(14 251 19)">
                <g className="th-mask th-mask--tragic">
                  <path d="M242 8Q251 4.6 260 8Q261.4 20 251 29.6Q240.6 20 242 8Z" fill="#E9DCCB" stroke="#8C7A66" strokeWidth="0.8" />
                  <path d="M244.6 13.4q2 .8 4 2.2M257.4 13.4q-2 .8-4 2.2" fill="none" stroke="#3A2016" strokeWidth="1.3" strokeLinecap="round" />
                  <ellipse cx="246.8" cy="16.6" rx="1.4" ry="1" fill="#3A2016" /><ellipse cx="255.2" cy="16.6" rx="1.4" ry="1" fill="#3A2016" />
                  <path d="M246 25q5-5.6 10 0q-5-2-10 0z" fill="#3A2016" />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Spectateurs en ombres chinoises, au premier plan */}
      <div className="el-layer th-crowd" style={vars({ top: '196px', '--k': 0.7, '--kx': 9 })}>
        <div className="th-set">
          <svg viewBox="0 0 480 46" width="480">
            <g className="th-lorgnette">
              <path d="M280 46L278 22" stroke="#0A0406" strokeWidth="3.6" strokeLinecap="round" />
              <path d="M278 22L276.6 17" stroke="#4A2420" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="272.4" cy="14.4" r="3" fill="#0A0406" stroke="#4A2420" strokeWidth="1" />
              <circle cx="278.4" cy="14.4" r="3" fill="#0A0406" stroke="#4A2420" strokeWidth="1" />
            </g>
            {CROWD.map((h) => (
              <path key={h.cls} className={`th-head ${h.cls}`} d={h.d} />
            ))}
          </svg>
        </div>
      </div>
    </>
  );
}
