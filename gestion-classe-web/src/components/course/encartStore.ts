/**
 * Pages des encarts d'un cours (une page de `board_pages` par encart, rattachée au tableau du
 * cours), gardées en mémoire pour dessiner les aperçus sans relire la base à chaque rendu.
 * Rechargées quand on revient de l'édition d'un encart.
 */
import { fetchBoardPages } from '../../lib/boardQueries';
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
