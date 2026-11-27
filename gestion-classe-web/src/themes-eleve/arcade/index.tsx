import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Arcade » : un petit monde en pixels, dessiné pour l'occasion (aucun jeu existant).
 * Plans, du fond vers l'avant : ciel et étoiles, lune, nuages, score et cœurs, montagnes en
 * escalier, sol en briques avec deux plateformes, un coffre, des gemmes, une gelée verte et un
 * petit robot jaune.
 * Mouvement, sans que l'élève touche à rien : le robot fait les cent pas (deux images pour les
 * jambes, déplacement pixel par pixel), la gelée sautille, les gemmes flottent et scintillent, les
 * étoiles clignotent, les nuages passent, un cœur bat.
 * Au toucher : le robot (un grand saut périlleux, un petit rebond, de la poussière à l'atterrissage),
 * le coffre (il s'ouvre, des gemmes en jaillissent en cloche, le score monte de 500).
 */

type Palette = Record<string, string>;

/** Un dessin en pixels : une lettre par pixel, « . » pour le vide ; les suites d'une même couleur sont fusionnées. */
function Sprite({ rows, colors, px = 4, className }: { rows: string[]; colors: Palette; px?: number; className?: string }) {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, r) => {
    let start = 0;
    while (start < row.length) {
      const ch = row.charAt(start);
      let end = start + 1;
      while (end < row.length && row.charAt(end) === ch) end += 1;
      if (ch !== '.') runs.push({ x: start * px, y: r * px, w: (end - start) * px, fill: colors[ch] ?? '#FFFFFF' });
      start = end;
    }
  });
  return (
    <g className={className} shapeRendering="crispEdges">
      {runs.map((run) => <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={px} fill={run.fill} />)}
    </g>
  );
}

const ROBOT: Palette = { y: '#FFD23F', d: '#C99A12', c: '#6EE7F9', w: '#FFFFFF', p: '#FF8AE0', k: '#170F2E' };
const ROBOT_BODY = ['....p....', '....y....', '.yyyyyyy.', '.ycccccy.', '.yckckcy.', '.yyyyyyy.', '..yyyyy..', '.pyyyyyp.', '..yyyyy..'];
const ROBOT_LEGS_A = ['..d...d..', '.dd...dd.'];
const ROBOT_LEGS_B = ['...d.d...', '..dd.dd..'];
const GEM = ['..c..', '.cwc.', 'cwccc', '.ccc.', '..c..'];
const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const CHEST_LID = ['.bbbbbbb.', 'bnnnnnnnb', 'bYYYYYYYb'];
const CHEST_BOX = ['bbbbybbbb', 'bnnnynnnb', 'bnnnnnnnb', 'bbbbbbbbb'];
const CHEST: Palette = { b: '#7A4B2A', n: '#B5763A', Y: '#FFD23F', y: '#FFE27A' };
const SLIME = ['..gggg..', '.gggggg.', 'ggkggkgg', 'gggggggg', '.gggggg.'];
const MOON = ['..mmmm..', '.mmmmmm.', 'mmnmmmmm', 'mmmmmmmm', 'mmmmmnmm', 'mmmmmmmm', '.mmnmmm.', '..mmmm..'];
const CLOUD = ['...www....', '.wwwwwww..', 'wwwwwwwwww', '.wwwwwwww.'];

const STARS = scatter(22, 17, (r, i) => ({
  x: `${(r() * 100).toFixed(1)}%`,
  y: `${Math.round(r() * 112 + 4)}px`,
  s: r() > 0.7 ? '4px' : '2px',
  color: ['#F6F0FF', '#FFD23F', '#FF8AE0', '#6EE7F9'][i % 4] ?? '#F6F0FF',
  d: `${(r() * 2.4 + 1.2).toFixed(1)}s`,
  delay: `${(-r() * 3).toFixed(1)}s`,
}));

const LOOT = scatter(7, 5, (r, i) => ({
  dx: `${Math.round((i - 3) * 26 + r() * 12 - 6)}px`,
  h: `${Math.round(46 + r() * 34)}px`,
  delay: `${(0.36 + r() * 0.22).toFixed(2)}s`,
  color: ['#6EE7F9', '#FF8AE0', '#FFD23F'][i % 3] ?? '#6EE7F9',
}));

function Platform({ x, y, tiles }: { x: number; y: number; tiles: number }) {
  return (
    <g transform={`translate(${x} ${y})`} shapeRendering="crispEdges">
      <rect width={tiles * 16} height="4" fill="#9B7CFF" />
      <rect y="4" width={tiles * 16} height="8" fill="#4A3690" />
      {Array.from({ length: tiles }, (_, i) => <rect key={i} x={i * 16 + 12} y="4" width="4" height="8" fill="#3B2A78" />)}
    </g>
  );
}

export default function ArcadeScene() {
  return (
    <>
      <div className="el-layer ar-sky" style={vars({ top: '0px', '--k': 0.3 })}>
        {STARS.map((s, i) => (
          <span key={i} className="ar-star" style={vars({ left: s.x, top: s.y, width: s.s, height: s.s, background: s.color, '--d': s.d, '--delay': s.delay })} />
        ))}
        <div className="el-stage">
          <div className="ar-hud">
            <span>SCORE </span><span className="ar-score ar-score--old">004200</span><span className="ar-score ar-score--new">004700</span>
          </div>
          <svg className="ar-hearts" viewBox="0 0 100 24" width="100">
            {[0, 34, 68].map((x, i) => (
              <g key={x} transform={`translate(${x} 0)`}><Sprite rows={HEART} colors={{ r: '#FF7A9C' }} className={i === 2 ? 'ar-heart ar-heart--beat' : 'ar-heart'} /></g>
            ))}
          </svg>
        </div>
      </div>

      <div className="el-layer ar-heaven" style={vars({ top: '0px', '--k': 0.34, '--kx': 3 })}>
        <div className="el-stage">
          <svg className="ar-moon" viewBox="0 0 32 32" width="32"><Sprite rows={MOON} colors={{ m: '#F6EFD2', n: '#D9D0A8' }} /></svg>
        </div>
        <svg className="ar-cloud" viewBox="0 0 40 16" width="60"><Sprite rows={CLOUD} colors={{ w: '#3A2A6E' }} /></svg>
        <svg className="ar-cloud ar-cloud--b" viewBox="0 0 40 16" width="44"><Sprite rows={CLOUD} colors={{ w: '#30225E' }} /></svg>
      </div>

      <div className="el-layer ar-far" style={vars({ top: '108px', '--k': 0.45, '--kx': 5 })} />

      <div className="el-layer ar-world" style={vars({ top: '0px', '--k': 0.82, '--kx': 12 })}>
        <div className="ar-ground" />
        <div className="ar-set">
          <svg viewBox="0 0 480 240" width="480">
            <Platform x={72} y={148} tiles={4} />
            <Platform x={290} y={126} tiles={5} />

            {/* Gemmes */}
            <g transform="translate(196 104)"><Sprite rows={GEM} colors={{ c: '#6EE7F9', w: '#FFFFFF' }} className="ar-gem" /></g>
            <g transform="translate(400 150)"><Sprite rows={GEM} colors={{ c: '#FF8AE0', w: '#FFFFFF' }} className="ar-gem ar-gem--b" /></g>

            {/* Le coffre, sur la plateforme de gauche */}
            <g transform="translate(86 120)" data-tap="coffre" data-tap-ms="3000">
              <rect x="-6" y="-8" width="48" height="38" fill="transparent" />
              <rect className="ar-chest__glow" x="4" y="8" width="28" height="6" shapeRendering="crispEdges" />
              <g transform="translate(0 12)"><Sprite rows={CHEST_BOX} colors={CHEST} /></g>
              <Sprite rows={CHEST_LID} colors={CHEST} className="ar-chest__lid" />
              {LOOT.map((l, i) => (
                <g key={i} className="ar-loot" style={vars({ '--dx': l.dx, '--h': l.h, '--delay': l.delay })}>
                  <rect className="ar-loot__gem" x="14" y="2" width="8" height="8" fill={l.color} shapeRendering="crispEdges" />
                </g>
              ))}
              <text className="ar-bonus" x="18" y="-4" textAnchor="middle">+500</text>
            </g>

            {/* La gelée, sur la plateforme de droite */}
            <g transform="translate(300 106)">
              <g className="ar-slime"><Sprite rows={SLIME} colors={{ g: '#5CF2B0', k: '#170F2E' }} className="ar-slime__body" /></g>
            </g>

            {/* Le robot */}
            <g transform="translate(0 152)">
              <g className="ar-robot" data-tap="saut" data-tap-ms="2000">
                <rect x="-6" y="-8" width="48" height="56" fill="transparent" />
                <rect className="ar-dust ar-dust--l" x="6" y="40" width="4" height="4" shapeRendering="crispEdges" />
                <rect className="ar-dust ar-dust--r" x="26" y="40" width="4" height="4" shapeRendering="crispEdges" />
                <g className="ar-robot__jump">
                  <g className="ar-robot__spin">
                    <g className="ar-robot__face">
                      <Sprite rows={ROBOT_BODY} colors={ROBOT} />
                      <g transform="translate(0 36)">
                        <Sprite rows={ROBOT_LEGS_A} colors={ROBOT} className="ar-legs ar-legs--a" />
                        <Sprite rows={ROBOT_LEGS_B} colors={ROBOT} className="ar-legs ar-legs--b" />
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
