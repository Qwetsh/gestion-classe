/**
 * Classeur virtuel : lecture des écrans « Bilan » des activités (Thomas, 22/11/2026 : le bilan vit
 * sur l'écran qui termine l'activité, plus sur une feuille de bilans).
 *
 * Les écrans d'un cours sont des pages de tableau blanc (`board_pages` du cours), dans l'ordre de
 * `doc.screens`. Deux lectures pour tout le classeur : la liste des écrans de chaque cours, puis
 * les seuls écrans qui portent un texte rouge (le bilan en a toujours un), sans les autres.
 */
import { supabase } from './supabase';
import type { BinderScreenSource } from './binder';
import { screenSummary, type SummaryRuns } from './binderSummary';

/** Texte rouge des bilans, tel que l'écrit le gabarit `bilan` de gc_ecrans.py. */
const RED_TEXT = JSON.stringify([{ type: 'text', color: '#C00000' }]);

/**
 * Bilans lus dans les écrans, par séquence puis par activité. Pour chaque activité, le premier de
 * ses cours (la correction, puis la fiche) qui a un écran Bilan le donne. Une lecture qui échoue
 * ne rend rien : le classeur se rabat sur la feuille de bilans.
 */
export async function loadScreenSummaries(sources: BinderScreenSource[]): Promise<Map<string, SummaryRuns>> {
  const out = new Map<string, SummaryRuns>();
  const ids = [...new Set(sources.flatMap((s) => s.boards.map((b) => b.id)))];
  if (ids.length === 0) return out;

  const { data: docs, error } = await supabase.from('boards').select('id, screens:doc->screens').in('id', ids);
  if (error || !docs) return out;
  const order = new Map<string, string[]>();
  for (const row of docs as { id: string; screens: unknown }[]) {
    const list = Array.isArray(row.screens) ? row.screens.filter((s): s is string => typeof s === 'string' && s !== '') : [];
    if (list.length > 0) order.set(row.id, list);
  }
  if (order.size === 0) return out;

  const { data: rows, error: pagesError } = await supabase
    .from('board_pages')
    .select('board_id, page_id, objects')
    .in('board_id', [...order.keys()])
    .in('page_id', [...new Set([...order.values()].flat())])
    .filter('objects', 'cs', RED_TEXT);
  if (pagesError || !rows) return out;
  const pages = new Map<string, { objects?: unknown }>();
  for (const r of rows as { board_id: string; page_id: string; objects: unknown }[]) pages.set(`${r.board_id}|${r.page_id}`, r);

  for (const source of sources) {
    for (const board of source.boards) {
      const screens = (order.get(board.id) ?? []).flatMap((id) => pages.get(`${board.id}|${id}`) ?? []);
      const paragraphs = screenSummary(screens);
      if (paragraphs.length === 0) continue;
      const bilans = out.get(source.chapter) ?? new Map();
      bilans.set(source.key, { heading: source.title, paragraphs });
      out.set(source.chapter, bilans);
      break;
    }
  }
  return out;
}
