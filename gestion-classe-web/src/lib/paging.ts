/**
 * Lecture d'une requête page par page.
 *
 * PostgREST plafonne une réponse à 1 000 lignes. Sans ce parcours, une lecture de plus de 1 000
 * lignes est tronquée **sans aucune erreur** : le résultat a l'air complet, et il ne l'est pas.
 * C'est le mode de défaillance contre lequel le carnet de notes existe.
 */

const PAGE_SIZE = 1000;

export interface PageResult<T> { data: T[] | null; error: { message: string } | null }

/** Parcourt toutes les pages d'une requête ; `build` reçoit les bornes de la page à lire. */
export async function fetchAllPages<T>(
  build: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}
