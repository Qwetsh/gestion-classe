import { scatter, vars } from '../shared';
import { Helix } from './Helix';
import './theme.css';

/**
 * Thème « ADN » : la double hélice au laboratoire.
 * Plans, du fond vers l'avant : fond clair, gel d'électrophorèse et chromosomes, double hélice,
 * lettres des bases (A, T, C, G) qui flottent, fondu vers la page.
 * Mouvement, sans que l'élève touche à rien : l'hélice tourne sur elle-même (dessinée sur un
 * canvas, voir `Helix.tsx`), les chromosomes se balancent, les bandes du gel avancent, les lettres
 * dérivent.
 * Au toucher : l'hélice (elle se copie : une seconde hélice s'en détache, puis s'éloigne), le grand
 * chromosome (ses deux chromatides se séparent puis se rejoignent).
 */

const LETTER_COLORS: Record<string, string> = { A: '#E4572E', T: '#B9820A', C: '#2E86AB', G: '#2A8F5B' };

const LETTERS = scatter(8, 47, (r, i) => {
  const letter = 'ATCG'.charAt(i % 4);
  const color = LETTER_COLORS[letter] ?? '#2E86AB';
  return {
    letter, color,
    x: `${(r() * 88 + 4).toFixed(1)}%`,
    y: `${Math.round(r() * 170 + 14)}px`,
    d: `${(r() * 8 + 11).toFixed(1)}s`,
    delay: `${(-r() * 16).toFixed(1)}s`,
    dx: `${Math.round(r() * 40 - 20)}px`,
    dy: `${Math.round(r() * 36 - 18)}px`,
    rot: `${Math.round(r() * 30 - 15)}deg`,
  };
});

function Chromosome({ className, x, y, s, tap }: { className?: string; x: number; y: number; s: number; tap?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} data-tap={tap ? 'chromatides' : undefined} data-tap-ms={tap ? 3400 : undefined}>
      {tap && <rect x="-24" y="-30" width="48" height="60" fill="transparent" />}
      <g className={`dn-chromo ${className ?? ''}`}>
        <g className="dn-chromatid dn-chromatid--a"><rect x="-5.500" y="-26" width="11" height="52" rx="5.500" /></g>
        <g className="dn-chromatid dn-chromatid--b"><rect x="-5.500" y="-26" width="11" height="52" rx="5.500" /></g>
        <circle className="dn-centromere" r="4.200" />
      </g>
    </g>
  );
}

export default function AdnScene() {
  return (
    <>
      <div className="el-layer dn-bg" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer dn-far" style={vars({ top: '0px', '--k': 0.42, '--kx': 4 })}>
        <div className="dn-set">
          <div className="dn-gel">
            {[0, 1, 2, 3, 4].map((lane) => <span key={lane} className="dn-lane" style={vars({ '--lane': lane })} />)}
          </div>
          <svg viewBox="0 0 480 240" width="480">
            <Chromosome x={84} y={62} s={1} tap />
            <Chromosome className="dn-chromo--b" x={136} y={176} s={0.62} />
            <Chromosome className="dn-chromo--c" x={262} y={36} s={0.5} />
          </svg>
        </div>
      </div>

      <div className="el-layer dn-main" style={vars({ top: '0px', '--k': 0.66, '--kx': 10 })}>
        <div className="dn-set">
          <Helix />
          <div className="dn-helixtap" data-tap="copie" data-tap-ms="5000" />
        </div>
      </div>

      <div className="el-layer dn-front" style={vars({ top: '0px', '--k': 1, '--kx': 16 })}>
        <div className="dn-fade" />
        <div className="el-stage">
          {LETTERS.map((l, i) => (
            <span key={i} className="dn-letter" style={vars({ left: l.x, top: l.y, color: l.color, '--d': l.d, '--delay': l.delay, '--dx': l.dx, '--dy': l.dy, '--rot': l.rot })}>{l.letter}</span>
          ))}
        </div>
      </div>
    </>
  );
}
