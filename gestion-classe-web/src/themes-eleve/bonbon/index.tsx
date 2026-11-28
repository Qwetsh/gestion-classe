import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Bonbon » : la vitrine d'une confiserie à l'ancienne, en aplats pastel.
 * Plans, du fond vers l'avant : mur tapissé de rayures roses, lambrequin festonné en haut du mur,
 * étagère lilas garnie de bocaux de verre (bonbons ronds, grande bonbonnière à nœud, pot de
 * petites sucettes, bocal couché d'où s'échappent des bonbons), comptoir menthe avec le
 * distributeur de boules, la sucette géante plantée dans sa boîte, la balance de confiseur et la
 * machine à barbe à papa, puis le rebord de la vitrine où traînent des bonbons (papillote,
 * guimauves torsadées, nœud de ruban, roue de réglisse, berlingots, chewing-gum), enfin des
 * vermicelles de sucre qui tombent doucement.
 * Mouvement, sans que l'élève touche à rien : le feston du lambrequin ondule, la spirale de la
 * sucette tourne, la barbe à papa tourne et gonfle en lâchant des fils de sucre, les plateaux de
 * la balance oscillent, les guimauves respirent, les vermicelles tombent. De temps en temps : un
 * bonbon roule hors du bocal couché le long de l'étagère ; une bulle de chewing-gum gonfle sur le
 * rebord et éclate.
 * Au toucher : le distributeur (la poignée tourne, une boule tombe, rebondit et roule sur le
 * comptoir), la bonbonnière (le couvercle saute et une gerbe de bonbons en jaillit puis y
 * retombe), la sucette géante (elle bondit en tournoyant), la barbe à papa (elle enfle d'un coup
 * et lâche trois petits nuages).
 */

/** Couleurs des bonbons. */
const CANDY = ['#F06292', '#8FD8C0', '#FFD966', '#B79CE8', '#8CC8F2', '#FFAE85', '#F48FB1', '#7CCFB4'];

/** Spirale d'Archimède autour de (cx, cy), de 0 à `r` en `turns` tours, décalée de `phase`. */
function spiral(cx: number, cy: number, r: number, turns: number, phase: number): string {
  const end = turns * Math.PI * 2;
  let d = '';
  for (let t = 0; t <= end + 0.001; t += 0.18) {
    const rr = (r * t) / end;
    const x = cx + Math.cos(t + phase) * rr;
    const y = cy + Math.sin(t + phase) * rr;
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Boules du distributeur : rangées serrées dans le globe de centre (98, 118). */
const GUMBALLS = (() => {
  const balls: { x: number; y: number; c: string }[] = [];
  let k = 0;
  for (let row = 0; row < 6; row += 1) {
    const y = 143 - row * 9.6;
    const off = row % 2 ? 5.5 : 0;
    for (let x = 66 + off; x <= 132; x += 11) {
      balls.push({ x, y, c: CANDY[(k * 3 + row) % CANDY.length] });
      k += 1;
    }
  }
  return balls;
})();

/** Bonbons ronds du grand bocal de gauche. */
const JAR_CANDIES = scatter(16, 13, (r, i) => ({
  x: 53 + (i % 4) * 9.5 + (Math.floor(i / 4) % 2) * 4 + r() * 2,
  y: 95 - Math.floor(i / 4) * 8.5,
  c: CANDY[(i * 5) % CANDY.length],
}));

/** Bonbons de la bonbonnière (visibles derrière le verre). */
const BOWL_CANDIES = scatter(14, 41, (r, i) => ({
  x: 136 + (i % 5) * 9.5 + (Math.floor(i / 5) % 2) * 4.5 + r() * 2,
  y: 94 - Math.floor(i / 5) * 9,
  c: CANDY[(i * 3 + 1) % CANDY.length],
}));

/** La gerbe de la bonbonnière : écart de côté, hauteur, retard. */
const HOPS = scatter(8, 7, (r, i) => ({
  dx: `${Math.round((i - 3.5) * 13 + r() * 6 - 3)}px`,
  h: `${-Math.round(22 + r() * 18)}px`,
  delay: `${(0.25 + r() * 0.45).toFixed(2)}s`,
  spin: `${Math.round(r() * 300 + 200) * (i % 2 ? 1 : -1)}deg`,
  c: CANDY[(i * 3) % CANDY.length],
}));

/** Vermicelles de sucre qui tombent. */
const SPRINKLES = scatter(16, 23, (r, i) => ({
  x: `${(r() * 104 - 2).toFixed(1)}%`,
  d: `${(r() * 7 + 11).toFixed(1)}s`,
  delay: `${(-r() * 18).toFixed(1)}s`,
  dx: `${Math.round(r() * 60 - 30)}px`,
  rot: `${Math.round(r() * 360)}deg`,
  c: CANDY[i % CANDY.length],
}));

/** Un bonbon rond, avec son reflet. */
function Candy({ x, y, r, c }: { x: number; y: number; r: number; c: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="#FFFFFF" opacity="0.7" />
    </>
  );
}

/** Nœud de ruban centré en (x, y). */
function Bow({ x, y, c, dark, s = 1 }: { x: number; y: number; c: string; dark: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-1 1L-5 11L-2 10L0 13ZM1 1L5 11L2 10L0 13Z" fill={dark} />
      <path d="M0 0C-4 -6 -12 -7 -12 -1C-12 5 -4 4 0 0ZM0 0C4 -6 12 -7 12 -1C12 5 4 4 0 0Z" fill={c} />
      <path d="M-2 -1C-5 -3 -9 -3 -9 -1M2 -1C5 -3 9 -3 9 -1" fill="none" stroke={dark} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="0" cy="0" r="2.6" fill={dark} />
    </g>
  );
}

/** Le verre d'un bocal : voile clair, contour et reflet. */
function Glass({ d, shine }: { d: string; shine: string }) {
  return (
    <>
      <path d={d} fill="#FFFFFF" opacity="0.38" />
      <path d={d} fill="none" stroke="#EDB9CD" strokeWidth="1.6" />
      <path d={shine} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
    </>
  );
}

export default function BonbonScene() {
  return (
    <>
      <div className="el-layer bb-wall" style={vars({ top: '0px', '--k': 0.2 })} />

      <div className="el-layer bb-valance" style={vars({ top: '0px', '--k': 0.26, '--kx': 1.5 })}>
        <div className="bb-valance__cloth" />
        <div className="bb-valance__edge" />
      </div>

      <div className="el-layer bb-shelf" style={vars({ top: '0px', '--k': 0.36, '--kx': 4 })}>
        <div className="bb-set">
          <svg viewBox="0 0 480 120" width="480">
            <defs>
              <clipPath id="bb-clip-jar1"><rect x="49" y="58" width="36" height="42" rx="7" /></clipPath>
              <clipPath id="bb-clip-jar2"><path d="M144 62H166C182 64 188 74 188 84C188 94 182 100 170 100H140C128 100 122 94 122 84C122 74 128 64 144 62Z" /></clipPath>
              <clipPath id="bb-clip-jar4"><rect x="291" y="77" width="46" height="22" rx="8" /></clipPath>
            </defs>

            {/* Grand bocal de bonbons ronds */}
            <g clipPath="url(#bb-clip-jar1)">
              {JAR_CANDIES.map((c, i) => <Candy key={i} x={c.x} y={c.y} r={4.6} c={c.c} />)}
            </g>
            <Glass d="M56 58H78Q85 58 85 65V93Q85 100 78 100H56Q49 100 49 93V65Q49 58 56 58Z" shine="M54 66V90" />
            <rect x="46" y="49" width="42" height="10" rx="4" fill="#8FD8C0" />
            <rect x="46" y="56" width="42" height="3" fill="#6FC4A9" />
            <rect x="62" y="44" width="10" height="6" rx="3" fill="#6FC4A9" />

            {/* La bonbonnière : le couvercle saute, une gerbe de bonbons en jaillit (toucher « gerbe ») */}
            <g className="bb-jar" data-tap="gerbe" data-tap-ms="3200">
              <rect x="118" y="40" width="74" height="62" fill="transparent" />
              <g className="bb-jar__body">
                <g clipPath="url(#bb-clip-jar2)">
                  {BOWL_CANDIES.map((c, i) => <Candy key={i} x={c.x} y={c.y} r={4.8} c={c.c} />)}
                  <path d="M150 70l5 -8l5 8z" fill="#FFD966" stroke="#FFD966" strokeWidth="2" strokeLinejoin="round" />
                </g>
                <Glass d="M144 62H166C182 64 188 74 188 84C188 94 182 100 170 100H140C128 100 122 94 122 84C122 74 128 64 144 62Z" shine="M129 78C130 72 134 68 140 66" />
                <rect x="141" y="57" width="28" height="6" rx="2" fill="#FFFFFF" opacity="0.5" />
                <rect x="141" y="57" width="28" height="6" rx="2" fill="none" stroke="#EDB9CD" strokeWidth="1.4" />
              </g>
              <g className="bb-hops">
                {HOPS.map((h, i) => (
                  <g key={i} className="bb-hop" style={vars({ '--dx': h.dx, '--delay': h.delay })}>
                    <g className="bb-hop__y" style={vars({ '--h': h.h, '--delay': h.delay, '--spin': h.spin })}>
                      <Candy x={155} y={60} r={4.8} c={h.c} />
                    </g>
                  </g>
                ))}
              </g>
              <g className="bb-jar__lid">
                <path d="M138 58C138 49 146 45 155 45C164 45 172 49 172 58Z" fill="#F48FB1" />
                <path d="M138 58C138 54 140 51 143 49C142 53 142 55 143 58Z" fill="#FBC4D7" />
                <rect x="136" y="56" width="38" height="4" rx="2" fill="#E06C97" />
                <circle cx="155" cy="42" r="4.5" fill="#E06C97" />
                <circle cx="153.6" cy="40.6" r="1.4" fill="#FBC4D7" />
              </g>
              <Bow x={155} y={64} c="#C2255C" dark="#9C1A49" s={0.75} />
            </g>

            {/* Pot de petites sucettes */}
            <g className="bb-minipops">
              <path d="M247 62L248 81" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M258 54L257 81" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M268 60L266 81" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="247" cy="60" r="7" fill="#FFD966" /><path d={spiral(247, 60, 6, 1.6, 0)} fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
              <circle cx="258" cy="51" r="8" fill="#B79CE8" /><path d={spiral(258, 51, 7, 1.8, 2)} fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
              <circle cx="268" cy="59" r="7" fill="#8FD8C0" /><path d={spiral(268, 59, 6, 1.6, 4)} fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
            </g>
            <path d="M241 74H274L272 100H243Z" fill="#FFFFFF" opacity="0.4" />
            <path d="M241 74H274L272 100H243Z" fill="none" stroke="#EDB9CD" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M241 82H274L273.4 88H241.6Z" fill="#B79CE8" />
            <path d="M246 79V96" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />

            {/* Bocal couché : un bonbon s'en échappe de temps en temps et roule sur l'étagère */}
            <g className="bb-roller">
              <circle cx="333" cy="94.5" r="5.5" fill="#FFFFFF" />
              <path d="M333 89a5.5 5.5 0 0 1 5.5 5.5h-5.5zM333 100a5.5 5.5 0 0 1 -5.5 -5.5h5.5z" fill="#F06292" />
              <circle cx="333" cy="94.5" r="5.5" fill="none" stroke="#E04E7E" strokeWidth="1" />
            </g>
            <g clipPath="url(#bb-clip-jar4)">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Candy key={i} x={296 + (i % 4) * 9.5 + (i > 3 ? 4 : 0)} y={i > 3 ? 87 : 95} r={4.6} c={CANDY[(i * 3 + 2) % CANDY.length]} />
              ))}
            </g>
            <Glass d="M299 77H330Q337 77 337 85V91Q337 99 330 99H299Q291 99 291 91V85Q291 77 299 77Z" shine="M297 82H322" />
            <ellipse cx="338" cy="88" rx="3" ry="11.5" fill="#FFFFFF" opacity="0.5" />
            <ellipse cx="338" cy="88" rx="3" ry="11.5" fill="none" stroke="#EDB9CD" strokeWidth="1.6" />
            <path d="M286 99H294V93H286Z" fill="#B79CE8" />

            {/* Petit bocal de guimauves, au bout de l'étagère */}
            <rect x="424" y="66" width="34" height="34" rx="7" fill="#FFFFFF" opacity="0.4" />
            <rect x="428" y="84" width="12" height="14" rx="4" fill="#FBC4D7" />
            <rect x="441" y="84" width="12" height="14" rx="4" fill="#FFFFFF" />
            <rect x="434" y="71" width="12" height="13" rx="4" fill="#C7EDE0" />
            <rect x="424" y="66" width="34" height="34" rx="7" fill="none" stroke="#EDB9CD" strokeWidth="1.6" />
            <rect x="421" y="60" width="40" height="8" rx="4" fill="#B79CE8" />
          </svg>
        </div>
      </div>

      <div className="el-layer bb-counter" style={vars({ top: '0px', '--k': 0.56, '--kx': 8 })}>
        <div className="bb-set">
          <svg viewBox="0 0 480 190" width="480">
            <defs>
              <clipPath id="bb-clip-globe"><circle cx="98" cy="118" r="28.5" /></clipPath>
            </defs>

            {/* Le distributeur de boules (toucher « boule ») */}
            {/* Décalé de 6 px vers la droite (svg imbriqué), pour laisser voir le grand bocal */}
            <svg x="6" y="0" width="480" height="190" overflow="visible">
            <g className="bb-gum" data-tap="boule" data-tap-ms="3600">
              <circle cx="98" cy="118" r="30" fill="#FFFFFF" opacity="0.55" />
              <g clipPath="url(#bb-clip-globe)">
                <g className="bb-gum__balls">
                  {GUMBALLS.map((b, i) => <Candy key={i} x={b.x} y={b.y} r={5.4} c={b.c} />)}
                </g>
              </g>
              <circle cx="98" cy="118" r="30" fill="#FFFFFF" opacity="0.18" />
              <path d="M76 108C78 98 86 91 95 90" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
              <circle cx="80" cy="117" r="2" fill="#FFFFFF" />
              <circle cx="98" cy="118" r="30" fill="none" stroke="#EDB9CD" strokeWidth="2" />
              <path d="M80 94C82 84 114 84 116 94C110 91 86 91 80 94Z" fill="#C2255C" />
              <circle cx="98" cy="84" r="4.5" fill="#C2255C" />
              <circle cx="96.6" cy="82.6" r="1.4" fill="#F48FB1" />
              <rect x="80" y="144" width="36" height="8" rx="3" fill="#9C1A49" />
              <path d="M78 152H118L126 180H70Z" fill="#C2255C" />
              <path d="M78 152H86L80 180H70Z" fill="#D9487C" />
              <path d="M120 158L140 160Q144 160.5 144 164V168H121Z" fill="#9C1A49" />
              <path d="M128 162L142 163V166H128Z" fill="#6E1236" />
              <circle cx="98" cy="166.3" r="9" fill="#F7DCE6" />
              <circle cx="98" cy="166.3" r="9" fill="none" stroke="#E7B3C7" strokeWidth="1.2" />
              <g className="bb-gum__crank">
                <rect x="90" y="164.3" width="16" height="4" rx="2" fill="#9C1A49" />
                <circle cx="98" cy="166.3" r="2.4" fill="#C2255C" />
              </g>
              <g className="bb-gum__out">
                <circle cx="134" cy="160" r="5.6" fill="#FFD966" stroke="#E0A92A" strokeWidth="1" />
                <path d="M129.2 158.4Q134 161 138.8 158.4" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="132" cy="157.6" r="1.6" fill="#FFFFFF" />
              </g>
            </g>
            </svg>

            {/* La sucette géante plantée dans sa boîte (toucher « sucette ») */}
            <g className="bb-pop" data-tap="sucette" data-tap-ms="2600">
              <rect x="207.5" y="118" width="5" height="48" rx="2.5" fill="#FFFFFF" />
              <rect x="210.5" y="118" width="2" height="48" fill="#EFD9E2" />
              <g className="bb-pop__spin">
                <g className="bb-pop__swirl">
                  <circle cx="210" cy="118" r="27" fill="#FFFFFF" />
                  <path d={spiral(210, 118, 26, 2.2, 0)} fill="none" stroke="#F06292" strokeWidth="7" strokeLinecap="round" />
                  <path d={spiral(210, 118, 25, 2.2, Math.PI)} fill="none" stroke="#8FD8C0" strokeWidth="3.4" strokeLinecap="round" />
                </g>
              </g>
              <circle cx="210" cy="118" r="27" fill="none" stroke="#E5578A" strokeWidth="2" />
              <path d="M193 106C196 99 202 95 208 94" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
              <Bow x={210} y={148} c="#B79CE8" dark="#8E70CC" />
              <path d="M197 162H223L221 180H199Z" fill="#8FD8C0" />
              <path d="M202 162H206L205 180H201ZM212 162H216L215.5 180H211.5Z" fill="#FFFFFF" opacity="0.85" />
              <rect x="195" y="159" width="30" height="5" rx="2.5" fill="#6FC4A9" />
            </g>

            {/* La balance de confiseur : les plateaux oscillent */}
            <g className="bb-scale">
              <g className="bb-scale__l">
                <rect x="260" y="148" width="4" height="12" fill="#9C7FD0" />
                <Candy x={256} y={142} r={4} c="#F06292" />
                <Candy x={265} y={142.5} r={4} c="#FFD966" />
                <Candy x={260.5} y={136} r={4} c="#8CC8F2" />
                <ellipse cx="262" cy="148" rx="16" ry="3.6" fill="#E8B23E" />
                <ellipse cx="262" cy="147" rx="16" ry="2.6" fill="#F7CF62" />
              </g>
              <g className="bb-scale__r">
                <rect x="292" y="148" width="4" height="12" fill="#9C7FD0" />
                <rect x="284" y="136" width="10" height="10" rx="2" fill="#D59A2C" />
                <rect x="285" y="134" width="8" height="3" rx="1.5" fill="#E8B23E" />
                <rect x="297" y="140" width="7" height="6" rx="1.6" fill="#D59A2C" />
                <ellipse cx="294" cy="148" rx="16" ry="3.6" fill="#E8B23E" />
                <ellipse cx="294" cy="147" rx="16" ry="2.6" fill="#F7CF62" />
              </g>
              <path d="M254 180L259 158Q260 156 262 156H294Q296 156 297 158L302 180Z" fill="#C3A6E8" />
              <path d="M254 180L259 158Q260 156 262 156H268L262 180Z" fill="#D5BFF0" />
              <circle cx="278" cy="169" r="7.5" fill="#FFFFFF" />
              <path d="M272 168A6 6 0 0 1 284 168" fill="none" stroke="#E7D9F5" strokeWidth="1.4" />
              <path className="bb-scale__needle" d="M278 169L278 162.5" stroke="#C2255C" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="278" cy="169" r="1.6" fill="#C2255C" />
            </g>

            {/* La machine à barbe à papa (toucher « barbe ») */}
            <g className="bb-floss" data-tap="barbe" data-tap-ms="3400">
              <rect x="352" y="168" width="40" height="12" rx="3" fill="#C2255C" />
              <rect x="356" y="168" width="6" height="12" fill="#D9487C" />
              <ellipse cx="372" cy="150" rx="41" ry="8" fill="#6FC4A9" />
              <g className="bb-floss__puffs">
                <g className="bb-floss__puff"><circle cx="360" cy="116" r="7" /><circle cx="367" cy="113" r="8" /><circle cx="373" cy="117" r="6" /></g>
                <g className="bb-floss__puff"><circle cx="378" cy="114" r="6" /><circle cx="384" cy="111" r="7" /><circle cx="390" cy="115" r="5.5" /></g>
                <g className="bb-floss__puff"><circle cx="366" cy="118" r="5" /><circle cx="371" cy="115" r="6" /><circle cx="377" cy="118" r="5" /></g>
              </g>
              <g className="bb-floss__cloud">
                <circle cx="356" cy="134" r="14" fill="#F7A9C6" />
                <circle cx="388" cy="134" r="14" fill="#F7A9C6" />
                <circle cx="363" cy="121" r="15" fill="#F9B8D0" />
                <circle cx="382" cy="122" r="14" fill="#F9B8D0" />
                <circle cx="372" cy="114" r="14" fill="#FBC8DA" />
                <circle cx="372" cy="138" r="16" fill="#F9B8D0" />
                <g className="bb-floss__swirl">
                  <path d="M372 108C384 110 388 124 380 132M372 148C360 146 356 132 364 124M357 118C362 110 372 108 372 108M387 138C382 146 372 148 372 148" fill="none" stroke="#FDE0EA" strokeWidth="2.4" strokeLinecap="round" />
                </g>
                <circle cx="364" cy="116" r="3.5" fill="#FFFFFF" opacity="0.7" />
              </g>
              <path className="bb-floss__wisp" d="M346 146Q342 140 347 134" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
              <path className="bb-floss__wisp bb-floss__wisp--b" d="M398 146Q403 139 398 133" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M331 150Q333 172 354 172H390Q411 172 413 150Q372 160 331 150Z" fill="#FFFFFF" />
              <path d="M333 158Q372 168 411 158L409 164Q372 172 335 164Z" fill="#8FD8C0" />
              <path d="M331 150Q372 160 413 150" fill="none" stroke="#6FC4A9" strokeWidth="3" strokeLinecap="round" />
              <path d="M338 154Q339 164 346 168" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer bb-front" style={vars({ top: '196px', '--k': 0.85, '--kx': 13 })}>
        <div className="bb-set">
          <svg viewBox="0 0 480 30" width="480">
            <defs>
              <clipPath id="bb-clip-mallow1"><rect x="102" y="7" width="16" height="21" rx="6" /></clipPath>
              <clipPath id="bb-clip-mallow2"><rect x="121" y="11" width="16" height="17" rx="6" /></clipPath>
            </defs>

            {/* Papillote */}
            <g className="bb-wrap">
              <path className="bb-wrap__end" d="M62 19L49 11Q46 19 49 27Z" fill="#FFE68F" />
              <path className="bb-wrap__end bb-wrap__end--r" d="M82 19L95 11Q98 19 95 27Z" fill="#FFE68F" />
              <path d="M50 14L58 18M50 24L58 20M94 14L86 18M94 24L86 20" stroke="#F2C744" strokeWidth="1.2" strokeLinecap="round" />
              <ellipse cx="72" cy="19" rx="12" ry="8.5" fill="#FFD966" />
              <path d="M66 12Q70 19 66 26M74 11Q78 19 74 27" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
            </g>

            {/* Guimauves torsadées : elles respirent */}
            <g className="bb-mallow">
              <g clipPath="url(#bb-clip-mallow1)">
                <rect x="102" y="7" width="16" height="21" fill="#FBC4D7" />
                <path d="M98 14L122 4M98 22L122 12M98 30L122 20" stroke="#FFFFFF" strokeWidth="3.4" />
              </g>
            </g>
            <g className="bb-mallow bb-mallow--b">
              <g clipPath="url(#bb-clip-mallow2)">
                <rect x="121" y="11" width="16" height="17" fill="#C7EDE0" />
                <path d="M117 18L141 8M117 26L141 16M117 34L141 24" stroke="#FFFFFF" strokeWidth="3.4" />
              </g>
            </g>

            {/* Roue de réglisse */}
            <g className="bb-licorice">
              <circle cx="178" cy="17" r="11" fill="#3A2240" />
              <path d={spiral(178, 17, 10, 2.4, 0.6)} fill="none" stroke="#5C3A63" strokeWidth="1.6" />
              <circle cx="178" cy="17" r="3.8" fill="#F48FB1" />
              <circle cx="176.8" cy="15.8" r="1.2" fill="#FFFFFF" />
            </g>

            {/* Nœud de ruban dénoué sur le rebord */}
            <path d="M216 26C224 22 228 28 236 24C244 20 248 26 256 23" fill="none" stroke="#B79CE8" strokeWidth="3" strokeLinecap="round" />
            <Bow x={236} y={18} c="#C2255C" dark="#9C1A49" s={0.9} />

            {/* Berlingots */}
            {[{ x: 296, c: '#FFD966' }, { x: 312, c: '#B79CE8' }, { x: 328, c: '#8FD8C0' }].map((b, i) => (
              <g key={i}>
                <path d={`M${b.x - 7} 26L${b.x + 7} 26L${b.x + (i - 1) * 1.5} 13Z`} fill={b.c} stroke={b.c} strokeWidth="3" strokeLinejoin="round" />
                <path d={`M${b.x + (i - 1) * 1.5} 13L${b.x - 3} 26M${b.x + (i - 1) * 1.5} 13L${b.x + 3} 26`} stroke="#FFFFFF" strokeWidth="1.6" opacity="0.9" />
              </g>
            ))}

            {/* Chewing-gum : une bulle gonfle et éclate de temps en temps */}
            <g className="bb-bubble">
              <circle className="bb-bubble__ball" cx="388" cy="10" r="13" fill="#F9A8C8" opacity="0.92" />
              <path className="bb-bubble__ball" d="M380 4Q382 0 386 -1" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              <g className="bb-bubble__drops">
                <circle cx="372" cy="2" r="1.8" /><circle cx="388" cy="-6" r="1.8" /><circle cx="404" cy="2" r="1.8" />
                <circle cx="376" cy="18" r="1.6" /><circle cx="400" cy="18" r="1.6" />
              </g>
            </g>
            <rect x="380" y="18" width="16" height="9" rx="4" fill="#F48FB1" />
            <rect x="382" y="19" width="6" height="2" rx="1" fill="#FBC4D7" />

            {/* Bonbon emballé, au bord */}
            <path d="M424 20L414 13Q412 20 414 27Z" fill="#9FD3F5" />
            <path d="M444 20L454 13Q456 20 454 27Z" fill="#9FD3F5" />
            <circle cx="434" cy="20" r="8" fill="#8CC8F2" />
            <circle cx="431" cy="17" r="2.4" fill="#FFFFFF" opacity="0.7" />
          </svg>
        </div>
      </div>

      <div className="bb-sprinkles">
        {SPRINKLES.map((s, i) => (
          <span key={i} className="bb-sprinkle" style={vars({ '--x': s.x, '--d': s.d, '--delay': s.delay, '--dx': s.dx, '--rot': s.rot, background: s.c })} />
        ))}
      </div>
    </>
  );
}
