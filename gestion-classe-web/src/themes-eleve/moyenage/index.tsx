import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Moyen Âge » : un jour de tournoi au pied du château.
 * Plans, du fond vers l'avant : ciel, soleil et nuages (avec les oiseaux), collines lointaines et
 * petite ville fortifiée, colline du château (donjon, tours à toits bleus, courtine crénelée,
 * porte avec herse et pont-levis, bannières), champs en bandes et moulin, lice du tournoi
 * (barrière, tentes rayées, héraut, chevalier à cheval, quintaine).
 * Mouvement, sans que l'élève touche à rien : les nuages passent, les ailes du moulin tournent,
 * l'oriflamme du donjon, les fanions des tours et des tentes et les bannières flottent au vent,
 * deux oiseaux traversent le ciel, le cheval piaffe, hoche la tête et bat de la queue, le panache du
 * chevalier ondule, la fumée monte de la ville ; de temps en temps, un vol d'oies passe en V.
 * Au toucher : le chevalier (il baisse sa lance, charge au galop, brise sa lance sur la quintaine qui
 * tourne sur elle-même, fait demi-tour et revient à sa place, où sa lance redevient entière), le
 * château (le pont-levis s'abaisse, la herse se lève, une grande bannière se déroule du donjon et des
 * pétales s'envolent, puis tout se referme), le héraut (il lève sa trompette et sonne une fanfare).
 */

const PETALS = scatter(10, 37, (r, i) => ({
  dx: `${Math.round(r() * 90 - 45)}px`,
  up: `${Math.round(r() * 24 + 30)}px`,
  spin: `${Math.round(r() * 540 - 270)}deg`,
  delay: `${(r() * 0.5).toFixed(2)}s`,
  color: ['#E3B23C', '#B8402F', '#FFFBF1', '#3A6FB8'][i % 4],
}));

/** Ourlet festonné : petites dents arrondies, de x2 vers x1. */
function hem(x1: number, x2: number, y: number, step: number, depth: number): string {
  let d = '';
  for (let x = x2; x > x1 + 0.1; x -= step) d += `Q${(x - step / 2).toFixed(1)} ${y + depth} ${(x - step).toFixed(1)} ${y}`;
  return d;
}

/** Créneaux d'un mur : merlons de 5,5 de large tous les 9. */
function merlons(x1: number, x2: number, y: number, h: number): string {
  let d = '';
  for (let x = x1; x < x2 - 3; x += 9) d += `M${x} ${y}h5.5v${h}h-5.5Z`;
  return d;
}

/** Une tente ronde de tournoi, à bandes, avec son fanion. */
function Tent({ cx, w, apex, top, base, colors, flag }: { cx: number; w: number; apex: number; top: number; base: number; colors: [string, string]; flag: string }) {
  const n = 8;
  const left = cx - w / 2;
  const stripes = Array.from({ length: n }, (_, i) => {
    const a = left + (i * w) / n;
    const b = left + ((i + 1) * w) / n;
    return <path key={i} d={`M${a} ${top}L${b} ${top}L${b + (b - cx) * 0.06} ${base}L${a + (a - cx) * 0.06} ${base}Z`} fill={colors[i % 2]} />;
  });
  const roof = Array.from({ length: n }, (_, i) => {
    const a = left - 3 + (i * (w + 6)) / n;
    const b = left - 3 + ((i + 1) * (w + 6)) / n;
    return <path key={i} d={`M${cx} ${apex}L${a} ${top + 2}L${b} ${top + 2}Z`} fill={colors[(i + 1) % 2]} />;
  });
  const sc = (w + 6) / n;
  let val = `M${left - 3} ${top + 1}H${left + w + 3}V${top + 5}`;
  for (let i = n; i > 0; i -= 1) val += `Q${(left - 3 + (i - 0.5) * sc).toFixed(1)} ${top + 10} ${(left - 3 + (i - 1) * sc).toFixed(1)} ${top + 5}`;
  return (
    <g>
      {stripes}
      <path d={`M${left} ${top}H${left + w}V${top + 7}H${left}Z`} fill="rgba(42, 30, 18, 0.14)" />
      {roof}
      <path d={`M${cx} ${apex}L${cx + w / 2 + 3} ${top + 2}L${cx + 2} ${top + 2}Z`} fill="rgba(42, 30, 18, 0.12)" />
      <path d={`${val}Z`} fill={colors[0]} stroke="rgba(42, 30, 18, 0.2)" strokeWidth="0.8" />
      <path d={`M${cx} ${apex}V${apex - 12}`} stroke="#5A3A22" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx={cx} cy={apex - 12} r="1.5" fill="#E3B23C" />
      <path
        className="mg-pennant"
        style={vars({ transformOrigin: `${cx}px ${apex - 8}px`, '--d': `${1.4 + (cx % 5) / 10}s` })}
        d={`M${cx} ${apex - 11}L${cx + 15} ${apex - 8}L${cx + 9} ${apex - 6.5}L${cx + 14} ${apex - 4}L${cx} ${apex - 5}Z`}
        fill={flag}
      />
    </g>
  );
}

/** Tour ronde à toit conique bleu, avec son fanion. */
function Tower({ x, flag }: { x: number; flag: string }) {
  return (
    <g>
      <path d={`M${x} 122V64H${x + 28}V122Z`} fill="#EADFC6" />
      <path d={`M${x + 17} 122V64H${x + 28}V122Z`} fill="#CDBE9E" />
      <path d={`M${x + 12} 80h3v9h-3ZM${x + 12} 100h3v9h-3Z`} fill="#3B2E22" />
      <path d={`M${x - 4} 67L${x + 14} 28L${x + 32} 67Q${x + 14} 72 ${x - 4} 67Z`} fill="#2F64AE" />
      <path d={`M${x + 14} 28L${x + 32} 67Q${x + 23} 70 ${x + 16} 70Z`} fill="#1F4E8C" />
      <path d={`M${x + 14} 28V15`} stroke="#5A3A22" strokeWidth="1.4" strokeLinecap="round" />
      <path
        className="mg-pennant"
        style={vars({ transformOrigin: `${x + 14}px 18px`, '--d': x > 350 ? '1.7s' : '1.5s' })}
        d={`M${x + 14} 15L${x + 32} 18.5L${x + 25} 20.5L${x + 31} 23.5L${x + 14} 22Z`}
        fill={flag}
      />
    </g>
  );
}

/** Le château fort : donjon, deux tours rondes, courtine, porte avec herse et pont-levis. */
function Castle() {
  return (
    <g className="mg-castle" data-tap="chateau" data-tap-ms="5600">
      {/* Donjon, derrière la courtine */}
      <path d="M320 86V40H364V86Z" fill="#E4D8BD" />
      <path d="M350 86V40H364V86Z" fill="#C8B892" />
      <path d={merlons(320, 368, 33, 7)} fill="#E4D8BD" />
      <path d="M352 33h5.5v7h-5.5ZM361 33h3v7h-3Z" fill="#C8B892" />
      <path d="M337 62V53Q342 46 347 53V62Z" fill="#3B2E22" />
      <path d="M327 46h3v8h-3ZM355 46h3v8h-3Z" fill="#3B2E22" />
      <path d="M342 33V3" stroke="#5A3A22" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="342" cy="2.5" r="1.8" fill="#E3B23C" />
      <g className="mg-flag">
        <path d="M342 4C350 2 356 6 364 4C368 3 371 3 374 4V18C371 17 368 17 364 18C356 20 350 16 342 18Z" fill="#1F4E8C" />
        <path d="M342 9.5C350 7.5 356 11.5 364 9.5C368 8.5 371 8.5 374 9.5V12.5C371 11.5 368 11.5 364 12.5C356 14.5 350 10.5 342 12.5Z" fill="#E3B23C" />
      </g>
      {/* Tours et courtine */}
      <Tower x={262} flag="#B8402F" />
      <Tower x={404} flag="#E3B23C" />
      <path d="M290 122V84H404V122Z" fill="#E1D4B6" />
      <path d="M290 84H404V89H290Z" fill="#CDBE9E" />
      <path d={merlons(290, 404, 78, 6)} fill="#E1D4B6" />
      <path d="M306 96h3v8h-3ZM385 96h3v8h-3Z" fill="#3B2E22" />
      {/* Bannières pendues à la courtine */}
      <g className="mg-banner" style={{ transformOrigin: '302px 86px' }}>
        <path d="M296 86H308V108L302 104L296 108Z" fill="#1F4E8C" />
        <path d="M296 99L302 93L308 99V102.5L302 96.5L296 102.5Z" fill="#E3B23C" />
      </g>
      <g className="mg-banner" style={vars({ transformOrigin: '392px 86px', '--delay': '-1.3s' })}>
        <path d="M386 86H398V108L392 104L386 108Z" fill="#B8402F" />
        <path d="M391 86h2v20h-2ZM386 94h12v2h-12Z" fill="#E3B23C" />
      </g>
      {/* Châtelet et porte : herse derrière le pont-levis relevé */}
      <path d="M326 122V74H358V122Z" fill="#EADFC6" />
      <path d="M348 122V74H358V122Z" fill="#D2C3A2" />
      <path d={merlons(326, 362, 68, 6)} fill="#EADFC6" />
      <path d="M334 122V105Q342 94 350 105V122Z" fill="#2A1E12" />
      <clipPath id="mg-arch"><path d="M334 122V105Q342 94 350 105V122Z" /></clipPath>
      <g clipPath="url(#mg-arch)">
        <g className="mg-herse">
          <path d="M336.5 96V121M341 96V122M345.5 96V122M349 96V121M334 103H350M334 109H350M334 115H350" stroke="#7A6450" strokeWidth="1.3" />
        </g>
      </g>
      <g className="mg-bridge">
        <path d="M333 101Q342 92 351 101V122H333Z" fill="#8A5A32" />
        <path d="M337.5 99V122M342 96V122M346.5 99V122" stroke="#6B4424" strokeWidth="0.9" />
        <path d="M333 107H351M333 117H351" stroke="#4A3B2C" strokeWidth="1.3" />
      </g>
      {/* Grande bannière qui se déroule du donjon (au toucher) et pétales lancés du haut */}
      <g className="mg-unroll">
        <path d="M333 46H351V96L342 90L333 96Z" fill="#B8402F" />
        <path d="M335 48H349V92L342 87L335 92Z" fill="none" stroke="#E3B23C" strokeWidth="1.2" />
        <path d="M342 58L344.5 64H351L346 68L348 75L342 71L336 75L338 68L333 64H339.5Z" fill="#E3B23C" />
      </g>
      <path className="mg-rod" d="M331 45.5H353" stroke="#E3B23C" strokeWidth="2.4" strokeLinecap="round" />
      <g className="mg-petals">
        {PETALS.map((p, i) => (
          <path key={i} className="mg-petal" d="M341 34c3-3 6.5-1.5 6.5 1.5c-1.5 3-5 3-6.5-1.5Z" fill={p.color} style={vars({ '--dx': p.dx, '--up': p.up, '--spin': p.spin, '--delay': p.delay })} />
        ))}
      </g>
    </g>
  );
}

/** Le chevalier sur son cheval caparaçonné, tourné vers la droite. */
function Knight() {
  const body = `M18 38C18 31 25 29 33 29H64C69 29 73 27 76 23L80 13C82 8 88 7 91 11L97.5 23C98.5 26.5 96 29 93 28L88 26.5L84 32C83 40 83 50 83 58V62${hem(18, 83, 62, 5.9, 5)}V38Z`;
  return (
    <svg viewBox="0 0 100 80" className="mg-knight" data-tap="joute" data-tap-ms="6000">
      <g className="mg-knight__turn">
        <g className="mg-knight__ride">
          <path className="mg-tail" d="M20 36C11 40 8 52 11 64C13 58 15 52 18 49C16 56 17 61 19 64C21 56 22 48 24 42Z" fill="#5A3A22" />
          <g className="mg-leg mg-leg--hf"><path d="M24 56h5l-.5 15h-4Z" fill="#4E3320" /><path d="M24 70h5v5h-6Z" fill="#2A1E12" /></g>
          <g className="mg-leg mg-leg--ff"><path d="M66 56h5l-.5 15h-4Z" fill="#4E3320" /><path d="M66 70h5v5h-6Z" fill="#2A1E12" /></g>
          {/* Cheval sous son caparaçon */}
          <path d={body} fill="#1F4E8C" />
          <path d={`M18 56H83V62${hem(18, 83, 62, 5.9, 5)}Z`} fill="#E3B23C" />
          <g className="mg-head">
            <path d="M80 13C82 8 88 7 91 11L97.5 23C98.5 26.5 96 29 93 28L88 26.5L84 32L76 24Z" fill="#2A5DA0" />
            <path d="M93.5 22L97.5 23C98.5 26.5 96 29 93 28L91.5 25Z" fill="#7A5638" />
            <path d="M82.5 9.5L84 3L86.5 9ZM86 8.5L88.5 2.5L90 9Z" fill="#2A5DA0" />
            <circle cx="88.5" cy="15.5" r="2.3" fill="#E3B23C" />
            <circle cx="89" cy="15.6" r="1.1" fill="#2A1E12" />
          </g>
          <path d="M28 40l2.5 2.5-2.5 2.5-2.5-2.5ZM28 48l2.5 2.5-2.5 2.5-2.5-2.5ZM68 40l2.5 2.5-2.5 2.5-2.5-2.5ZM68 48l2.5 2.5-2.5 2.5-2.5-2.5Z" fill="#E3B23C" />
          <g className="mg-leg mg-leg--hn"><path d="M32 59h5l-.5 12.5h-4Z" fill="#6B4A2E" /><path d="M31.5 71h5.5v5h-6.5Z" fill="#2A1E12" /></g>
          <g className="mg-leg mg-leg--fn"><path d="M74 59h5l-.5 12.5h-4Z" fill="#6B4A2E" /><path d="M73.5 71h5.5v5h-6.5Z" fill="#2A1E12" /></g>
          {/* La lance, tenue de la main droite, en travers de l'encolure ; le cavalier passe devant son talon */}
          <g className="mg-lance">
            <path d="M44 22.8L60 22.3V25.7L44 25.2Z" fill="#8A5A32" />
            <path d="M64 22.5L101 23.3V24.7L64 25.5Z" fill="#FFFBF1" />
            <path d="M70 22.6l4 .1-2 2.8h-4ZM80 22.8l4 .1-2 2.6h-4ZM90 23l4 .1-2 2.4h-4Z" fill="#B8402F" />
            <path className="mg-pennon" d="M66 25.4L80 26.5L76 28L80 29.5L66 28.2Z" fill="#1F4E8C" />
            <g className="mg-lance__tip">
              <path d="M101 23.3L122 23.8V24.2L101 24.7Z" fill="#FFFBF1" />
              <path d="M104 23.3l4 .1-1.5 1.3h-4ZM114 23.5l4 .1-1.5 .9h-4Z" fill="#B8402F" />
              <path d="M121 22.3L125 23V25L121 25.7Z" fill="#9AA4AE" />
            </g>
            <path d="M57 18V30L64 25.3V22.7Z" fill="#B9C2CA" />
            <path d="M57 18V24L64 23.4V22.7Z" fill="#D6DDE3" />
          </g>
          {/* Le cavalier */}
          <path d="M41 30Q42 25 47 26H57Q61 26 61 30Z" fill="#6B4424" />
          <path d="M53 13.5L59 15L62.5 23.5L59 25.5L56 18Z" fill="#8C97A2" />
          <circle cx="60.5" cy="24" r="2.6" fill="#7E8A95" />
          <path d="M45 28H60L58.5 11.5H46.5Z" fill="#FFFBF1" />
          <path d="M45.8 20H59.3L59.7 24H45.4Z" fill="#1F4E8C" />
          <path d="M49 28H57.5L58.5 40L56.5 50.5L59 52.5V54H50.5V51L51.5 40Z" fill="#A8B2BC" />
          <path d="M49 28H53V40L52 51H50.5L51.5 40Z" fill="#8C97A2" />
          <circle cx="55" cy="40" r="2" fill="#C9D1D8" />
          <path d="M51 54.5H59" stroke="#4A3B2C" strokeWidth="1.2" />
          <path className="mg-plume" d="M50 1.5C44-2 37 0 33 6C38 4 41 5 43 7C40 7 37 9 36 12C41 9 46 8 50 5Z" fill="#B8402F" />
          <path d="M46.5 12V3.5Q52-.5 58.5 3.5V12Z" fill="#B9C2CA" />
          <path d="M53 1.8Q56 2 58.5 3.5V12H53Z" fill="#9AA4AE" />
          <path d="M53.5 6.2H58.7" stroke="#2A1E12" strokeWidth="1.3" />
          <path d="M52 2.2V12" stroke="#7E8A95" strokeWidth="0.8" />
          <path d="M37.5 13.5H51.5V21Q51.5 29.5 44.5 33Q37.5 29.5 37.5 21Z" fill="#E3B23C" />
          <path d="M37.5 25.5L44.5 18.5L51.5 25.5V29.5L44.5 22.5L37.5 29.5Z" fill="#1F4E8C" />
          <path d="M37.5 13.5H51.5V21Q51.5 29.5 44.5 33Q37.5 29.5 37.5 21Z" fill="none" stroke="#9C7A24" strokeWidth="0.9" />
        </g>
      </g>
    </svg>
  );
}

/** La quintaine : un poteau, un bras tournant avec un écu d'un côté et un sac de l'autre. */
function Quintain() {
  return (
    <svg viewBox="0 0 60 70" className="mg-quintain">
      <path d="M22 68H38L35 64H25Z" fill="#6B4424" />
      <path d="M28.5 18H31.5V65H28.5Z" fill="#8A5A32" />
      <path d="M30.5 18H31.5V65H30.5Z" fill="#6B4424" />
      <g className="mg-arm">
        <path d="M4 16.5H56V19.5H4Z" fill="#8A5A32" />
        <path d="M1 18H13V27Q13 34 7 37Q1 34 1 27Z" fill="#FFFBF1" />
        <path d="M1 18H7V37Q1 34 1 27Z" fill="#B8402F" />
        <path d="M1 18H13V27Q13 34 7 37Q1 34 1 27Z" fill="none" stroke="#6B4424" strokeWidth="0.9" />
        <g className="mg-sack">
          <path d="M53 19.5V24" stroke="#4A3B2C" strokeWidth="0.9" />
          <path d="M50 24Q53 22 56 24Q59 31 56 37Q53 39 50 37Q47 31 50 24Z" fill="#C9A86C" />
          <path d="M50.5 26.5Q53 25.5 55.5 26.5" stroke="#8A6A44" strokeWidth="0.9" fill="none" />
        </g>
      </g>
      <circle cx="30" cy="18" r="2.4" fill="#4A3B2C" />
    </svg>
  );
}

/** Le héraut, en tabard écartelé, avec sa longue trompette à bannière. */
function Herald() {
  return (
    <svg viewBox="0 0 40 50" className="mg-herald" data-tap="fanfare" data-tap-ms="3400">
      <g className="mg-herald__body">
        <path d="M14 34h3v13h-3ZM19 34h3v13h-3Z" fill="#B8402F" />
        <path d="M12.5 46.5h5v2.5h-6ZM18.5 46.5H24l1 2.5h-6.5Z" fill="#2A1E12" />
        <path d="M11 18H25L26.5 36H9.5Z" fill="#1F4E8C" />
        <path d="M18 18H25L25.7 27H18ZM18 27H10.3L9.5 36H18Z" fill="#E3B23C" />
        <path d="M10.5 19L8 30L10 31L12.5 21Z" fill="#E3B23C" />
        <circle cx="18" cy="12" r="5" fill="#E9C39B" />
        <path d="M22.5 12.5L24.2 13.3L22.6 14Z" fill="#D9A97E" />
        <circle cx="20" cy="11" r="0.8" fill="#2A1E12" />
        <path d="M12.5 11C12 5 17 4 20 5C23 5.5 24 8 23.5 9C20 8 16 9 14 11.5C13.5 15 12 18 9 20C9 16 11 14 12.5 11Z" fill="#B8402F" />
      </g>
      <g className="mg-trumpet">
        <path d="M19 20L23 14.5L25 15.5L21.5 21.5Z" fill="#1F4E8C" />
        <path d="M22.5 13.3L43 11L46.5 7.5V17L43 13.5L22.5 14.3Z" fill="#E3B23C" />
        <path d="M43 11L46.5 7.5V17L43 13.5Z" fill="#C89526" />
        <path className="mg-trumpet__flag" d="M30 13.4H40V22L35 20L30 22Z" fill="#1F4E8C" />
        <path d="M30 16H40V17.5H30Z" fill="#E3B23C" />
      </g>
      <g className="mg-notes">
        <g className="mg-note"><path d="M33 4V-2L37-3V3" fill="none" stroke="#2A1E12" strokeWidth="1" /><ellipse cx="31.8" cy="4.2" rx="1.6" ry="1.2" fill="#2A1E12" /><ellipse cx="35.8" cy="3.2" rx="1.6" ry="1.2" fill="#2A1E12" /></g>
        <g className="mg-note" style={vars({ '--delay': '0.45s' })}><path d="M33 4V-2" fill="none" stroke="#1F4E8C" strokeWidth="1" /><ellipse cx="31.8" cy="4.2" rx="1.6" ry="1.2" fill="#1F4E8C" /></g>
        <g className="mg-note" style={vars({ '--delay': '0.9s' })}><path d="M33 4V-2L37-3V3" fill="none" stroke="#B8402F" strokeWidth="1" /><ellipse cx="31.8" cy="4.2" rx="1.6" ry="1.2" fill="#B8402F" /><ellipse cx="35.8" cy="3.2" rx="1.6" ry="1.2" fill="#B8402F" /></g>
      </g>
    </svg>
  );
}

function Goose({ x, y, d }: { x: number; y: number; d: string }) {
  return (
    <g transform={`translate(${x + 18} ${y}) scale(-1 1)`}>
      <path d="M0 4C3 2 8 2 13 3.5L16 2.5L18 3.2L15.5 4.3C11 6 4 6 0 4Z" fill="#5C4A3A" />
      <path className="mg-goose__wing" style={vars({ '--d': d })} d="M5 3.5C6-2 9-4 12-5C10-1 9 1 9 3.5Z" fill="#7A6654" />
    </g>
  );
}

const CLOUD = 'M8 30C0 30 0 20 9 19C9 10 21 7 27 13C31 3 48 2 53 12C60 6 72 9 72 17C82 13 94 18 92 26C100 26 102 30 96 30Z';
const BIRD = 'M0 3C3 0 6 1 8 5C10 1 13 0 16 3C13 2 10 4 8 7C6 4 3 2 0 3Z';

export default function MoyenAgeScene() {
  return (
    <>
      <div className="el-layer mg-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer mg-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 2 })}>
        <div className="el-stage"><div className="mg-sun" /></div>
      </div>

      <div className="el-layer mg-clouds" style={vars({ top: '10px', '--k': 0.38, '--kx': 4 })}>
        <div className="mg-drift">
          {[0, 1].map((set) => (
            <div key={set} className="mg-cloudset">
              <svg viewBox="0 0 102 32" className="mg-cloud" style={{ left: '6%', top: 4, width: 96 }}><path d={CLOUD} /></svg>
              <svg viewBox="0 0 102 32" className="mg-cloud" style={{ left: '52%', top: 30, width: 64 }}><path d={CLOUD} /></svg>
              <svg viewBox="0 0 102 32" className="mg-cloud" style={{ left: '78%', top: 0, width: 110 }}><path d={CLOUD} /></svg>
            </div>
          ))}
        </div>
        <div className="mg-birdbox"><svg viewBox="0 0 16 8" className="mg-bird"><path d={BIRD} /></svg></div>
        <div className="mg-birdbox mg-birdbox--2"><svg viewBox="0 0 16 8" className="mg-bird"><path d={BIRD} /></svg></div>
        <div className="mg-geese">
          <svg viewBox="0 -6 74 62" width="78">
            <Goose x={0} y={24} d="0.62s" />
            <Goose x={18} y={16} d="0.58s" /><Goose x={18} y={33} d="0.66s" />
            <Goose x={36} y={8} d="0.6s" /><Goose x={36} y={42} d="0.64s" />
            <Goose x={54} y={0} d="0.57s" /><Goose x={54} y={50} d="0.61s" />
          </svg>
        </div>
      </div>

      <div className="el-layer mg-far" style={vars({ top: '100px', '--k': 0.44, '--kx': 5 })}>
        <div className="mg-set">
          <svg viewBox="-480 0 1440 90" className="mg-wide">
            <path d="M-480 50C-380 30-260 44-150 36S40 24 140 34S300 40 380 30S560 24 700 38S900 30 960 36V90H-480Z" fill="#CBD7BF" />
            <path d="M-480 64C-360 52-200 64-60 56S110 38 200 36S320 50 430 52S700 48 960 58V90H-480Z" fill="#B5C69D" />
            {/* Petite ville fortifiée */}
            <path d="M160 30l5-6 5 6ZM172 28l6-7 6 7ZM188 31l5-6 5 6ZM226 29l6-7 6 7Z" fill="#C79A86" />
            <path d="M161 30h8v8h-8ZM173 28h10v10h-10ZM189 31h8v7h-8ZM227 29h10v9h-10Z" fill="#E3D9C4" />
            <path d="M204 34V16h10v18Z" fill="#D9CDB4" />
            <path d="M203 16L209 2L215 16Z" fill="#8FA3B8" />
            <path d="M199 34V26h22v8Z" fill="#D9CDB4" />
            <path d="M198 26L210 20L222 26Z" fill="#B88F7E" />
            <path d="M152 46V36H246V46Z" fill="#D3C7AE" />
            <path d={merlons(152, 246, 33, 3)} fill="#D3C7AE" />
            <path d="M148 46V31h9v15ZM241 46V31h9v15Z" fill="#DDD2BB" />
            <path d="M147 31l5.5-8 5.5 8ZM240 31l5.5-8 5.5 8Z" fill="#8FA3B8" />
            <path d="M196 46v-6a3 3 0 0 1 6 0v6Z" fill="#9C8A70" />
            <g className="mg-smoke">
              <circle cx="232" cy="20" r="2.5" /><circle cx="232" cy="20" r="2.5" /><circle cx="232" cy="20" r="2.5" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer mg-castlelayer" style={vars({ top: '18px', '--k': 0.5, '--kx': 6 })}>
        <div className="mg-set">
          <svg viewBox="-480 0 1440 160" className="mg-wide">
            <path d="M-480 142C-300 134-120 140 40 136S200 134 240 138L700 140C800 138 900 142 960 140V160H-480Z" fill="#A9C27F" />
            <path d="M214 160C232 136 248 125 262 122L432 120C448 122 466 131 486 142C560 152 640 150 720 156V160Z" fill="#9DBA6E" />
            <path d="M236 160C254 146 270 140 290 140C330 140 360 146 400 160Z" fill="#B7C984" />
            <path d="M330 160C360 146 400 138 440 138C470 140 500 150 520 160Z" fill="#D2C27E" />
            <path d="M300 160C320 152 344 150 370 152C390 154 410 158 418 160Z" fill="#8FAF62" />
            <path d="M342 124C336 132 318 136 300 142C286 147 276 152 270 160" stroke="#E6D3A8" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M298 121C320 119 368 119 392 121C390 126 300 126 298 121Z" fill="#6E9CC4" />
            <Castle />
          </svg>
        </div>
      </div>

      <div className="el-layer mg-fields" style={vars({ top: '138px', '--k': 0.62, '--kx': 8 })}>
        <div className="mg-set">
          <svg viewBox="-480 -80 1440 140" className="mg-wide" style={{ top: -80 }}>
            <path d="M-480 14C-380 8-260 16-160 12S20 8 56 4C80-4 118-6 140 0C170 8 260 12 360 10S600 14 960 12V60H-480Z" fill="#B7CB86" />
            <path d="M-480 24C-300 18-100 26 60 18C120 14 200 22 360 20S700 24 960 22V30C700 32 400 28 360 28C200 30 120 24 60 26C-100 34-300 26-480 32Z" fill="#D9C67E" />
            <path d="M-480 38C-300 32-100 40 60 32C120 28 200 36 360 34S700 38 960 36V44C700 46 400 42 360 42C200 44 120 38 60 40C-100 48-300 40-480 46Z" fill="#A4BD72" />
            <path d="M-480 24C-300 18-100 26 60 18C120 14 200 22 360 20S700 24 960 22" stroke="#7FA05A" strokeWidth="2.4" fill="none" strokeDasharray="1 4" strokeLinecap="round" />
            <path d="M260 10a6 6 0 0 1 12 0ZM300 10a7 7 0 0 1 14 0ZM420 12a6 6 0 0 1 12 0ZM-20 12a7 7 0 0 1 14 0Z" fill="#6E9A50" />
            {/* Le moulin sur sa butte */}
            <path d="M90 2L93.5-30H106.5L110 2Z" fill="#EADFC6" />
            <path d="M101 2V-30H106.5L110 2Z" fill="#CDBE9E" />
            <path d="M96.5 2V-5a3.5 3.5 0 0 1 7 0V2Z" fill="#5A3A22" />
            <path d="M98.5-18h3v4h-3Z" fill="#3B2E22" />
            <path d="M91-29Q100-46 109-29Z" fill="#B8402F" />
            <path d="M100-41Q106-36 109-29H101Z" fill="#963225" />
            <g className="mg-sails">
              {[0, 90, 180, 270].map((a) => (
                <g key={a} transform={`rotate(${a} 100 -34)`}>
                  <path d="M100-34V-66" stroke="#6B4A2E" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M101-40H107V-65H101Z" fill="#FFFBF1" stroke="#8A6A44" strokeWidth="0.8" />
                  <path d="M101-46H107M101-52H107M101-58H107" stroke="#8A6A44" strokeWidth="0.7" />
                </g>
              ))}
              <circle cx="100" cy="-34" r="2.2" fill="#4A3B2C" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer mg-lists" style={vars({ top: '180px', '--k': 0.8, '--kx': 12 })}>
        <div className="mg-set">
          <svg viewBox="-480 -4 1440 64" className="mg-wide" style={{ top: -4 }}>
            <path d="M-480 2C-380-1-260 3-140 1S80-1 200 2S500 0 960 2V60H-480Z" fill="#9DBF73" />
            <path d="M-480 12C-200 10 200 13 960 11V60H-480Z" fill="#E4D2A6" />
            <path d="M-480 12C-200 10 200 13 960 11" stroke="#C9B585" strokeWidth="1" fill="none" />
            {/* La barrière de la lice */}
            <path d={Array.from({ length: 14 }, (_, i) => `M${172 + i * 32} 0h3v22h-3Z`).join('')} fill="#6B4424" />
            <path d="M170 3H660V7H170Z" fill="#FFFBF1" />
            <path d="M170 12H660V15H170Z" fill="#B88A55" />
            <path d={Array.from({ length: 30 }, (_, i) => `M${178 + i * 16} 3h8v4h-8Z`).join('')} fill="#B8402F" />
            <path d="M20 4l1.5-3 1.5 3ZM60 3l1.5-3 1.5 3ZM120 5l1.5-3 1.5 3Z" fill="#E3B23C" />
          </svg>
          <svg viewBox="0 0 140 72" className="mg-tents">
            <Tent cx={98} w={40} apex={22} top={42} base={68} colors={['#3A6FB8', '#F0D27A']} flag="#B8402F" />
            <Tent cx={46} w={56} apex={10} top={38} base={70} colors={['#B8402F', '#FFFBF1']} flag="#1F4E8C" />
            <path d="M39 70L46 49L53 70Z" fill="#5A2E22" />
            <path d="M46 49L39 70H35ZM46 49L53 70H57Z" fill="#EFE2C6" />
          </svg>
          <Herald />
          <Knight />
          <Quintain />
          <svg viewBox="0 -1 26 6" className="mg-shard">
            <path d="M0 .3L21 .8V3.2L0 3.7Z" fill="#FFFBF1" />
            <path d="M3 .4l4 .1-1.5 3h-4ZM13 .6l4 .1-1.5 2.7h-4Z" fill="#B8402F" />
            <path d="M20-.7L24 0V4L20 4.7Z" fill="#9AA4AE" />
          </svg>
          <svg viewBox="0 0 40 40" className="mg-splinters">
            <path d="M20 20l-8-9M20 20l-2-12M20 20l7-10M20 20l9 2M20 20l-10 4" stroke="#C9A86C" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}
