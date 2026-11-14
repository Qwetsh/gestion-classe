/**
 * Recherche globale (Ctrl+K) : pages, cours, classes, élèves, évaluations, outils, réglages.
 * Lot R1 de PLAN_mes_cours.md. Ce fichier range et filtre ; la lecture en base est dans
 * `globalSearchQueries.ts`.
 *
 * Même règle que la recherche de « Mes cours » : sans casse ni accents, tous les mots demandés
 * doivent être présents.
 */
import { foldSearch, searchWords } from './courseSearch';
import type { NavGroup } from './appNav';
import { SETTINGS_SECTIONS, type SettingsSectionKey } from './settingsSections';

export type SearchKind = 'page' | 'course' | 'class' | 'student' | 'assessment' | 'tool' | 'setting';

/** Familles de résultats, dans l'ordre d'affichage. */
export const SEARCH_KINDS: { kind: SearchKind; label: string }[] = [
  { kind: 'page', label: 'Pages' },
  { kind: 'course', label: 'Cours' },
  { kind: 'class', label: 'Classes' },
  { kind: 'student', label: 'Élèves' },
  { kind: 'assessment', label: 'Évaluations' },
  { kind: 'tool', label: 'Outils' },
  { kind: 'setting', label: 'Réglages' },
];

export interface SearchItem {
  kind: SearchKind;
  /** Unique dans sa famille. */
  id: string;
  title: string;
  /** Précision affichée à droite (niveau, classe, date…) ; elle compte aussi pour la recherche. */
  hint?: string;
  /** Mots cherchables qui ne s'affichent pas. */
  keywords?: string;
  /** Adresse à ouvrir. */
  href?: string;
  /** Section des Réglages à ouvrir, à la place d'une adresse. */
  section?: SettingsSectionKey;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  items: SearchItem[];
}

/** Les pages du menu, telles que le professeur les voit (onglets masqués exclus). */
export function pageItems(groups: NavGroup[]): SearchItem[] {
  return groups.flatMap((group) => group.pages.map((page) => ({
    kind: 'page' as const,
    id: page.path,
    title: group.pages.length > 1 ? page.label : group.label,
    hint: group.pages.length > 1 ? group.label : undefined,
    href: page.path,
  })));
}

export function settingItems(): SearchItem[] {
  return SETTINGS_SECTIONS.map((s) => ({ kind: 'setting' as const, id: s.key, title: s.label, hint: 'Réglages', keywords: s.keywords, section: s.key }));
}

const byTitle = (a: SearchItem, b: SearchItem) => a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base' });

/**
 * Pertinence d'un résultat : le titre commence par un mot cherché (3), un mot du titre commence
 * par lui (2), le titre le contient (1), il n'est que dans la précision ou les mots-clés (0).
 * -1 : un mot manque, le résultat est écarté.
 */
function score(item: SearchItem, words: string[]): number {
  const title = foldSearch(item.title);
  const rest = foldSearch(`${item.hint ?? ''} ${item.keywords ?? ''}`);
  let best = 0;
  for (const word of words) {
    const at = title.indexOf(word);
    if (at === -1) {
      if (!rest.includes(word)) return -1;
      continue;
    }
    const rank = at === 0 ? 3 : /[\s'’\-–—·(]/.test(title[at - 1]) ? 2 : 1;
    best = Math.max(best, rank);
  }
  return best;
}

/**
 * Résultats rangés par famille, les plus pertinents d'abord, `perGroup` au plus par famille.
 * Sans rien de tapé : les pages seulement, dans l'ordre du menu (un sommaire pour aller vite).
 */
export function searchItems(items: SearchItem[], query: string, perGroup = 6): SearchGroup[] {
  const words = searchWords(query);
  if (words.length === 0) {
    const pages = items.filter((i) => i.kind === 'page');
    return pages.length > 0 ? [{ kind: 'page', label: 'Pages', items: pages }] : [];
  }
  const scored = items.flatMap((item) => { const s = score(item, words); return s >= 0 ? [{ item, s }] : []; });
  return SEARCH_KINDS.flatMap(({ kind, label }) => {
    const found = scored.filter((x) => x.item.kind === kind).sort((a, b) => b.s - a.s || byTitle(a.item, b.item)).slice(0, perGroup);
    return found.length > 0 ? [{ kind, label, items: found.map((x) => x.item) }] : [];
  });
}

/** Les résultats à plat, dans l'ordre affiché (navigation au clavier). */
export const flattenGroups = (groups: SearchGroup[]): SearchItem[] => groups.flatMap((g) => g.items);
