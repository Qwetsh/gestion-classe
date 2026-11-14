/**
 * Pages des encarts d'un cours (une page de `board_pages` par encart, rattachée au tableau du
 * cours), gardées en mémoire pour dessiner les aperçus sans relire la base à chaque rendu.
 * Rechargées quand on revient de l'édition d'un encart.
 */
import { fetchBoardPages, upsertBoardPages } from '../../lib/boardQueries';
import type { BoardPage } from '../../lib/boardRender';

const pagesByBoard = new Map<string, Map<string, BoardPage>>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

/** Charge (une fois) les pages du tableau ; `force` relit la base. */
export function loadEncartPages(boardId: string, force = false): Promise<void> {
  if (!force && pagesByBoard.has(boardId)) return Promise.resolve();
  const pending = loading.get(boardId);
  if (pending && !force) return pending;
  const p = fetchBoardPages({ boardId })
    .then(({ pages }) => {
      pagesByBoard.set(boardId, new Map(pages.map((pg) => [pg.id, pg])));
      notify();
    })
    .catch((err) => { console.warn('[encarts] pages illisibles :', err); })
    .finally(() => { loading.delete(boardId); });
  loading.set(boardId, p);
  return p;
}

export function getEncartPage(boardId: string, pageId: string): BoardPage | undefined {
  return pagesByBoard.get(boardId)?.get(pageId);
}

/** Les pages ont-elles déjà été lues (sinon l'aperçu affiche « chargement »). */
export function encartPagesLoaded(boardId: string): boolean {
  return pagesByBoard.has(boardId);
}

export function subscribeEncarts(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function encartsVersion(): number {
  return version;
}

/**
 * Encart copié-collé : sa nouvelle page reçoit une copie du dessin de l'original, pour que
 * modifier l'une ne modifie plus l'autre. Page absente (encart encore vierge) : rien à copier.
 */
export async function duplicateEncartPage(boardId: string, userId: string, fromId: string, toId: string): Promise<void> {
  await loadEncartPages(boardId);
  let source = getEncartPage(boardId, fromId);
  if (!source) {
    await loadEncartPages(boardId, true);
    source = getEncartPage(boardId, fromId);
  }
  if (!source) return;
  const copy = { ...(JSON.parse(JSON.stringify(source)) as BoardPage), id: toId };
  await upsertBoardPages(userId, { boardId }, [{ page: copy, position: 9999 }]);
  pagesByBoard.get(boardId)?.set(toId, copy);
  notify();
}

/**
 * Versions d'encarts propres à une séance (lot 4e : ce qu'on a dessiné en classe, rangé dans la
 * séance) ou à un essai en mode test, affichées à la place de l'encart préparé. `scope` :
 * `s:<séance>` ou `t:<présentation>`.
 */
const overrides = new Map<string, Map<string, BoardPage>>();

export function getEncartOverride(scope: string, pageId: string): BoardPage | undefined {
  return overrides.get(scope)?.get(pageId);
}

export function setEncartOverrides(scope: string, pages: BoardPage[]): void {
  if (pages.length === 0) return;
  const map = overrides.get(scope) ?? new Map<string, BoardPage>();
  for (const pg of pages) map.set(pg.id, pg);
  overrides.set(scope, map);
  notify();
}

export function clearEncartOverrides(scope: string): void {
  if (overrides.delete(scope)) notify();
}
