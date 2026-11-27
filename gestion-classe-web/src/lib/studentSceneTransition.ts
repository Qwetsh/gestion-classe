import { flushSync } from 'react-dom';
import { STUDENT_THEMES, type StudentThemeId } from './studentThemes';

/**
 * Changement d'onglet dans un thème illustré de l'espace élève : la nouvelle page arrive par une
 * transition dans l'esprit du thème (saut dans les étoiles, coulée de lave, rafale de pétales…).
 *
 * Deux choses se jouent ensemble :
 *  - l'ancienne page laisse la place à la nouvelle par une « transition de vue » du navigateur,
 *    réglée par thème en CSS (`html[data-el-nav='<thème>']::view-transition-*`, dans le `theme.css`
 *    du thème) ; un navigateur qui ne connaît pas ces transitions change de page d'un coup ;
 *  - un calque posé devant le contenu (`.el-front`, rendu par StudentDecor) joue l'effet du thème,
 *    le temps que porte son attribut `data-on`.
 * Rien de tout cela dans un thème sans décor, ni si l'appareil demande de réduire les animations.
 */

const FRONT_MS = 1200;
let frontTimer = 0;

export function sceneTransition(theme: StudentThemeId, update: () => void): void {
  const illustrated = STUDENT_THEMES.some((t) => t.id === theme && t.scene);
  const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!illustrated || still) {
    update();
    return;
  }

  // L'effet de devant part au même instant que la transition de vue (quand celle-ci est prête),
  // pas à l'appui : les deux ont la même durée et la même courbe, ils restent donc calés l'un sur
  // l'autre du début à la fin.
  const play = () => {
    const front = document.querySelector<HTMLElement>('.el-front');
    if (!front) return;
    front.removeAttribute('data-on');
    void front.offsetWidth; // relance l'effet s'il jouait encore
    front.setAttribute('data-on', '');
    window.clearTimeout(frontTimer);
    frontTimer = window.setTimeout(() => front.removeAttribute('data-on'), FRONT_MS);
  };

  if (typeof document.startViewTransition !== 'function') {
    update();
    play();
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-el-nav', theme);
  const done = () => { if (root.getAttribute('data-el-nav') === theme) root.removeAttribute('data-el-nav'); };
  const transition = document.startViewTransition(() => { flushSync(update); });
  transition.ready.then(play, play);
  transition.finished.then(done, done);
}
