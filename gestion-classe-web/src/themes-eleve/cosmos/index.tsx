import { scatter, vars } from '../shared';
import { Globe } from './Globe';
import './theme.css';

/**
 * Thème « Cosmos » : l'espace, vu d'un hublot.
 * Plans, du fond vers l'avant : nébuleuses, trois champs d'étoiles, une grande planète à anneaux
 * et sa lune, une petite planète lointaine.
 * Mouvement, sans que l'élève touche à rien : la planète tourne sur elle-même (une vraie sphère,
 * voir Globe.tsx), la lune décrit son orbite en passant devant puis derrière, les trois champs
 * d'étoiles dérivent à des vitesses différentes (la profondeur vient de là), les étoiles proches
 * scintillent, une comète traverse le ciel de temps en temps.
 * Au toucher (sur la planète) : une onde part de la planète et une pluie d'étoiles filantes
 * traverse l'écran.
 */

interface Star { left: string; top: string; s: string; o: string; d: string; delay: string; tint: number }

const field = (count: number, seed: number, min: number, max: number): Star[] =>
  scatter(count, seed, (r) => ({
    left: `${(r() * 100).toFixed(2)}%`,
    top: `${(r() * 100).toFixed(2)}%`,
    s: `${(r() * (max - min) + min).toFixed(1)}px`,
    o: (r() * 0.45 + 0.4).toFixed(2),
    d: `${(r() * 4 + 2.5).toFixed(1)}s`,
    delay: `${(-r() * 6).toFixed(1)}s`,
    tint: Math.floor(r() * 5),
  }));

const FAR = field(54, 5, 0.8, 1.5);
const MID = field(30, 17, 1.3, 2.2);
const NEAR = field(14, 29, 2.2, 3.4);

/** La pluie d'étoiles filantes du toucher : départs étalés en haut et à droite de l'écran. */
const METEORS = scatter(11, 61, (r, i) => ({
  x: `${Math.round(r() * 90 + 30)}%`,
  y: `${Math.round(r() * 300 - 40)}px`,
  w: `${Math.round(r() * 80 + 70)}px`,
  d: `${(r() * 0.5 + 0.75).toFixed(2)}s`,
  delay: `${(i * 0.22 + r() * 0.15).toFixed(2)}s`,
}));

/** Un champ d'étoiles répété deux fois côte à côte : il peut dériver sans raccord visible. */
function StarField({ stars, className }: { stars: Star[]; className: string }) {
  return (
    <div className={`co-drift ${className}`}>
      {[0, 1].map((set) => (
        <div key={set} className="co-set">
          {stars.map((s, i) => (
            <span
              key={i}
              className={`co-star co-star--${s.tint}`}
              style={vars({ left: s.left, top: s.top, '--s': s.s, '--o': s.o, '--d': s.d, '--delay': s.delay })}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Ring({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 240 70" className={`co-ring ${className}`}>
      <ellipse cx="120" cy="35" rx="112" ry="25" fill="none" stroke="#C9C0FF" strokeOpacity="0.6" strokeWidth="6" />
      <ellipse cx="120" cy="35" rx="101" ry="21" fill="none" stroke="#8EA2FF" strokeOpacity="0.45" strokeWidth="2.4" />
      <ellipse cx="120" cy="35" rx="93" ry="18.500" fill="none" stroke="#E9E4FF" strokeOpacity="0.3" strokeWidth="1.2" />
    </svg>
  );
}

export default function CosmosScene() {
  return (
    <>
      <div className="el-layer co-nebula" style={vars({ top: '0px', '--k': 0.02, '--kx': 2 })}>
        <span className="co-cloud co-cloud--violet" />
        <span className="co-cloud co-cloud--blue" />
        <span className="co-cloud co-cloud--rose" />
      </div>

      <div className="el-layer co-stars" style={vars({ top: '0px', '--k': 0.02, '--kx': 3 })}><StarField stars={FAR} className="co-drift--far" /></div>
      <div className="el-layer co-stars" style={vars({ top: '0px', '--k': 0.05, '--kx': 7 })}><StarField stars={MID} className="co-drift--mid" /></div>
      <div className="el-layer co-stars" style={vars({ top: '0px', '--k': 0.09, '--kx': 12 })}><StarField stars={NEAR} className="co-drift--near" /></div>

      <div className="co-comets">
        <span className="co-comet co-comet--a" />
        <span className="co-comet co-comet--b" />
        <span className="co-comet co-comet--c" />
        {METEORS.map((m, i) => (
          <span key={i} className="co-comet co-meteor" style={vars({ left: m.x, top: m.y, width: m.w, '--d': m.d, '--delay': m.delay })} />
        ))}
      </div>

      <div className="el-layer co-far" style={vars({ top: '0px', '--k': 0.12, '--kx': 10 })}>
        <div className="el-stage">
          <div className="co-small"><span className="co-small__shade" /></div>
        </div>
      </div>

      <div className="el-layer co-main" style={vars({ top: '0px', '--k': 0.3, '--kx': 17 })}>
        <div className="el-stage">
          <div className="co-planet" data-tap="pluie" data-tap-ms="3800">
            <span className="co-halo" />
            <span className="co-wave" />
            <span className="co-wave co-wave--late" />
            <Ring className="co-ring--back" />
            <div className="co-globe">
              <Globe />
              <div className="co-shade" />
            </div>
            <Ring className="co-ring--front" />
            <div className="co-orbit"><div className="co-moonx"><div className="co-moon" /></div></div>
          </div>
        </div>
      </div>
    </>
  );
}
