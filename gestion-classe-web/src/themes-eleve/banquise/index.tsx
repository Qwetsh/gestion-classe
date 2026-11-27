import type { CSSProperties } from 'react';
import { scatter, vars } from '../shared';
import './theme.css';

/**
 * Thème « Banquise » : un matin clair au bord de la glace.
 * Plans, du fond vers l'avant : ciel, soleil bas et nuages, icebergs, mer, plaque de glace où
 * vivent trois manchots, flocons.
 * Mouvement, sans que l'élève touche à rien : les nuages passent, la mer ondule, une queue de
 * baleine sort de l'eau de temps en temps, un manchot se dandine d'un bord à l'autre, un autre bat
 * des ailerons, des flocons tombent.
 * Au toucher : un manchot (il se jette sur le ventre, glisse sur la glace, se relève et revient),
 * le grand iceberg (un bloc s'en détache et tombe à la mer : le vêlage).
 */

const FLAKES = scatter(16, 59, (r) => ({
  x: `${(r() * 104 - 2).toFixed(1)}%`,
  s: `${(r() * 4 + 3).toFixed(1)}px`,
  d: `${(r() * 8 + 9).toFixed(1)}s`,
  delay: `${(-r() * 17).toFixed(1)}s`,
  dx: `${Math.round(r() * 90 - 45)}px`,
}));

function Penguin({ style, className, chick, tap }: { style: CSSProperties; className?: string; chick?: boolean; tap?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 58"
      className={`bq-penguin ${className ?? ''}${chick ? ' bq-penguin--chick' : ''}`}
      style={style}
      data-tap={tap ? 'glissade' : undefined}
      data-tap-ms={tap ? 4600 : undefined}
    >
      <g className="bq-penguin__all">
        <path className="bq-feet" d="M11 54h9v3h-11ZM21 54h9l2 3h-11Z" />
        <path className="bq-flipper bq-flipper--left" d="M9 22C3 28 2 38 5 44C8 38 10 30 11 24Z" />
        <path className="bq-flipper bq-flipper--right" d="M31 22C37 28 38 38 35 44C32 38 30 30 29 24Z" />
        <path className="bq-coat" d="M20 2C28 2 32 9 31 17C35 26 35 42 30 52C26 56 14 56 10 52C5 42 5 26 9 17C8 9 12 2 20 2Z" />
        <path className="bq-belly" d="M20 20C27 20 30 30 29 42C28 50 24 53 20 53C16 53 12 50 11 42C10 30 13 20 20 20Z" />
        <path className="bq-cheek" d="M12 12C12 8 15 6 18 7C16 10 15 14 16 18C13 17 12 15 12 12ZM28 12C28 8 25 6 22 7C24 10 25 14 24 18C27 17 28 15 28 12Z" />
        <path className="bq-beak" d="M17 13L20 18L23 13Z" />
        <circle cx="15.500" cy="10.500" r="1.400" fill="#0F2A3D" /><circle cx="24.500" cy="10.500" r="1.400" fill="#0F2A3D" />
      </g>
    </svg>
  );
}

export default function BanquiseScene() {
  return (
    <>
      <div className="el-layer bq-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer bq-sunlayer" style={vars({ top: '0px', '--k': 0.33, '--kx': 2 })}>
        <div className="el-stage"><div className="bq-sun" /></div>
      </div>

      <div className="el-layer bq-clouds" style={vars({ top: '18px', '--k': 0.38, '--kx': 4 })}>
        <div className="bq-drift">
          {[0, 1].map((set) => (
            <div key={set} className="bq-cloudset">
              <span className="bq-cloud" style={{ left: '8%', top: 6, width: 86 }} />
              <span className="bq-cloud" style={{ left: '46%', top: 30, width: 62 }} />
              <span className="bq-cloud" style={{ left: '76%', top: 0, width: 104 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="el-layer bq-bergs" style={vars({ top: '56px', '--k': 0.46, '--kx': 5 })}>
        <div className="bq-set">
          <svg viewBox="0 0 480 110" width="480">
            <g data-tap="velage" data-tap-ms="3800">
              <path d="M40 110L62 48L96 22L122 6L150 34L176 30L206 110Z" fill="#FFFFFF" />
              <path d="M122 6L150 34L176 30L206 110H138L132 60Z" fill="#9CCAE6" />
              <path d="M96 22L122 6L132 60L104 74Z" fill="#CFE6F5" />
              <path d="M62 48L96 22L104 74L78 110H40Z" fill="#F2FAFF" />
              <g className="bq-chunk">
                <path d="M176 30L206 44L214 110H190L182 66Z" fill="#C6E1F2" />
                <path d="M206 44L226 70L230 110H214Z" fill="#86B9DA" />
              </g>
            </g>
            <path d="M306 110L322 60L350 40L372 58L398 52L428 110Z" fill="#F8FCFF" />
            <path d="M350 40L372 58L398 52L428 110H376L366 76Z" fill="#93C3E2" />
            <g className="bq-splash">
              <ellipse cx="212" cy="108" rx="10" ry="3" /><ellipse cx="212" cy="108" rx="10" ry="3" />
              <path d="M204 106C200 92 196 88 192 84M212 104C212 90 213 84 214 76M220 106C224 94 228 90 232 86" />
            </g>
          </svg>
        </div>
      </div>

      <div className="el-layer bq-sea" style={vars({ top: '150px', '--k': 0.56, '--kx': 7 })}>
        <div className="bq-waves" />
        <div className="bq-set">
          <div className="bq-tailbox">
            <svg viewBox="0 0 70 60" className="bq-tail">
              <path d="M35 60C33 44 31 34 35 24C25 22 12 12 4 2C18 4 30 10 35 18C40 10 52 4 66 2C58 12 45 22 35 24C39 34 37 44 35 60Z" />
            </svg>
          </div>
          <span className="bq-ripple" />
        </div>
      </div>

      <div className="el-layer bq-floe" style={vars({ top: '178px', '--k': 0.8, '--kx': 13 })}>
        <div className="bq-set">
          <Penguin style={{ left: 104, top: -36, width: 34 }} className="bq-penguin--flap" tap />
          <Penguin style={{ left: 140, top: -16, width: 20 }} chick tap />
          <Penguin style={{ left: 250, top: -32, width: 32 }} className="bq-penguin--walk" tap />
        </div>
      </div>

      <div className="bq-snow">
        {FLAKES.map((f, i) => (
          <span key={i} className="bq-flake" style={vars({ '--x': f.x, '--s': f.s, '--d': f.d, '--delay': f.delay, '--dx': f.dx })} />
        ))}
      </div>
    </>
  );
}
