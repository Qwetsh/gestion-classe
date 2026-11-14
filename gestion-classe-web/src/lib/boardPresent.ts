/**
 * Présentation « En classe » d'un tableau préparé.
 *
 * Un tableau a deux temps, comme une présentation Genially : on le prépare (mode Tableau de
 * l'éditeur de cours, « Mes tableaux »), puis on le montre à la classe. En classe, ce qui a été
 * préparé ne doit pas bouger sous le stylet ou le doigt : au moment où les pages sont copiées
 * pour la classe (séance ou essai), leurs objets sont verrouillés.
 *
 * Le verrou est celui de l'application (`locked`) : l'objet ne se déplace plus, ne se supprime
 * plus, ne se modifie plus, mais il reste jouable — rideau, texte à trous, bouton d'action. Le
 * professeur peut toujours en déverrouiller un (Accueil › Disposition › Verrouiller). Ce qui est
 * ajouté pendant la séance n'est pas verrouillé.
 */
import type { BoardPage } from './boardRender';

/** Copie des pages où chaque objet préparé est verrouillé. Les traits ne sont pas concernés. */
export function lockPreparedPages(pages: BoardPage[]): BoardPage[] {
  return pages.map((p) => {
    if (!p.objects || p.objects.length === 0) return p;
    return { ...p, objects: p.objects.map((o) => (o.locked ? o : { ...o, locked: true })) };
  });
}
