import type { WheelEvent } from 'react';

/**
 * Défilement du ruban à la molette.
 *
 * Le ruban (éditeur de cours et tableau blanc) n'affiche pas de barre de défilement : elle prendrait
 * sur sa hauteur et couperait l'étiquette des groupes. Quand la fenêtre est trop étroite pour un
 * onglet, la molette le fait défiler de côté ; au doigt ou au pavé tactile, le geste est natif.
 */
export function scrollRibbon(e: WheelEvent<HTMLElement>) {
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  // Une liste ou un champ sous le curseur garde sa molette
  if ((e.target as HTMLElement).closest('select, input, textarea, .ce-menu')) return;
  el.scrollLeft += e.deltaY;
}
