import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Fantasy » : des îles qui flottent dans un ciel de crépuscule, au pays des récits
 * merveilleux.
 * Plans, du fond vers l'avant : ciel violet et rose, deux lunes, îles lointaines, un dragon qui
 * plane au loin, méduses volantes, île de gauche (cristaux, petit arbre, cascade), grande île de
 * droite (tour de magicien, cascade), passage du dragon en gros plan, lucioles, deux rangs de mer
 * de nuages qui deviennent le fond de la page.
 * Mouvement, sans que l'élève touche à rien : les îles se balancent doucement dans les airs, les
 * cascades coulent dans le vide, le dragon plane d'un bord à l'autre en battant des ailes et fait
 * demi-tour, la fenêtre de la tour luit, le fanion flotte, les cristaux brillent, les lucioles
 * dansent, les nuages dérivent. De temps en temps : une étoile filante (toutes les 15 s), un banc
 * de méduses volantes qui monte de la mer de nuages (toutes les 34 s), le dragon qui repasse tout
 * près, devant les îles (toutes les 26 s).
 * Au toucher : le dragon (il fait un looping et souffle une gerbe d'étincelles colorées), les
 * cristaux de l'île de gauche (ils s'illuminent et libèrent une volée de lucioles), le haut de la
 * tour (la fenêtre s'embrase et lance un feu d'artifice d'étincelles, l'étoile du toit tourne).
 */

/** Lucioles qui dansent au-dessus des îles. */
const MOTES = scatter(14, 37, (r) => ({
  left: `${(r() * 96 + 2).toFixed(1)}%`,
  top: `${Math.round(r() * 170 + 30)}px`,
  s: `${(r() * 3 + 4).toFixed(1)}px`,
  dx: `${Math.round(r() * 50 - 25)}px`,
  dy: `${Math.round(-r() * 40 - 12)}px`,
  d: `${(r() * 5 + 7).toFixed(1)}s`,
  g: `${(r() * 1.6 + 1.4).toFixed(1)}s`,
  delay: `${(-r() * 12).toFixed(1)}s`,
  tone: Math.floor(r() * 3),
}));

/** Étoiles qui scintillent (les autres sont dessinées dans le fond du ciel). */
const TWINKLES = scatter(7, 11, (r) => ({
  left: `${(r() * 92 + 4).toFixed(1)}%`,
  top: `${Math.round(r() * 100 + 8)}px`,
  d: `${(r() * 2 + 2).toFixed(1)}s`,
  delay: `${(-r() * 4).toFixed(1)}s`,
}));

/** Volée de lucioles libérée par les cristaux : chacune part dans sa direction. */
const SWARM = scatter(10, 83, (r, i) => {
  const a = (-160 + (i / 9) * 140 + r() * 10) * (Math.PI / 180);
  const len = r() * 50 + 60;
  return {
    bx: `${Math.round(Math.cos(a) * len)}px`,
    by: `${Math.round(Math.sin(a) * len)}px`,
    delay: `${(r() * 0.35).toFixed(2)}s`,
    tone: i % 3,
  };
});

/** Étincelles lancées par la fenêtre de la tour : elles montent, s'ouvrent en gerbe, retombent. */
const SPARKS = scatter(12, 29, (r, i) => {
  const a = (-170 + (i / 11) * 160) * (Math.PI / 180);
  const len = r() * 30 + 46;
  return {
    sx: `${Math.round(Math.cos(a) * len)}px`,
    sy: `${Math.round(Math.sin(a) * len)}px`,
    fall: `${Math.round(Math.sin(a) * len + 34)}px`,
    delay: `${(r() * 0.3).toFixed(2)}s`,
    tone: i % 3,
  };
});

/** Gerbe d'étincelles soufflée par le dragon, en éventail devant sa gueule (repère du dragon). */
const BREATH = scatter(9, 47, (r, i) => {
  const a = (-34 + (i / 8) * 60) * (Math.PI / 180);
  const len = r() * 34 + 62;
  return {
    x: `${Math.round(Math.cos(a) * len)}px`,
    y: `${Math.round(Math.sin(a) * len)}px`,
    delay: `${(r() * 0.25).toFixed(2)}s`,
    tone: i % 3,
  };
});

/** Le dragon, de profil, tourné vers la droite : trapu, des joues roses, l'air content. */
function Dragon({ className, breath }: { className: string; breath?: boolean }) {
  return (
    <svg viewBox="0 0 150 90" className={`fy-dragon ${className}`}>
      <g className="fy-dragon__spin">
        <path className="fy-wing fy-wing--far" d="M70 42C70 30 72 18 74 8L56 5C56 12 52 16 45 15C45 22 43 27 38 30C43 35 47 40 52 43Z" fill="#1E6A63" />
        <path d="M44 54C30 60 18 58 11 50C7 45 6 40 8 35L12 36C12 40 14 44 18 47C26 52 34 53 44 50Z" fill="#3FB59A" />
        <path d="M9 37L1 34L5 25L14 31Z" fill="#FFD27A" />
        <path d="M50 60C49 67 47 71 51 73L56 72C54 70 55 66 58 62Z" fill="#2E9A82" />
        <path d="M38 52C38 42 52 36 68 36C84 36 96 42 98 50C99 58 90 65 72 66C54 67 38 62 38 52Z" fill="#3FB59A" />
        <path d="M44 58C54 63 76 64 94 56C93 61 86 65 72 66C58 67 48 63 44 58Z" fill="#BFEEDB" />
        <path d="M58 61.500Q60 64 62 65M70 62Q71 64.500 72 66M82 60.500Q82 63 82 64.500" fill="none" stroke="#8FD3B8" strokeWidth="1.200" strokeLinecap="round" />
        <path d="M82 62C83 68 85 72 89 72L92 70C89 69 88 66 88 60Z" fill="#2E9A82" />
        <path d="M50 40l4-7 4 6ZM60 37l4-7 4 6ZM70 36l4-7 4 7ZM80 38l4-6 4 7ZM92 42l5-5 2 7Z" fill="#FFD27A" />
        <path d="M86 46C93 40 99 32 103 25L113 29C110 37 103 47 95 54Z" fill="#3FB59A" />
        <path d="M93 53C100 47 106 39 110 31L113 30C110 39 104 48 96 55Z" fill="#BFEEDB" />
        <path d="M104 19L95 8L108 15ZM111 15L108 3L117 13Z" fill="#FFE7B8" />
        <path d="M100 25C101 17 109 12 118 13C127 14 136 19 139 25C140 31 134 34 125 34C117 35 107 36 103 32C101 30 100 28 100 25Z" fill="#3FB59A" />
        <path d="M106 32C114 33 126 33 138 28C136 33 128 35 120 35C113 35 108 34 106 32Z" fill="#BFEEDB" />
        <circle cx="125.500" cy="28" r="2.600" fill="#FF9FB8" opacity="0.75" />
        <path d="M121 30.500Q127 32.500 133 29" fill="none" stroke="#16413B" strokeWidth="1.200" strokeLinecap="round" />
        <circle cx="134.500" cy="22.500" r="1" fill="#16413B" />
        <g className="fy-eye">
          <ellipse cx="116" cy="21" rx="3.600" ry="3.800" fill="#FFFFFF" />
          <circle cx="117" cy="21.500" r="2.100" fill="#16213A" />
          <circle cx="116.200" cy="20.300" r="0.800" fill="#FFFFFF" />
        </g>
        <g className="fy-wing fy-wing--near">
          <path d="M78 44C78 30 79 16 80 6L60 2C58 10 52 14 46 12C48 20 46 26 40 28C46 32 50 40 54 44Z" fill="#2C8C83" />
          <path d="M80 6L46 12C48 20 46 26 40 28L80 6Z" fill="#3AA394" />
          <path d="M78 44L80 6L60 2M80 6L46 12M80 6L40 28" fill="none" stroke="#1C5B55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {breath && (
          <g className="fy-breath">
            <path className="fy-flame" d="M137 28C152 18 172 18 194 11C183 23 185 31 198 39C178 39 156 35 137 30Z" fill="#FF9F6B" />
            <path className="fy-flame" d="M137 28.500C150 23 163 23 177 20C169 27 169 31 178 34C163 34 149 31 137 29.500Z" fill="#FFE58A" />
            {BREATH.map((b, i) => (
              <path
                key={i}
                className={`fy-puff fy-puff--${b.tone}`}
                d="M139 24L140.400 27.600L144 29L140.400 30.400L139 34L137.600 30.400L134 29L137.600 27.600Z"
                style={vars({ '--x': b.x, '--y': b.y, '--delay': b.delay })}
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}

/** Méduse volante : une ombrelle translucide et des filaments qui ondulent. */
function Jelly({ className }: { className: string }) {
  return (
    <div className={`fy-jelly ${className}`}>
      <svg viewBox="0 0 30 46" width="100%">
        <circle cx="15" cy="13" r="14" fill="#F7B6EA" opacity="0.18" />
        <g className="fy-jelly__tails" fill="none" stroke="#F3B0E6" strokeWidth="1.600" strokeLinecap="round" opacity="0.85">
          <path d="M8 18C6 25 10 30 8 38" /><path d="M13 19C12 27 15 33 13 44" /><path d="M18 19C19 26 16 32 18 42" /><path d="M23 18C25 24 21 29 23 36" />
        </g>
        <path className="fy-jelly__bell" d="M3 17C3 8 8 2 15 2C22 2 27 8 27 17C24 19 21 17 19 19C17 17 13 17 11 19C9 17 6 19 3 17Z" fill="#F4A8E6" opacity="0.9" />
        <path d="M8 11C9 7 11.500 5 15 4.500" fill="none" stroke="#FFFFFF" strokeWidth="1.600" strokeLinecap="round" opacity="0.8" />
        <path d="M6 16C10 14.500 20 14.500 24 16" fill="none" stroke="#FFD6F6" strokeWidth="1.200" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Une cascade qui tombe du bord d'une île, dans le vide, jusqu'à la mer de nuages. */
function Fall({ left, top, height }: { left: number; top: number; height: number }) {
  return (
    <span className="fy-fall" style={{ left, top, height }}>
      <span className="fy-fall__water" />
    </span>
  );
}

export default function FantasyScene() {
  return (
    <>
      <div className="el-layer fy-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        {TWINKLES.map((t, i) => (
          <span key={i} className="fy-twinkle" style={vars({ left: t.left, top: t.top, '--d': t.d, '--delay': t.delay })} />
        ))}
      </div>

      <div className="el-layer fy-moons" style={vars({ top: '0px', '--k': 0.32, '--kx': 2 })}>
        <div className="fy-set">
          <span className="fy-halo" />
          <svg viewBox="0 0 480 120" width="480">
            <circle cx="112" cy="54" r="27" fill="#F2E6FF" />
            <path d="M112 27A27 27 0 0 1 112 81A20 27 0 0 0 112 27Z" fill="#DCC9F7" />
            <circle cx="102" cy="46" r="5" fill="#E2D2FA" /><circle cx="118" cy="64" r="3.500" fill="#E2D2FA" /><circle cx="99" cy="64" r="2.500" fill="#E2D2FA" />
            <circle cx="180" cy="28" r="9" fill="#A6E9DE" />
            <path d="M180 19A9 9 0 0 1 180 37A6 9 0 0 0 180 19Z" fill="#78CFC3" />
          </svg>
          <span className="fy-shoot" />
        </div>
      </div>

      <div className="el-layer fy-far" style={vars({ top: '0px', '--k': 0.4, '--kx': 4 })}>
        <div className="fy-set">
          <svg viewBox="0 0 480 200" width="480">
            <g className="fy-bob fy-bob--a">
              <path d="M210 118C214 113 228 111 238 111C248 111 260 113 264 118C258 128 248 136 238 146C228 136 218 128 210 118Z" fill="#4F3A88" />
              <path d="M208 118C212 111 226 109 238 109C250 109 262 111 266 118C256 121 222 121 208 118Z" fill="#4E8C8E" />
              <path d="M240 96C232 96 228 104 232 109H248C252 104 248 96 240 96Z" fill="#3F7A80" />
              <rect x="260" y="118" width="3" height="60" fill="#8E86CC" opacity="0.55" />
            </g>
            <g className="fy-bob fy-bob--b">
              <path d="M44 96C47 93 55 92 62 92C69 92 76 93 79 96C75 103 68 109 62 115C56 109 49 103 44 96Z" fill="#54408E" />
              <path d="M42 96C45 91 54 90 62 90C70 90 78 91 81 96C74 98 50 98 42 96Z" fill="#4E8C8E" />
            </g>
            <g className="fy-bob fy-bob--c">
              <path d="M404 46C407 43 414 42 420 42C426 42 433 43 436 46C432 52 426 57 420 62C414 57 408 52 404 46Z" fill="#54408E" />
              <path d="M402 46C405 41 413 40 420 40C427 40 435 41 438 46C431 48 409 48 402 46Z" fill="#4E8C8E" />
              <rect x="406" y="46" width="2.500" height="40" fill="#8E86CC" opacity="0.5" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer fy-skyway" style={vars({ top: '0px', '--k': 0.46, '--kx': 5 })}>
        <div className="fy-set">
          <div className="fy-glide">
            <div className="fy-face">
              <Dragon className="fy-dragon--far" breath />
            </div>
          </div>
          <span className="fy-zone" data-tap="souffle" data-tap-ms="3200" />
        </div>
      </div>

      <div className="el-layer fy-jellies" style={vars({ top: '0px', '--k': 0.5, '--kx': 6 })}>
        <div className="fy-set">
          <Jelly className="fy-jelly--a" />
          <Jelly className="fy-jelly--b" />
          <Jelly className="fy-jelly--c" />
        </div>
      </div>

      <div className="el-layer fy-isle fy-isle--left" style={vars({ top: '0px', '--k': 0.58, '--kx': 8 })}>
        <div className="fy-set">
          <div className="fy-bob fy-bob--left">
            <svg viewBox="0 0 480 240" width="480">
              <path d="M30 140C34 132 60 128 110 128C150 128 182 132 190 140C188 150 178 160 166 170C150 186 132 204 112 224C100 214 90 200 74 186C56 172 40 158 30 140Z" fill="#5B428F" />
              <path d="M30 140C40 158 56 172 74 186C90 200 100 214 112 224L104 146Z" fill="#7A5CB0" />
              <path d="M190 140C188 150 178 160 166 170C150 186 132 204 112 224L128 148Z" fill="#432F75" />
              <path d="M70 170L76 194L82 174ZM140 172L136 196L148 178ZM104 200L110 236L116 204Z" fill="#432F75" />
              <path d="M52 152C50 162 54 168 50 178M158 156C162 166 158 172 162 182" fill="none" stroke="#3E8E7E" strokeWidth="2" strokeLinecap="round" />
              <path d="M26 140C28 128 62 122 110 122C158 122 188 128 194 140C182 146 166 143 154 148C140 143 126 150 112 146C98 151 84 144 70 149C56 144 42 148 26 140Z" fill="#3F9B83" />
              <path d="M40 130C60 125 86 124 110 124C140 124 166 126 184 132C160 129 136 128 110 128C86 128 60 129 40 130Z" fill="#6CC6A4" />
              <path d="M140 131C152 128 166 133 182 134" fill="none" stroke="#8FD3EE" strokeWidth="3" strokeLinecap="round" />
              <path d="M176 133C184 131 191 134 193 141L191 145H181C181 140 179 136 176 133Z" fill="#A9E2F5" />
              <g className="fy-tree">
                <path d="M152 126C152 118 150 112 148 106H154C154 112 156 118 156 126Z" fill="#6B4A6E" />
                <circle cx="151" cy="98" r="13" fill="#2F7F6E" />
                <circle cx="145" cy="94" r="7" fill="#46A88A" />
                <circle cx="158" cy="102" r="5" fill="#46A88A" />
                <circle cx="148" cy="104" r="1.800" fill="#FF9FB8" /><circle cx="156" cy="92" r="1.800" fill="#FF9FB8" /><circle cx="142" cy="98" r="1.500" fill="#FFE58A" />
              </g>
              <path d="M58 126C56 120 60 116 64 120C66 114 72 116 70 122C74 122 74 126 70 127Z" fill="#2F7F6E" />
              <g className="fy-crystals" data-tap="lucioles" data-tap-ms="3400">
                <circle className="fy-crystals__glow" cx="98" cy="116" r="30" fill="url(#fy-glow-cyan)" />
                <path className="fy-crystal" d="M84 132L80 118L86 110L91 119L90 132Z" fill="#D58CF5" />
                <path d="M86 110L91 119L90 132H87Z" fill="#B266DC" />
                <path className="fy-crystal" d="M96 132L92 106L99 92L106 106L103 132Z" fill="#8FEFF7" />
                <path d="M99 92L106 106L103 132H99Z" fill="#4FC8DA" />
                <path className="fy-crystal" d="M106 132L111 116L118 111L118 124L112 132Z" fill="#8FEFF7" />
                <path d="M118 111L118 124L112 132L114 118Z" fill="#4FC8DA" />
                <path className="fy-crystal" d="M76 132L74 125L78 121L81 126L80 132Z" fill="#E7D2FF" />
                <path d="M95 100L97 96M95 112L96 106" stroke="#FFFFFF" strokeWidth="1.400" strokeLinecap="round" />
              </g>
              <defs>
                <radialGradient id="fy-glow-cyan">
                  <stop offset="0" stopColor="#9FF4FF" stopOpacity="0.75" />
                  <stop offset="1" stopColor="#9FF4FF" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="fy-glow-gold">
                  <stop offset="0" stopColor="#FFE08A" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#FFC56B" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
            <Fall left={181} top={141} height={109} />
            {SWARM.map((s, i) => (
              <span key={i} className={`fy-swarm fy-mote--${s.tone}`} style={vars({ '--bx': s.bx, '--by': s.by, '--delay': s.delay })} />
            ))}
          </div>
        </div>
      </div>

      <div className="el-layer fy-isle fy-isle--right" style={vars({ top: '0px', '--k': 0.7, '--kx': 12 })}>
        <div className="fy-set">
          <div className="fy-bob fy-bob--right">
            <svg viewBox="0 0 480 240" width="480">
              <path d="M254 170C262 162 300 158 364 158C424 158 462 162 476 170C472 182 458 190 444 198C426 208 404 218 384 230C366 220 342 210 318 200C294 190 266 184 254 170Z" fill="#5B428F" />
              <path d="M254 170C266 184 294 190 318 200C342 210 366 220 384 230L362 176Z" fill="#7A5CB0" />
              <path d="M476 170C472 182 458 190 444 198C426 208 404 218 384 230L398 178Z" fill="#432F75" />
              <path d="M296 192L302 212L308 196ZM420 200L414 222L428 206ZM360 214L366 236L372 218Z" fill="#432F75" />
              <path d="M286 180C284 190 288 196 284 206M446 184C450 194 446 200 450 210" fill="none" stroke="#3E8E7E" strokeWidth="2" strokeLinecap="round" />
              <path d="M250 170C254 158 300 152 364 152C428 152 468 158 478 170C468 175 452 172 440 177C428 172 414 178 402 174C390 179 376 173 362 178C348 173 334 179 320 174C306 178 292 173 280 177C268 172 258 176 250 170Z" fill="#3F9B83" />
              <path d="M262 160C290 155 330 153 364 153C400 153 440 156 466 162C430 159 398 158 364 158C330 158 292 159 262 160Z" fill="#6CC6A4" />
              <path d="M288 156C286 150 290 146 294 150C296 144 302 146 300 152C304 152 304 156 300 157Z" fill="#2F7F6E" />
              <path d="M416 156L418 144L423 140L425 148L422 156ZM426 156L430 148L434 147L433 153L430 156Z" fill="#8FEFF7" />
              <path d="M423 140L425 148L422 156H420Z" fill="#4FC8DA" />
              <path d="M306 160C292 158 282 163 270 163" fill="none" stroke="#8FD3EE" strokeWidth="3" strokeLinecap="round" />
              <path d="M272 163C264 161 257 164 255 171L257 175H267C267 170 269 166 272 163Z" fill="#A9E2F5" />
              {/* La tour du magicien */}
              <path d="M339 103L334 160H370L365 103Z" fill="#A88FD3" />
              <path d="M339 103L334 160H352V103Z" fill="#DCCDF5" />
              <path d="M336 140H368M337 118H367" fill="none" stroke="#8C72BE" strokeWidth="2" opacity="0.6" />
              <path d="M342 150h5M356 130h6M344 112h4M358 114h4" fill="none" stroke="#8C72BE" strokeWidth="1.600" strokeLinecap="round" opacity="0.7" />
              <path d="M346 160V152A6 6 0 0 1 358 152V160Z" fill="#5C3A2E" />
              <path d="M352 146V160" stroke="#3E241C" strokeWidth="1" />
              <path className="fy-lamp" d="M343 132V126A3 3 0 0 1 349 126V132Z" fill="#FFD27A" />
              <g data-tap="etincelles" data-tap-ms="3000">
                <rect x="324" y="4" width="56" height="102" fill="transparent" />
                <circle className="fy-window-glow" cx="352" cy="85" r="22" fill="url(#fy-glow-gold)" />
                <path d="M332 96H372L367 103H337Z" fill="#8E73C2" />
                <path d="M336 103l2 4h3l2 -4ZM361 103l2 4h3l2 -4Z" fill="#8E73C2" />
                <path d="M336 70H368V96H336Z" fill="#A88FD3" />
                <path d="M336 70H352V96H336Z" fill="#DCCDF5" />
                <path className="fy-window" d="M346 92V81A6 6 0 0 1 358 81V92Z" fill="#FFD27A" />
                <path d="M346 87H358V92H346Z" fill="#FFB347" opacity="0.8" />
                <path d="M352 76V92M346 85H358" fill="none" stroke="#6B4A2B" strokeWidth="1.200" />
                <path d="M330 68C340 60 348 42 352 22C356 42 364 60 374 68Z" fill="#4B2F91" />
                <path d="M330 68C340 60 348 42 352 22V68Z" fill="#6A4BB4" />
                <path d="M328 66H376L372 72H332Z" fill="#E8C46A" />
                <circle cx="346" cy="54" r="1.300" fill="#FFE08A" /><circle cx="356" cy="44" r="1.100" fill="#FFE08A" /><circle cx="360" cy="60" r="1.300" fill="#FFE08A" />
                <path d="M352 22V8" stroke="#6B4A2B" strokeWidth="1.400" />
                <path className="fy-flag" d="M352 9C358 8 362 11 368 10C364 13 364 15 368 17C362 18 358 16 352 17Z" fill="#FF9FB8" />
                <path className="fy-star" d="M352 17L353.6 20.4L357 22L353.6 23.6L352 27L350.4 23.6L347 22L350.4 20.4Z" fill="#FFE08A" />
              </g>
            </svg>
            <Fall left={258} top={171} height={79} />
            {SPARKS.map((s, i) => (
              <span key={i} className={`fy-spark fy-mote--${s.tone}`} style={vars({ '--sx': s.sx, '--sy2': s.sy, '--fall': s.fall, '--delay': s.delay })} />
            ))}
          </div>
        </div>
      </div>

      <div className="el-layer fy-pass" style={vars({ top: '0px', '--k': 0.78, '--kx': 14 })}>
        <div className="fy-pass__path">
          <div className="fy-pass__bob">
            <Dragon className="fy-dragon--near" />
          </div>
        </div>
      </div>

      <div className="el-layer fy-motes" style={vars({ top: '0px', '--k': 0.66, '--kx': 10 })}>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className={`fy-mote fy-mote--${m.tone}`}
            style={vars({ left: m.left, top: m.top, '--s': m.s, '--dx': m.dx, '--dy': m.dy, '--d': m.d, '--g': m.g, '--delay': m.delay })}
          />
        ))}
      </div>

      <div className="el-layer fy-clouds fy-clouds--back" style={vars({ top: '200px', '--k': 0.84, '--kx': 16 })} />
      <div className="el-layer fy-clouds fy-clouds--front" style={vars({ top: '216px', '--k': 0.95, '--kx': 22 })} />
    </>
  );
}
