/**
 * Classeur virtuel : le classeur d'un niveau, lu dans la bibliothèque du professeur. Sert à la page
 * `/classeur` et à la grille d'ouverture aux classes de « Mes cours » : les deux écrivent les mêmes
 * lignes, à partir des mêmes éléments (lib/binderRelease.ts).
 *
 * Les bilans (écran « Bilan » de chaque activité, à défaut la feuille de bilans corrigée) sont lus
 * avec la bibliothèque : `texts` reste null tant qu'ils ne sont pas là. `textsFailed` : une lecture
 * a échoué, ce qui n'est pas « pas de bilan » ; on ne règle alors aucune correction.
 */
import { useEffect, useMemo, useState } from 'react';
import { listBoards, type Board } from '../../lib/boardsQueries';
import { binderLevels, binderScreenSources, binderSummarySources, buildBinder, type BinderPage } from '../../lib/binder';
import { binderItems, type BinderItem } from '../../lib/binderRelease';
import { loadScreenSummaries } from '../../lib/binderScreens';
import { mergeSummaries, summaryRuns, type SummaryRuns } from '../../lib/binderSummary';
import { loadSheetDoc } from './binderSheet';

export interface BinderLibrary {
  /** Bibliothèque du professeur (null : lecture en cours). */
  boards: Board[] | null;
  error: string | null;
  /** Niveaux qui ont un classeur, et celui qui est montré. */
  levels: string[];
  level: string | null;
  /** Pages du classeur complet, sans ses bilans. */
  basePages: BinderPage[];
  /** Bilans par séquence puis par activité (null : lecture en cours). */
  texts: Map<string, SummaryRuns> | null;
  textsFailed: boolean;
  /** Ce qui peut s'ouvrir à une classe (vide tant que les bilans ne sont pas lus). */
  items: BinderItem[];
}

export function useBinderLibrary(userId: string, wantedLevel: string | null): BinderLibrary {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listBoards(userId)
      .then((list) => { if (!cancelled) setBoards(list); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Bibliothèque illisible'); });
    return () => { cancelled = true; };
  }, [userId]);

  const levels = useMemo(() => (boards ? binderLevels(boards) : []), [boards]);
  const level = wantedLevel && levels.includes(wantedLevel) ? wantedLevel : levels[0] ?? null;
  const basePages = useMemo(() => (boards && level ? buildBinder(boards, level) : []), [boards, level]);

  /** Bilans lus pour un classeur donné ; ils ne valent que pour lui. */
  const [read, setRead] = useState<{ pages: BinderPage[]; texts: Map<string, SummaryRuns>; failed: boolean } | null>(null);
  useEffect(() => {
    if (basePages.length === 0) return;
    let cancelled = false;
    // L'écran Bilan prime ; la feuille de bilans corrigée (plus une page) sert aux activités sans écran
    const sources = boards && level ? binderSummarySources(boards, level) : [];
    const screenSources = boards && level ? binderScreenSources(boards, level) : [];
    // Une lecture ratée n'est pas « pas de bilan » : on le retient, pour ne rien proposer de faux
    let failed = false;
    const lost = <T,>(fallback: T) => () => { failed = true; return fallback; };
    Promise.all([
      Promise.all(sources.map(({ chapter, board }) => loadSheetDoc(board).then((d) => [chapter, d ? summaryRuns(d.content) : new Map()] as const, lost([chapter, new Map()] as const)))),
      loadScreenSummaries(screenSources).catch(lost(new Map<string, SummaryRuns>())),
    ]).then(([lists, screens]) => {
      if (cancelled) return;
      const sheets = new Map<string, SummaryRuns>(lists);
      const texts = new Map<string, SummaryRuns>();
      for (const chapter of new Set([...sheets.keys(), ...screens.keys()])) {
        texts.set(chapter, mergeSummaries(screens.get(chapter) ?? new Map(), sheets.get(chapter)));
      }
      setRead({ pages: basePages, texts, failed });
    });
    return () => { cancelled = true; };
  }, [basePages, boards, level]);

  const texts = read?.pages === basePages ? read.texts : null;
  const textsFailed = read?.pages === basePages && read.failed;
  const items = useMemo(() => (texts ? binderItems(basePages, texts) : []), [basePages, texts]);

  return { boards, error, levels, level, basePages, texts, textsFailed, items };
}
