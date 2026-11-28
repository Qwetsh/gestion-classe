import { scatter, vars } from '../shared';
import { LINE, SCREEN_CSS, PROGRAMS, type Row } from './screen';
import './theme.css';

/**
 * Thème « Terminal » : un vieil ordinateur des années 80, la nuit, dans une chambre éclairée par
 * son écran vert.
 * Plans, du fond vers l'avant : mur sombre ; fenêtre sur la nuit (lune, étoiles, toits), étagère
 * de livres et halo vert de l'écran sur le mur ; bureau avec l'écran à tube beige (un chat roux
 * dort dessus, la queue pendante, un pense-bête collé au coin), le lecteur de disquettes et sa
 * disquette à moitié sortie, la boîte de disquettes, la lampe articulée et le pot à crayons ;
 * devant, le clavier et deux disquettes posées à plat.
 * Mouvement, sans que l'élève touche à rien : l'écran tape ses programmes caractère par caractère
 * (BONJOUR, chargement du cours et sa barre de progression, SVT.EXE), le curseur clignote
 * lentement, une ligne de balayage descend l'écran, le halo respire, le chat dort (il respire, sa
 * queue se balance, des « z » montent), les étoiles scintillent, des poussières flottent.
 * De temps en temps (cycle de 40 s) : l'écran défile pour afficher une montagne en caractères,
 * puis la disquette s'enfonce dans le lecteur, son voyant s'allume, et le programme CHAT.EXE fait
 * traverser l'écran à un chat en caractères ; à la fin, la disquette ressort.
 * Au toucher : le clavier (les touches s'enfoncent, l'écran tape FUSEE, compte à rebours, une
 * fusée en caractères décolle), le lecteur (la disquette est éjectée, fait un tour en l'air et
 * retombe dans la fente), la lampe (elle s'allume, éclaire le bureau, un papillon de nuit vient
 * tourner autour, puis elle s'éteint), le chat (il lève la tête, ouvre les yeux, bâille, se
 * rendort).
 * Les programmes de l'écran et leur minutage sont dans `screen.ts`.
 */

/** Étoiles de la fenêtre. */
const STARS = scatter(9, 23, (r) => ({
  x: 350 + r() * 74,
  y: 24 + r() * 52,
  s: r() * 0.9 + 0.7,
  d: `${(r() * 3 + 3).toFixed(1)}s`,
  delay: `${(-r() * 6).toFixed(1)}s`,
}));

/** Poussières qui flottent dans la lumière de l'écran. */
const MOTES = scatter(9, 41, (r) => ({
  x: `${(150 + r() * 190).toFixed(0)}px`,
  y: `${(40 + r() * 140).toFixed(0)}px`,
  d: `${(r() * 8 + 10).toFixed(1)}s`,
  delay: `${(-r() * 18).toFixed(1)}s`,
  dx: `${Math.round(r() * 40 - 20)}px`,
}));

/** Touches du clavier, en perspective : trois rangées qui s'élargissent vers l'avant. */
const KEY_ROWS = [
  { y: 206.2, l: 184, r: 296, n: 13 },
  { y: 210.4, l: 180.5, r: 299.5, n: 13 },
  { y: 214.8, l: 177, r: 303, n: 13 },
];
/** Touches tapées par la commande FUSEE (rangée-rang -> ordre), la dernière est Entrée. */
const TYPED: Record<string, number> = { '1-3': 1, '0-6': 2, '1-1': 3, '0-2': 4, '0-3': 5, '1-12': 6 };

function Keyboard() {
  return (
    <g data-tap="fusee" data-tap-ms="5400" className="tm-kbd">
      <ellipse cx="240" cy="231" rx="80" ry="4" fill="#020502" opacity="0.7" />
      <path d="M180 202.5H300L313 227H167Z" fill="#C8BC9E" />
      <path d="M180 202.5H300L301.4 205H178.6Z" fill="#DAD0B6" />
      <path d="M167 227H313V230.5H167Z" fill="#A39577" />
      {KEY_ROWS.map((row, ri) => {
        const w = (row.r - row.l) / row.n;
        return Array.from({ length: row.n }, (_, k) => {
          const n = TYPED[`${ri}-${k}`];
          const enter = ri === 1 && k === 12;
          const x = row.l + k * w + 0.5;
          return (
            <g key={`${ri}-${k}`} className={n ? `tm-key tm-key--${n}` : 'tm-key'}>
              <rect x={x} y={row.y + 1.6} width={w - 1} height="1.6" fill="#8F8266" />
              <rect className="tm-cap" x={x} y={row.y} width={w - 1} height="2.8" rx="0.6" fill={enter ? '#5E9E5A' : k === 0 && ri === 0 ? '#B85C3C' : '#E6DCC4'} />
            </g>
          );
        });
      })}
      <rect x="196" y="221" width="88" height="1.6" fill="#8F8266" />
      <rect x="196" y="219.4" width="88" height="2.8" rx="0.6" fill="#E6DCC4" />
      <rect x="175" y="219.4" width="18" height="2.8" rx="0.6" fill="#B4A685" />
      <rect x="287" y="219.4" width="18" height="2.8" rx="0.6" fill="#B4A685" />
    </g>
  );
}

function Programs() {
  const cell = (row: Row, p: number, j: number) => {
    const cls = `tm-r tm-r-${p}-${j}`;
    if (row.kind === 'gap') return <div key={j} className="tm-gap" style={{ height: row.rows * LINE }} />;
    if (row.kind === 'show') return <div key={j} className={cls}>{row.text}</div>;
    if (row.kind === 'bar') {
      return (
        <div key={j} className={cls}>
          [<span className="tm-barbox"><span className="tm-fill">{'\u2588'.repeat(10)}</span></span>]<span className="tm-pc"> 100 %</span>
        </div>
      );
    }
    return (
      <div key={j} className={cls}>
        <span className="tm-tx">{row.text}</span>
        <b className="tm-cur" />
      </div>
    );
  };
  return (
    <div className="tm-progs">
      {PROGRAMS.map((prog, p) => (
        <div key={p} className={`tm-prog tm-prog-${p}`}>
          {prog.rows.map((row, j) => cell(row, p, j))}
          {prog.cat && (
            <div className="tm-catwalk">
              <pre className="tm-cat tm-cat--a">{' /\\_/\\\n( o.o )~\n / > \\'}</pre>
              <pre className="tm-cat tm-cat--b">{' /\\_/\\\n( o.o )-\n < \\ \\'}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** La commande FUSEE, jouée au toucher du clavier par-dessus les programmes. */
function Rocket() {
  return (
    <div className="tm-rk">
      <div className="tm-rk-l tm-rk-l1"><span className="tm-tx">{'> FUSEE'}</span></div>
      <div className="tm-rk-l tm-rk-l2"><span className="tm-tx">{'3... 2... 1...'}</span></div>
      <div className="tm-rk-l tm-rk-l3"><span className="tm-tx">{'BON VOYAGE !'}</span></div>
      <div className="tm-rk-ship">
        <pre>{'  /\\\n /  \\\n |()|\n/|  |\\'}</pre>
        <pre className="tm-rk-fire tm-rk-fire--a">{" 'vv'"}</pre>
        <pre className="tm-rk-fire tm-rk-fire--b">{" 'VV'"}</pre>
      </div>
      <pre className="tm-rk-smoke">{'(  ) (   ) ( )'}</pre>
    </div>
  );
}

export default function TerminalScene() {
  return (
    <>
      <style>{SCREEN_CSS}</style>
      <div className="el-layer tm-wall" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer tm-room" style={vars({ top: '0px', '--k': 0.34, '--kx': 2 })}>
        <div className="tm-set">
          <svg viewBox="0 0 480 200" width="480">
            <defs>
              <radialGradient id="tm-halo-g">
                <stop offset="0" stopColor="#39FF14" stopOpacity="0.2" />
                <stop offset="0.55" stopColor="#39FF14" stopOpacity="0.06" />
                <stop offset="1" stopColor="#39FF14" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="tm-warm-g">
                <stop offset="0" stopColor="#FFC870" stopOpacity="0.28" />
                <stop offset="1" stopColor="#FFC870" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="tm-night-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#081626" />
                <stop offset="1" stopColor="#173352" />
              </linearGradient>
            </defs>
            {/* Fenêtre sur la nuit */}
            <rect x="342" y="14" width="92" height="100" fill="#152619" />
            <rect x="348" y="20" width="80" height="88" fill="url(#tm-night-g)" />
            <path d="M412 30a11 11 0 1 0 9 18a9 9 0 1 1 -9 -18Z" fill="#EDE6C4" />
            {STARS.map((s, i) => (
              <circle key={i} className="tm-star" cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.s.toFixed(2)} style={vars({ '--d': s.d, '--delay': s.delay })} />
            ))}
            <path d="M348 108V92h10v-6h8v6h12V82l7-6 7 6v10h9v-8h12v8h7v-4h8v20Z" fill="#06101A" />
            <rect x="370" y="88" width="3" height="3" fill="#E8B04A" opacity="0.8" />
            <rect x="397" y="86" width="3" height="3" fill="#E8B04A" opacity="0.55" />
            <rect x="386" y="20" width="4" height="88" fill="#152619" />
            <rect x="348" y="62" width="80" height="4" fill="#152619" />
            <rect x="336" y="112" width="104" height="6" fill="#1F3524" />
            {/* Étagère : livres, cactus, petit globe */}
            <g transform="translate(12 0)">
            <rect x="34" y="66" width="120" height="5" fill="#2A1E12" />
            <path d="M44 66V39h9v27Z" fill="#5A2C27" />
            <path d="M54 66V43h7v23Z" fill="#24405E" />
            <path d="M62 66V36h10v30Z" fill="#3D5A2A" />
            <path d="M73 66V44h6v22Z" fill="#7A5A22" />
            <path d="M81 66l6-24 7 2-6 22Z" fill="#4A3560" />
            <path d="M45 43h7M45 61h7M63 40h8M63 61h8" stroke="#D9C89A" strokeOpacity="0.5" strokeWidth="1.2" />
            <path d="M114 66l2-11h12l2 11Z" fill="#8A4B2A" />
            <path d="M119 55v-14a3 3 0 0 1 6 0v14ZM119 52h-3v-6a2 2 0 0 1 3 0ZM125 49h3v-5a2 2 0 0 0 -3 0Z" fill="#3F7D3A" />
            <circle cx="142" cy="54" r="8" fill="#2E6A8A" />
            <path d="M136 50q4 -2 6 2t5 1M137 58q3 -3 7 -1" stroke="#7FC27A" strokeWidth="1.6" fill="none" />
            <path d="M138 66h8l-2 -4h-4Z" fill="#6B5222" />
            </g>
            {/* Halo vert de l'écran sur le mur, lumière chaude de la lampe */}
            <ellipse className="tm-halo" cx="240" cy="104" rx="180" ry="112" fill="url(#tm-halo-g)" />
            <ellipse className="tm-warm" cx="130" cy="150" rx="140" ry="96" fill="url(#tm-warm-g)" />
          </svg>
        </div>
      </div>

      <div className="el-layer tm-desk" style={vars({ top: '0px', '--k': 0.5, '--kx': 6 })}>
        <div className="tm-set">
          <svg viewBox="0 0 480 240" width="480">
            <defs>
              <radialGradient id="tm-glass-g" cx="0.5" cy="0.45" r="0.62">
                <stop offset="0" stopColor="#0D2E0E" />
                <stop offset="0.7" stopColor="#061607" />
                <stop offset="1" stopColor="#020702" />
              </radialGradient>
              <linearGradient id="tm-beam-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFE2A0" stopOpacity="0.55" />
                <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="tm-pool-g">
                <stop offset="0" stopColor="#FFCF7A" stopOpacity="0.5" />
                <stop offset="1" stopColor="#FFCF7A" stopOpacity="0" />
              </radialGradient>
              <clipPath id="tm-slot-clip"><rect x="300" y="-60" width="160" height="213" /></clipPath>
              <radialGradient id="tm-desk-glow-g">
                <stop offset="0" stopColor="#39FF14" stopOpacity="0.16" />
                <stop offset="1" stopColor="#39FF14" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Reflet vert de l'écran sur le bureau */}
            <ellipse cx="240" cy="200" rx="120" ry="12" fill="url(#tm-desk-glow-g)" />

            {/* Boîte de disquettes */}
            <g>
              <rect x="430" y="162" width="36" height="26" rx="1" fill="#C23B2E" />
              <rect x="436" y="160" width="36" height="28" rx="1" fill="#E3B23C" />
              <rect x="441" y="163" width="26" height="8" fill="#F4EEDC" />
              <rect x="444" y="168" width="34" height="20" rx="1" fill="#2F6FB0" />
              <rect x="420" y="174" width="58" height="20" fill="#26352A" />
              <rect x="420" y="174" width="58" height="3" fill="#33473A" />
            </g>

            {/* Lecteur de disquettes : le fond de la fente, la disquette, puis le devant */}
            <g data-tap="ejecte" data-tap-ms="3400">
              <path d="M342 150h76v3h-76Z" fill="#DAD0B6" />
              <rect x="354" y="150.6" width="52" height="2.4" fill="#2A251B" />
              <g clipPath="url(#tm-slot-clip)">
              <g className="tm-disk">
                <g className="tm-disk__spin">
                  <rect x="360" y="126" width="40" height="42" rx="2" fill="#2F6FB0" />
                  <rect x="364" y="129" width="32" height="18" rx="1" fill="#F4EEDC" />
                  <path d="M367 134h20M367 138h26M367 142h14" stroke="#9AA7B4" strokeWidth="1.2" />
                  <path d="M367 134h11" stroke="#C23B2E" strokeWidth="1.6" />
                  <rect x="393" y="149" width="4" height="4" fill="#1B3F66" />
                  <rect x="370" y="150" width="20" height="18" fill="#B9C3CC" />
                  <rect x="381" y="153" width="5" height="11" fill="#2F6FB0" />
                </g>
              </g>
              </g>
              <path d="M342 153h76v3h-76Z" fill="#E4DBC3" />
              <rect x="342" y="156" width="76" height="38" rx="2" fill="#C8BC9E" />
              <rect x="342" y="190" width="76" height="4" fill="#A39577" />
              <rect x="348" y="162" width="64" height="9" rx="1" fill="#B4A685" />
              <rect x="350" y="165.5" width="60" height="2" fill="#7E7259" />
              <rect className="tm-eject" x="352" y="178" width="14" height="6" rx="1" fill="#A39577" />
              <circle cx="404" cy="181" r="3" fill="#5A3A14" />
              <circle className="tm-led" cx="404" cy="181" r="3" fill="#FFB020" />
              <circle className="tm-led tm-led--halo" cx="404" cy="181" r="7" fill="#FFB020" />
              <path d="M374 182h22" stroke="#A39577" strokeWidth="1.5" />
            </g>

            {/* L'écran à tube */}
            <path d="M210 182h60l6 13h-72Z" fill="#A39577" />
            <path d="M204 194h72v2h-72Z" fill="#7E7259" />
            <rect x="150" y="38" width="180" height="146" rx="14" fill="#C8BC9E" />
            <path d="M150 52a14 14 0 0 1 14 -14h152a14 14 0 0 1 14 14v2a12 12 0 0 0 -12 -12h-156a12 12 0 0 0 -12 12Z" fill="#DAD0B6" />
            <path d="M150 170a14 14 0 0 0 14 14h152a14 14 0 0 0 14 -14v-4a12 12 0 0 1 -12 12h-156a12 12 0 0 1 -12 -12Z" fill="#A39577" />
            <rect x="159" y="47" width="162" height="105" rx="13" fill="#A39577" />
            <path d="M166 58C166 52 168 51 176 51H304C312 51 314 52 314 58V138C314 144 312 145 304 145H176C168 145 166 144 166 138Z" fill="url(#tm-glass-g)" />
            {/* Menton : grille, plaque, boutons, voyant */}
            <path d="M168 160h40M168 164h40M168 168h40M168 172h40" stroke="#A39577" strokeWidth="2" strokeLinecap="round" />
            <rect x="222" y="160" width="36" height="12" rx="2" fill="#B4A685" />
            <text x="240" y="169.5" textAnchor="middle" className="tm-badge">SVT-84</text>
            <circle cx="282" cy="166" r="5.5" fill="#8F8266" />
            <circle cx="282" cy="165" r="4" fill="#B4A685" />
            <circle cx="298" cy="166" r="5.5" fill="#8F8266" />
            <circle cx="298" cy="165" r="4" fill="#B4A685" />
            <rect x="308" y="161" width="12" height="9" rx="1.5" fill="#8F8266" />
            <circle className="tm-power" cx="314" cy="176" r="1.8" fill="#39FF14" />
            {/* Pense-bête collé au coin de l'écran */}
            <g className="tm-note">
              <path d="M300 30h26v24l-4 4h-22Z" fill="#E8D25A" />
              <path d="M322 58v-4h4Z" fill="#B9A53F" />
              <path d="M304 38h16M304 43h18M304 48h11" stroke="#7A6A1E" strokeWidth="1.2" strokeLinecap="round" />
            </g>

            {/* Le chat roux qui dort sur l'écran, la queue pendante sur le côté */}
            <g data-tap="reveil" data-tap-ms="3400" className="tm-catg">
              <g className="tm-tail">
                <path d="M327 37C333 42 333 54 331 64C329 74 333 82 338 86" stroke="#D9843F" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M334 80C335 83 336 85 338 86" stroke="#9E5426" strokeWidth="6" strokeLinecap="round" fill="none" />
              </g>
              <g className="tm-body">
                <path d="M244 38C244 24 258 16 276 16C296 16 312 24 316 34L328 38Z" fill="#D9843F" />
                <path d="M266 19C270 23 270 29 266 33M281 17C286 22 286 29 282 34M296 20C300 25 300 31 297 35" stroke="#B0602B" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M300 38C306 32 316 32 328 38Z" fill="#E89A55" />
              </g>
              <ellipse cx="252" cy="36.5" rx="8" ry="3" fill="#F2C08A" />
              <g className="tm-head">
                <path d="M234 23L236 11L244 19Z" fill="#D9843F" />
                <path d="M235.5 20L236.5 14L241 18.5Z" fill="#F0A9A0" />
                <path d="M246 18L253 10L255 22Z" fill="#D9843F" className="tm-ear" />
                <ellipse cx="244" cy="27" rx="12" ry="10" fill="#D9843F" />
                <path d="M240 18C242 20 246 20 248 18" stroke="#B0602B" strokeWidth="2" strokeLinecap="round" fill="none" />
                <ellipse cx="244" cy="31" rx="6.5" ry="4.5" fill="#F2C08A" />
                <path className="tm-eye-shut" d="M236.5 26.5q2.5 2 5 0M246.5 26.5q2.5 2 5 0" stroke="#4A2410" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                <g className="tm-eye-open">
                  <ellipse cx="239" cy="26" rx="2.4" ry="2.8" fill="#C8F06A" />
                  <ellipse cx="249" cy="26" rx="2.4" ry="2.8" fill="#C8F06A" />
                  <rect x="238.4" y="23.8" width="1.2" height="4.4" rx="0.6" fill="#1A1A10" />
                  <rect x="248.4" y="23.8" width="1.2" height="4.4" rx="0.6" fill="#1A1A10" />
                </g>
                <path d="M242.6 29.6h2.8l-1.4 1.6Z" fill="#D9707A" />
                <ellipse className="tm-yawn" cx="244" cy="33.6" rx="2.6" ry="2.4" fill="#7A2A2A" />
                <path d="M232 30h-6M232 32.5l-6 1.5M256 30h6M256 32.5l6 1.5" stroke="#F4E6D0" strokeWidth="0.8" strokeLinecap="round" />
              </g>
            </g>

            {/* Lampe articulée */}
            <g data-tap="lampe" data-tap-ms="5000" className="tm-lamp">
              <ellipse cx="84" cy="194" rx="22" ry="4" fill="#020502" opacity="0.6" />
              <path d="M64 194Q66 184 84 183Q102 184 104 194Z" fill="#B8902A" />
              <path d="M64 194h40v2h-40Z" fill="#7A5C16" />
              <path d="M82 184L64 126M88 184L70 126" stroke="#B8902A" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M76 168l4 -2M73 158l4 -2M70 148l4 -2" stroke="#7A5C16" strokeWidth="1.4" />
              <circle cx="67" cy="124" r="4.5" fill="#8E6C1C" />
              <g className="tm-lamp-head">
                <path d="M67 124L114 94M69 128L116 98" stroke="#B8902A" strokeWidth="2.6" strokeLinecap="round" />
                <circle cx="116" cy="95" r="4" fill="#8E6C1C" />
                <g transform="translate(116 95) rotate(-32)">
                  <path d="M-5 -2H5L15 22H-15Z" fill="#B8902A" />
                  <path d="M-5 -2H0L-4 22H-15Z" fill="#D2AA45" />
                  <ellipse cx="0" cy="22" rx="15" ry="4" fill="#3A2A10" />
                  <ellipse className="tm-bulb" cx="0" cy="22" rx="13" ry="3.2" fill="#FFF2C4" />
                </g>
              </g>
            </g>
            {/* Pot à crayons */}
            <g>
              <rect x="122" y="174" width="18" height="20" rx="2" fill="#E9E1CC" />
              <rect x="122" y="180" width="18" height="4" fill="#5E9E5A" />
              <path d="M140 179a5 5 0 0 1 0 10" stroke="#E9E1CC" strokeWidth="2.4" fill="none" />
              <path d="M126 174l-3 -16h3l2 16Z" fill="#E3B23C" />
              <path d="M123 158l1.5 -4 1.5 4Z" fill="#3A2A10" />
              <path d="M131 174l1 -20h3l-1 20Z" fill="#C23B2E" />
              <path d="M135 174l4 -13h3l-4 13Z" fill="#2F6FB0" />
            </g>

            {/* Lumière de la lampe, quand elle est allumée, et le papillon de nuit */}
            <g className="tm-light">
              <polygon points="113,116 136,103 202,186 112,199" fill="url(#tm-beam-g)" />
              <ellipse cx="160" cy="200" rx="66" ry="10" fill="url(#tm-pool-g)" />
            </g>
            <g className="tm-moth">
              <g className="tm-moth__fly">
                <path className="tm-wing" d="M0 0L-6 -4L-5 2Z M0 0L6 -4L5 2Z" fill="#CFC6B0" />
                <ellipse cx="0" cy="0.5" rx="1.2" ry="2.6" fill="#8F8266" />
              </g>
            </g>
          </svg>

          {/* L'écran : programmes en caractères, verre, balayage */}
          <div className="tm-screen">
            <Programs />
            <Rocket />
            <i className="tm-scan" />
            <i className="tm-glass" />
          </div>
          <div className="tm-zs"><b>z</b><b>z</b><b>Z</b></div>
          {MOTES.map((m, i) => (
            <span key={i} className="tm-mote" style={vars({ '--x': m.x, '--y': m.y, '--d': m.d, '--delay': m.delay, '--dx': m.dx })} />
          ))}
        </div>
      </div>

      <div className="el-layer tm-front" style={vars({ top: '0px', '--k': 0.62, '--kx': 9 })}>
        <div className="tm-set">
          <svg viewBox="0 0 480 240" width="480">
            <Keyboard />
            <g>
              <path d="M338 212l34 -4l6 10l-34 4Z" fill="#E3B23C" />
              <path d="M344 214l14 -1.6l2 3.4l-14 1.6Z" fill="#F4EEDC" />
              <path d="M330 220l34 -3l5 9l-34 3Z" fill="#C23B2E" />
              <path d="M336 222l14 -1.3l2 3l-14 1.3Z" fill="#F4EEDC" />
              <path d="M335 229l34 -3v1.6l-34 3Z" fill="#8E2A20" />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
