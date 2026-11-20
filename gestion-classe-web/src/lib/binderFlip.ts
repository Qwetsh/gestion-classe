/**
 * Classeur virtuel : le plan d'une page qui se tourne. Fonction pure.
 *
 * Une feuille emporte son contenu : elle pivote autour des anneaux, son recto est la page qu'on
 * quitte, son verso la page qu'on découvre de l'autre côté. Dessous, la nouvelle page de ce côté
 * est déjà là ; l'ancienne page de l'autre côté reste en place jusqu'à ce que la feuille la couvre.
 *
 * Seules les pages voisines se tournent : un saut (sommaire, onglet) change de vue sans feuille.
 */

export type FlipKind = 'next-double' | 'prev-double' | 'next-single' | 'prev-single';

export interface FlipPlan {
  kind: FlipKind;
  /** Page du recto de la feuille (celle qu'on quitte, ou celle qu'on revient poser en simple page). */
  front: number;
  /** Page du verso (celle qu'on découvre de l'autre côté), null : papier blanc. */
  back: number | null;
  /** Côté où l'ancienne page reste en place jusqu'à ce que la feuille la couvre, et cette page. */
  under: { side: 'left' | 'right'; page: number | null } | null;
}

type Spread = [number | null, number | null];

/**
 * Comment tourner de la vue `from` à la vue `to`, ou null si elles ne sont pas voisines.
 * `double` : classeur ouvert (deux pages) ; sinon une page à la fois (`index` → `target`).
 */
export function planFlip(from: Spread, to: Spread, dir: 1 | -1, double: boolean, index: number, target: number): FlipPlan | null {
  if (!double) {
    if (dir === 1 && target === index + 1) return { kind: 'next-single', front: index, back: null, under: null };
    if (dir === -1 && target === index - 1) return { kind: 'prev-single', front: target, back: null, under: { side: 'right', page: index } };
    return null;
  }
  const [oL, oR] = from;
  const [nL, nR] = to;
  if (dir === 1 && oR !== null && nL !== null && nL === oR + 1) {
    return { kind: 'next-double', front: oR, back: nL, under: { side: 'left', page: oL } };
  }
  if (dir === -1 && oL !== null && nR !== null && nR === oL - 1) {
    return { kind: 'prev-double', front: oL, back: nR, under: { side: 'right', page: oR } };
  }
  return null;
}
