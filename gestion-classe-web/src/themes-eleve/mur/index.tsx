import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Mur » : un grand mur de béton couvert d'une fresque de street art, un matin clair.
 * Plans, du fond vers l'avant : un liseré de ciel ; le mur (blocs, joints, couvertine, gouttière,
 * grille d'aération) et sa fresque peinte (lettres en bulles « SVT » sur un nuage turquoise, un
 * chat violet assis sur le T, un robot, un soleil, des étoiles, des coulures) ; le trottoir, avec
 * l'échelle où la graffeuse est montée, le seau et son rouleau, des bombes au sol ; enfin quelques
 * fines gouttelettes de peinture qui flottent dans l'air.
 * Mouvement, sans que l'élève touche à rien : la graffeuse peint en direct un arc-en-ciel, bande
 * après bande, d'un geste du bras (le trait se pose sous le nuage de sa bombe), puis baisse le bras
 * et recommence ; le chat de la fresque balance la queue et cligne des yeux, le soleil peint tourne
 * lentement, les étoiles scintillent, les coulures s'allongent, la balle de l'antenne du robot
 * s'allume, les nuages passent. De temps en temps : le robot peint fait un clin d'œil, un pigeon
 * vient se poser sur la couvertine, picore et repart.
 * Au toucher : la graffeuse (elle signe un tag d'un seul trait, à droite, puis il s'efface), le chat
 * (il sort du mur, s'étire en bâillant et y retourne), la bombe posée sur la tablette de l'échelle
 * (elle tombe, roule et fait une flaque de couleur en étoile sur le trottoir), le robot (il salue
 * de la main, des cœurs sur l'écran).
 */

const INK = '#151515';
const RAD = Math.PI / 180;
const f = (n: number) => Number(n.toFixed(1));

/** Étoile à `n` branches, rayons extérieur et intérieur. */
function star(cx: number, cy: number, outer: number, inner: number, n: number): string {
  return `${Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
  }).join('')}Z`;
}

/** Étincelle à quatre branches incurvées. */
function sparkle(x: number, y: number, s: number): string {
  return `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
}

/** L'épaule de la graffeuse, dans le repère du mur : l'arc-en-ciel est centré sur elle, son bras le balaie. */
const SHOULDER = { x: 337, y: 84 };
/** Une bande de l'arc-en-ciel : quart de cercle de rayon `r`, de -95° à -5°. */
function band(r: number): string {
  const a0 = -95 * RAD;
  const a1 = -5 * RAD;
  return `M${f(SHOULDER.x + Math.cos(a0) * r)} ${f(SHOULDER.y + Math.sin(a0) * r)}A${r} ${r} 0 0 1 ${f(SHOULDER.x + Math.cos(a1) * r)} ${f(SHOULDER.y + Math.sin(a1) * r)}`;
}

/** Le tag signé au toucher, d'un seul trait (repère du mur). La buse le suit par `offset-path`. */
const TAG = 'M372 104L392 102L374 124L396 121C398 109 404 106 404 115C404 125 398 128 400 121C402 110 411 108 411 117C411 126 404 128 407 121C411 114 421 115 419 124C417 132 407 132 409 125Q398 140 368 136Q398 148 428 134';

/** Rangs de l'échelle : de chaque montant à l'autre, les montants se rapprochant vers le haut. */
const RUNGS = [52, 70, 88, 106, 124, 142].map((y) => {
  const lean = ((162 - y) / 122) * 8;
  return { y, x1: f(302 + lean), x2: f(342 - lean) };
});

/** Gouttelettes de peinture qui flottent devant la scène. */
const SPECKS = scatter(10, 83, (r) => ({
  x: `${(r() * 96 + 2).toFixed(1)}%`,
  y: `${Math.round(r() * 150 + 30)}px`,
  s: `${(r() * 2.6 + 2).toFixed(1)}px`,
  c: ['#E0287A', '#FFC531', '#20B2A0', '#6A4FD8', '#FF8A3D'][Math.floor(r() * 5)],
  d: `${(r() * 6 + 8).toFixed(1)}s`,
  delay: `${(-r() * 14).toFixed(1)}s`,
  dx: `${Math.round(r() * 40 - 20)}px`,
}));

/** Le bras qui peint (repère du trottoir), dessiné à l'horizontale ; il tourne autour de l'épaule (337, 54). */
function Arm({ className, can }: { className: string; can: string }) {
  return (
    <g className={className}>
      <path d="M337 54L355 54" stroke="#178F80" strokeWidth="9" strokeLinecap="round" />
      <path d="M354 54L369 54" stroke="#178F80" strokeWidth="8" strokeLinecap="round" />
      <path d="M367 54L370 54" stroke="#0F6B5F" strokeWidth="8.400" />
      <rect x="370" y="44" width="8" height="16" rx="2" fill={can} />
      <rect x="370" y="49" width="8" height="4" fill="#FFFFFF" opacity="0.55" />
      <rect x="371.500" y="41" width="5" height="3.200" rx="1" fill="#F4F4F4" />
      <rect x="376.200" y="41.600" width="2.600" height="1.900" fill={INK} />
      <circle cx="373" cy="54" r="4.200" fill="#8D5A3B" />
      <g className="mu-mist">
        <path d="M379 42.500L406 35Q410 42.500 406 50Z" fill="url(#mu-mist)" />
        <circle className="mu-puff" cx="388" cy="41" r="2.600" />
        <circle className="mu-puff mu-puff--b" cx="396" cy="45" r="3" />
        <circle className="mu-puff mu-puff--c" cx="401" cy="39" r="2.200" />
      </g>
    </g>
  );
}

/** Le chat peint, assis (origine : le milieu de son assise). */
function CatSitting() {
  return (
    <g className="mu-cat__sit">
      <g className="mu-cat__tail">
        <path d="M13 -4C30 -4 34 -20 26 -31C22 -37 15 -33 19 -28" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        <path d="M13 -4C30 -4 34 -20 26 -31C22 -37 15 -33 19 -28" fill="none" stroke="#6A4FD8" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M-16 0C-20 -14 -16 -30 0 -30C16 -30 20 -14 16 0Z" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
      <path d="M-7 0C-9 -10 -6 -20 0 -20C6 -20 9 -10 7 0Z" fill="#F6C6E0" />
      <ellipse cx="-6" cy="-1" rx="4.800" ry="3" fill="#6A4FD8" stroke={INK} strokeWidth="2" />
      <ellipse cx="6" cy="-1" rx="4.800" ry="3" fill="#6A4FD8" stroke={INK} strokeWidth="2" />
      <path d="M-12 -45L-15 -61L-3 -53Z" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
      <path d="M12 -45L15 -61L3 -53Z" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
      <path d="M-11.500 -49L-13 -57.500L-7 -53Z M11.500 -49L13 -57.500L7 -53Z" fill="#F6A5C8" />
      <circle cx="0" cy="-40" r="15" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" />
      <ellipse cx="-6" cy="-42" rx="5" ry="6" fill="#FFFFFF" stroke={INK} strokeWidth="1.500" />
      <ellipse cx="6" cy="-42" rx="5" ry="6" fill="#FFFFFF" stroke={INK} strokeWidth="1.500" />
      <circle cx="-5" cy="-41" r="2.700" fill={INK} /><circle cx="7" cy="-41" r="2.700" fill={INK} />
      <circle cx="-4" cy="-42.300" r="0.900" fill="#FFFFFF" /><circle cx="8" cy="-42.300" r="0.900" fill="#FFFFFF" />
      <ellipse className="mu-cat__lid" cx="-6" cy="-42" rx="5.800" ry="6.800" fill="#6A4FD8" />
      <ellipse className="mu-cat__lid" cx="6" cy="-42" rx="5.800" ry="6.800" fill="#6A4FD8" />
      <path d="M-2 -35.500H2L0 -33Z" fill="#F06AA6" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M-3.500 -31.500Q-1.500 -30 0 -32.500Q1.500 -30 3.500 -31.500" fill="none" stroke={INK} strokeWidth="1.200" strokeLinecap="round" />
      <path d="M-9 -35L-19 -37M-9 -33L-19 -32M9 -35L19 -37M9 -33L19 -32" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="-10" cy="-35" rx="2.500" ry="1.500" fill="#F06AA6" opacity="0.7" />
      <ellipse cx="10" cy="-35" rx="2.500" ry="1.500" fill="#F06AA6" opacity="0.7" />
      <path d="M-8 -26Q-10 -18 -9 -10" fill="none" stroke="#FFFFFF" strokeWidth="1.600" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

/** Le chat qui s'étire (pattes avant tendues, dos creusé, queue dressée, il bâille). */
function CatStretch() {
  return (
    <g className="mu-cat__stretch">
      <path d="M16 -26C20 -38 30 -40 30 -52" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M16 -26C20 -38 30 -40 30 -52" fill="none" stroke="#6A4FD8" strokeWidth="5" strokeLinecap="round" />
      <path d="M-22 -3C-24 -11 -16 -14 -6 -13C4 -12 6 -30 15 -30C24 -30 23 -16 19 -8L18 0H9L9 -7C1 -6 -8 -4 -14 -2Z" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
      <ellipse cx="-29" cy="-1.500" rx="5.500" ry="3" fill="#6A4FD8" stroke={INK} strokeWidth="2" />
      <ellipse cx="-19" cy="-1.500" rx="5.500" ry="3" fill="#6A4FD8" stroke={INK} strokeWidth="2" />
      <path d="M-33 -19L-37 -31L-26 -25Z M-13 -19L-9 -31L-20 -25Z" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
      <circle cx="-23" cy="-15" r="12" fill="#6A4FD8" stroke={INK} strokeWidth="2.500" />
      <path d="M-30 -18Q-27 -21 -24 -18M-22 -18Q-19 -21 -16 -18" fill="none" stroke={INK} strokeWidth="1.600" strokeLinecap="round" />
      <ellipse cx="-23" cy="-9.500" rx="3.200" ry="4" fill="#C2185B" stroke={INK} strokeWidth="1.200" />
      <path d="M-25 -13.500H-21L-23 -12Z" fill="#F06AA6" />
      <path d="M-31 -12L-39 -13M-15 -12L-7 -13" stroke={INK} strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

function Pigeon() {
  return (
    <g className="mu-pigeon">
      <g className="mu-pigeon__body">
        <path d="M-1 0V-2.600M3 0V-2.600" stroke="#D9675A" strokeWidth="1.200" strokeLinecap="round" />
        <path d="M8 -7L16 -5L9 -3Z" fill="#6E7583" />
        <ellipse cx="2" cy="-6" rx="8.500" ry="5.500" fill="#9AA1AD" />
        <path className="mu-pigeon__fold" d="M-1 -8Q6 -11.500 11 -6Q4 -2.500 -1 -8Z" fill="#7D8592" />
        <path className="mu-pigeon__fold" d="M3 -7.500L6 -5.500M6 -8.500L9 -6.500" stroke="#5C6370" strokeWidth="1" />
        <path className="mu-pigeon__fly" d="M0 -8L5 -24L9 -8Z" fill="#7D8592" />
        <g className="mu-pigeon__head">
          <path d="M-6.500 -9Q-3 -14 0.500 -9Q-2 -4.500 -6.500 -6Z" fill="#5E8C7A" />
          <circle cx="-6" cy="-12" r="3.500" fill="#8C93A0" />
          <path d="M-9.200 -12.600L-12.200 -11.600L-9.200 -10.800Z" fill="#D9A066" />
          <circle cx="-6.800" cy="-12.700" r="0.900" fill="#E8743B" />
        </g>
      </g>
    </g>
  );
}

export default function MurScene() {
  return (
    <>
      <div className="el-layer mu-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        <span className="mu-cloud" style={vars({ top: '3px', '--d': '80s', '--delay': '-26s', '--s': 1 })} />
        <span className="mu-cloud" style={vars({ top: '9px', '--d': '104s', '--delay': '-71s', '--s': 0.7 })} />
      </div>

      <div className="el-layer mu-wall" style={vars({ top: '22px', '--k': 0.45, '--kx': 3 })}>
        <div className="mu-set">
          <svg viewBox="0 0 480 180" width="480">
            <defs>
              <linearGradient id="mu-letters" x1="0" y1="84" x2="0" y2="150" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFD23F" />
                <stop offset="0.5" stopColor="#FF8A3D" />
                <stop offset="1" stopColor="#E8336D" />
              </linearGradient>
            </defs>

            {/* Gouttière : la boîte sous la couvertine, le tuyau, ses colliers, le dauphin en bas */}
            <path d="M47 4H63L61 14H49Z" fill="#7C838B" />
            <rect x="50" y="13" width="10" height="158" fill="#8C939A" />
            <rect x="52" y="13" width="2.500" height="158" fill="#AEB5BB" />
            {[34, 92, 150].map((y) => <rect key={y} x="48" y={y} width="14" height="4" rx="1" fill="#6B727A" />)}
            <path d="M50 168H60Q62 176 70 176V180H50Z" fill="#7C838B" />

            {/* Grille d'aération */}
            <rect x="70" y="17" width="36" height="24" rx="2" fill="#A39E96" />
            <rect x="73" y="20" width="30" height="18" fill="#5F5A54" />
            {[22.5, 27, 31.5, 36].map((y) => <path key={y} d={`M73 ${y}H103`} stroke="#8F8A83" strokeWidth="2" />)}
            <circle cx="72.500" cy="19.500" r="0.900" fill="#6E6962" /><circle cx="103.500" cy="19.500" r="0.900" fill="#6E6962" />
            <circle cx="72.500" cy="38.500" r="0.900" fill="#6E6962" /><circle cx="103.500" cy="38.500" r="0.900" fill="#6E6962" />

            {/* Fresque : le soleil peint (il tourne doucement) */}
            <g className="mu-sun">
              <path d={star(432, 36, 19, 10, 10)} fill="#FF8A3D" stroke={INK} strokeWidth="2.200" strokeLinejoin="round" />
              <circle cx="432" cy="36" r="7.500" fill="#FFD23F" stroke={INK} strokeWidth="2.200" />
            </g>

            {/* Étoiles et petits motifs autour des lettres */}
            <path className="mu-twinkle" d={star(166, 48, 10, 4.5, 5)} fill="#FFD23F" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path className="mu-twinkle mu-twinkle--b" d={sparkle(214, 40, 8)} fill="#7FE0E8" stroke={INK} strokeWidth="1.600" strokeLinejoin="round" />
            <path className="mu-twinkle mu-twinkle--c" d={sparkle(134, 60, 6)} fill="#F06AA6" stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
            <circle cx="190" cy="58" r="3.400" fill="#9BD43A" stroke={INK} strokeWidth="1.400" />
            <circle cx="148" cy="38" r="2.600" fill="#6A4FD8" stroke={INK} strokeWidth="1.200" />
            <path d="M298 150l6 -7l6 7l6 -7" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M298 150l6 -7l6 7l6 -7" fill="none" stroke="#9BD43A" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />

            {/* Le robot peint */}
            <g className="mu-robot" data-tap="salut" data-tap-ms="3000">
              <path d="M97 84V75" stroke={INK} strokeWidth="2" />
              <circle className="mu-robot__ball" cx="97" cy="72" r="4.200" fill="#FFD23F" stroke={INK} strokeWidth="2" />
              <path d="M81 122Q71 128 74 142" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
              <path d="M81 122Q71 128 74 142" fill="none" stroke="#8FA3C0" strokeWidth="6" strokeLinecap="round" />
              <circle cx="74" cy="145" r="4.200" fill="#8FA3C0" stroke={INK} strokeWidth="2" />
              <rect x="86" y="145" width="7" height="14" fill="#8FA3C0" stroke={INK} strokeWidth="2" />
              <rect x="101" y="145" width="7" height="14" fill="#8FA3C0" stroke={INK} strokeWidth="2" />
              <rect x="82" y="157" width="13" height="7" rx="3.500" fill="#34495E" stroke={INK} strokeWidth="2" />
              <rect x="99" y="157" width="13" height="7" rx="3.500" fill="#34495E" stroke={INK} strokeWidth="2" />
              <rect x="81" y="116" width="32" height="30" rx="6" fill="#FF8A3D" stroke={INK} strokeWidth="2.500" />
              <circle cx="97" cy="130" r="6.500" fill="#FFFFFF" stroke={INK} strokeWidth="1.800" />
              <path d="M97 134.500L93.200 130.600Q91.600 128 94.200 126.900Q96 126.400 97 128.300Q98 126.400 99.800 126.900Q102.400 128 100.800 130.600Z" fill="#E0287A" />
              <circle cx="86.500" cy="141" r="1.600" fill={INK} /><circle cx="107.500" cy="141" r="1.600" fill={INK} />
              <rect x="92.500" y="111" width="9" height="6" fill="#8FA3C0" stroke={INK} strokeWidth="2" />
              <rect x="75" y="93" width="5" height="10" rx="2" fill="#8FA3C0" stroke={INK} strokeWidth="1.800" />
              <rect x="114" y="93" width="5" height="10" rx="2" fill="#8FA3C0" stroke={INK} strokeWidth="1.800" />
              <rect x="79" y="84" width="36" height="28" rx="8" fill="#23B5A5" stroke={INK} strokeWidth="2.500" />
              <rect x="84" y="89" width="26" height="18" rx="5" fill="#1B2433" />
              <g className="mu-robot__eyes">
                <rect x="88" y="93" width="6" height="8" rx="3" fill="#7CF2E5" />
                <rect className="mu-robot__wink" x="100" y="93" width="6" height="8" rx="3" fill="#7CF2E5" />
                <path d="M91 103Q97 107 103 103" fill="none" stroke="#7CF2E5" strokeWidth="2" strokeLinecap="round" />
              </g>
              <g className="mu-robot__hearts">
                <path d="M91 101.500L88.400 98.800Q87.300 97 89.100 96.300Q90.400 96 91 97.300Q91.600 96 92.900 96.300Q94.700 97 93.600 98.800Z" fill="#F06AA6" />
                <path d="M103 101.500L100.400 98.800Q99.300 97 101.100 96.300Q102.400 96 103 97.300Q103.600 96 104.900 96.300Q106.700 97 105.600 98.800Z" fill="#F06AA6" />
                <path d="M92 104Q97 107.500 102 104" fill="none" stroke="#F06AA6" strokeWidth="2" strokeLinecap="round" />
              </g>
              <path d="M84 87Q83 86 86 86" stroke="#FFFFFF" strokeWidth="1.600" strokeLinecap="round" opacity="0.7" />
              <g className="mu-robot__arm">
                <path d="M113 122Q124 117 126 105" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
                <path d="M113 122Q124 117 126 105" fill="none" stroke="#8FA3C0" strokeWidth="6" strokeLinecap="round" />
                <path d="M121.500 102.500Q122 96 126 97M130.500 102.500Q130 96 126 97" fill="none" stroke={INK} strokeWidth="2.400" strokeLinecap="round" />
                <circle cx="126" cy="103" r="4.200" fill="#8FA3C0" stroke={INK} strokeWidth="2" />
              </g>
            </g>

            {/* Les lettres en bulles, sur leur nuage */}
            <g transform="rotate(-4 210 122)">
              <path d="M134 142C120 132 128 110 146 112C146 94 170 86 182 98C190 80 218 80 226 96C238 82 266 86 268 104C286 100 298 122 286 136C298 148 288 166 270 160C262 172 236 172 228 162C216 174 188 174 180 162C168 172 142 166 146 152C136 154 130 148 134 142Z" fill="#9BE0E8" stroke="#1F6F8B" strokeWidth="3" />
              <circle cx="139" cy="160" r="4" fill="#9BE0E8" stroke="#1F6F8B" strokeWidth="2.400" />
              <circle cx="130" cy="167" r="2.400" fill="#9BE0E8" stroke="#1F6F8B" strokeWidth="2" />
              <g className="mu-letters" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <g transform="translate(5 5)" stroke="#3B1E5E" strokeWidth="23">
                  <path d="M172 96C166 86 146 86 144 100C142 114 172 112 172 128C172 144 148 146 140 136" />
                  <path d="M186 96L206 142L226 96" />
                  <path d="M234 98H280M257 98V144" />
                </g>
                <g stroke={INK} strokeWidth="23">
                  <path d="M172 96C166 86 146 86 144 100C142 114 172 112 172 128C172 144 148 146 140 136" />
                  <path d="M186 96L206 142L226 96" />
                  <path d="M234 98H280M257 98V144" />
                </g>
                <g stroke="url(#mu-letters)" strokeWidth="16">
                  <path d="M172 96C166 86 146 86 144 100C142 114 172 112 172 128C172 144 148 146 140 136" />
                  <path d="M186 96L206 142L226 96" />
                  <path d="M234 98H280M257 98V144" />
                </g>
                <g stroke="#FFFFFF" strokeWidth="2.600" opacity="0.85">
                  <path d="M149 95C152 92 158 91 163 93" />
                  <path d="M188 98L192 108" />
                  <path d="M236 95H247" />
                  <path d="M254 106V112" />
                </g>
              </g>
              {/* Coulures : elles s'allongent lentement */}
              <path className="mu-drip" d="M203 146h5v10a2.500 2.500 0 0 1 -5 0z" fill="#E8336D" />
              <path className="mu-drip mu-drip--b" d="M255 148h4.400v8a2.200 2.200 0 0 1 -4.400 0z" fill="#E8336D" />
              <path className="mu-drip mu-drip--c" d="M143 140h4v7a2 2 0 0 1 -4 0z" fill="#E8336D" />

              {/* Le chat, assis sur la barre du T ; l'ombre et la place vide servent quand il sort du mur */}
              <g transform="translate(257 87)">
                <path className="mu-cat__ghost" d="M-16 0C-20 -14 -16 -30 -9 -31L-12 -45L-15 -61L-3 -54Q0 -55 3 -54L15 -61L12 -45L9 -31C16 -30 20 -14 16 0Z" fill="none" stroke="#3B1E5E" strokeWidth="1.600" strokeDasharray="3 3" />
                <ellipse className="mu-cat__shade" cx="4" cy="2" rx="22" ry="4" fill={INK} />
                <g className="mu-cat" data-tap="chat" data-tap-ms="4600">
                  <CatSitting />
                  <CatStretch />
                </g>
              </g>
            </g>

            {/* L'arc-en-ciel en train d'être peint : bandes tracées l'une après l'autre, sans contour encore */}
            <g className="mu-wip" fill="none" strokeWidth="7.400">
              <path className="mu-band mu-band--1" d={band(54)} stroke="#20B2A0" pathLength="1" />
              <path className="mu-band mu-band--2" d={band(61)} stroke="#FFC531" pathLength="1" />
              <path className="mu-band mu-band--3" d={band(68)} stroke="#E0287A" pathLength="1" />
            </g>
            {/* Ses deux nuages, déjà peints */}
            <g fill="#FFFFFF" stroke={INK} strokeWidth="2">
              <path d="M386 86Q384 76 393 76Q396 68 405 72Q414 70 413 80Q420 84 414 89H389Q384 89 386 86Z" />
              <path d="M322 26Q321 19 328 20Q331 14 338 17Q345 16 344 23Q349 26 344 29H325Q320 29 322 26Z" />
            </g>

            {/* Le tag signé au toucher */}
            <g className="mu-tag" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path className="mu-tag__line mu-tag__out" d={TAG} pathLength="1" />
              <path className="mu-tag__line mu-tag__in" d={TAG} pathLength="1" />
            </g>

            {/* Le pigeon qui vient se poser sur la couvertine */}
            <g transform="translate(214 1)"><Pigeon /></g>
          </svg>
          <span className="mu-tagtip" style={{ offsetPath: `path('${TAG}')` }} />
        </div>
      </div>

      <div className="el-layer mu-ground" style={vars({ top: '52px', '--k': 0.62, '--kx': 6 })}>
        <div className="mu-set">
          <svg viewBox="0 0 480 200" width="480">
            <defs>
              <linearGradient id="mu-mist" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Ombres au sol */}
            <ellipse cx="415" cy="163" rx="16" ry="2.600" fill={INK} opacity="0.12" />
            <ellipse cx="322" cy="164" rx="30" ry="3" fill={INK} opacity="0.12" />
            <ellipse cx="230" cy="162" rx="18" ry="2.500" fill={INK} opacity="0.12" />

            {/* La flaque en étoile (au toucher de la bombe) */}
            <g transform="translate(296 157) scale(1 0.42)">
              <g className="mu-splash">
                <path d={star(0, 0, 30, 14, 9)} fill="#E0287A" stroke="#E0287A" strokeWidth="6" strokeLinejoin="round" />
                <path d={star(-3, -3, 13, 7, 7)} fill="#F06AA6" />
              </g>
            </g>
            <g className="mu-drops" fill="#E0287A">
              <circle className="mu-drop" cx="296" cy="154" r="2.400" />
              <circle className="mu-drop mu-drop--b" cx="296" cy="154" r="1.800" />
              <circle className="mu-drop mu-drop--c" cx="296" cy="154" r="2" />
            </g>

            {/* Le seau de peinture, et le rouleau couché sur le trottoir */}
            <g>
              <path d="M402 140H428L425.500 163H404.500Z" fill="#F2F2F2" />
              <path d="M402 140H428L427.600 144.500H402.400Z" fill="#D7D7D7" />
              <path d="M406 144.500H411V151A2.500 2.500 0 0 1 406 151Z" fill="#E0287A" />
              <rect x="405" y="153" width="20" height="5" fill="#20B2A0" opacity="0.85" />
              <path d="M403 141Q415 128 427 141" fill="none" stroke="#7D858E" strokeWidth="1.600" />
              <ellipse cx="415" cy="140.500" rx="12" ry="1.600" fill="#C2185B" />
              <rect x="346" y="157" width="16" height="5" rx="2.500" fill="#3A3F45" />
              <path d="M361 159.500H368L371 156H375" fill="none" stroke="#7D858E" strokeWidth="1.800" />
              <rect x="374" y="151" width="24" height="11" rx="5" fill="#E0287A" />
              <rect x="376" y="153" width="20" height="3" rx="1.500" fill="#F06AA6" />
            </g>

            {/* Bombes posées au sol */}
            <g>
              <rect x="212" y="146" width="9" height="16" rx="2" fill="#6A4FD8" />
              <rect x="212" y="150" width="9" height="4" fill="#FFFFFF" opacity="0.6" />
              <rect x="214" y="143" width="5" height="3.200" rx="1" fill="#F4F4F4" />
              <rect x="224" y="148" width="9" height="14" rx="2" fill="#FF8A3D" />
              <rect x="224" y="152" width="9" height="3.600" fill="#FFFFFF" opacity="0.6" />
              <rect x="226" y="145" width="5" height="3.200" rx="1" fill="#F4F4F4" />
              <rect x="240" y="154" width="16" height="9" rx="2" fill="#20B2A0" transform="rotate(8 248 158)" />
              <rect x="244" y="154" width="4" height="9" fill="#FFFFFF" opacity="0.6" transform="rotate(8 248 158)" />
              <rect x="256" y="156" width="3" height="5" rx="1" fill="#F4F4F4" transform="rotate(8 248 158)" />
              <circle cx="266" cy="161" r="2.400" fill="#F4F4F4" />
            </g>

            {/* L'échelle appuyée au mur */}
            <g>
              <path d="M298 162H304L312 40H306Z" fill="#A7AEB6" />
              <path d="M340 162H346L338 40H332Z" fill="#A7AEB6" />
              <path d="M299.500 162L307.500 40" stroke="#D3D8DD" strokeWidth="1.200" />
              <path d="M341.500 162L333.500 40" stroke="#D3D8DD" strokeWidth="1.200" />
              {RUNGS.map((g) => <rect key={g.y} x={g.x1} y={g.y} width={f(g.x2 - g.x1)} height="3" fill="#8E969F" />)}
              <rect x="295" y="160" width="10" height="4" rx="1" fill="#3A3F45" />
              <rect x="339" y="160" width="10" height="4" rx="1" fill="#3A3F45" />
              <rect x="305" y="36" width="8" height="5" rx="1" fill="#3A3F45" />
              <rect x="331" y="36" width="8" height="5" rx="1" fill="#3A3F45" />
              <rect x="285" y="72" width="22" height="3" fill="#8E969F" />
              <path d="M288 75L305 87" stroke="#7D858E" strokeWidth="1.800" />
            </g>

            {/* La bombe posée sur la tablette de l'échelle (au toucher, elle tombe) */}
            <g className="mu-dropcan" data-tap="bombe" data-tap-ms="3800">
              <rect x="283" y="46" width="26" height="28" fill="transparent" />
              <g className="mu-dropcan__can">
                <rect x="290" y="57" width="11" height="15" rx="2" fill="#E0287A" />
                <path d="M290 59Q295.500 53 301 59Z" fill="#E0287A" />
                <rect x="290" y="62" width="11" height="4.500" fill="#FFD23F" />
                <rect x="292.500" y="52" width="6" height="4" rx="1" fill="#F4F4F4" />
                <rect x="292" y="57" width="2" height="14" fill="#FFFFFF" opacity="0.35" />
              </g>
            </g>

            {/* La graffeuse, sur l'échelle : casquette, masque, sweat à capuche */}
            <g className="mu-artist" data-tap="tag" data-tap-ms="4400">
              <rect x="306" y="16" width="44" height="110" fill="transparent" />
              <path d="M318 58Q309 66 307 78" fill="none" stroke="#0F6B5F" strokeWidth="7" strokeLinecap="round" />
              <circle cx="307" cy="80" r="3.400" fill="#7A4A2E" />
              <path d="M318 90L329 90L328 106L327 121L319 121L319 106Z" fill="#24345A" />
              <path d="M328 90L342 90L341 106L340 121L331 121L330 106Z" fill="#2C3E63" />
              <path d="M335 96L335 118" stroke="#24345A" strokeWidth="1.200" />
              <path d="M317 120H328Q331 120 331 123V124H316Z" fill="#F4F4F4" />
              <path d="M330 120H342Q347 120 348 123V124H330Z" fill="#F4F4F4" />
              <rect x="330" y="122.500" width="18" height="1.500" fill="#C2185B" />
              <path d="M315 60Q317 50 327 48L339 49Q345 52 345 62L344 92Q330 96 316 92Q313 76 315 60Z" fill="#178F80" />
              <path d="M316 88Q330 92 344 88L344 92Q330 96 316 92Z" fill="#0F6B5F" />
              <path d="M319 50Q322 62 331 62Q339 61 340 51Q334 46 329 46Q322 46 319 50Z" fill="#0F6B5F" />
              <path d={star(330, 76, 5.5, 2.4, 5)} fill="#FFD23F" />
              <rect x="328" y="39" width="7" height="10" fill="#7A4A2E" />
              <g className="mu-head">
                <circle cx="332" cy="34" r="10" fill="#8D5A3B" />
                <path d="M322 33Q322 42 329 45L331 36Z" fill="#2A1E1A" />
                <ellipse cx="329" cy="35" rx="2" ry="3" fill="#7A4A2E" />
                <path d="M337 34Q345 32.500 346.500 37.500Q345 43.500 338 43.500Q335.500 38.500 337 34Z" fill="#E3E6E8" />
                <circle cx="342.500" cy="39.500" r="2.400" fill="#9AA3AA" />
                <path d="M337 36L323 33" stroke="#4A4F55" strokeWidth="1.200" />
                <circle cx="340.200" cy="30.600" r="1.100" fill={INK} />
                <path d="M321.500 31Q322 19 333 19Q344 19.500 344 29Q333 27 321.500 31Z" fill="#C2185B" />
                <path d="M341 27Q351 25.500 356 29Q349 31.500 341 31Z" fill="#8E0F42" />
                <circle cx="333" cy="19.500" r="1.300" fill="#8E0F42" />
              </g>
              <Arm className="mu-arm" can="#FFC531" />
              <Arm className="mu-arm2" can="#1E4FD8" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer mu-air" style={vars({ top: '0px', '--k': 0.7, '--kx': 9 })}>
        {SPECKS.map((p, i) => (
          <span key={i} className="mu-speck" style={vars({ left: p.x, top: p.y, '--s': p.s, '--c': p.c, '--d': p.d, '--delay': p.delay, '--dx': p.dx })} />
        ))}
      </div>
    </>
  );
}
