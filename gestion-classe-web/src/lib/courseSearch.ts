/**
 * Recherche de « Mes cours » (lot C2 de PLAN_mes_cours.md).
 *
 * - Dans les titres, les séquences et les niveaux : sur la liste déjà chargée, à chaque frappe.
 * - Dans le texte des cours rédigés : fonction `search_courses` de la base (migration 076), qui
 *   renvoie un extrait. Sans cette migration, la recherche se limite aux titres, sans erreur.
 *
 * Une recherche ignore la casse et les accents ; tous les mots demandés doivent être présents.
 */
import { supabase } from './supabase';
import type { Board } from './boardsQueries';

/** Un caractère replié : minuscule, sans accent (même règle que `gc_search_fold` côté base). */
function foldChar(ch: string): string {
  if (ch === '’') return "'";
  const base = ch.normalize('NFD')[0] ?? ch;
  return base.toLowerCase();
}

/** Texte replié pour la comparaison : « Séquence 2 » → « sequence 2 ». */
export function foldSearch(text: string): string {
  return Array.from(text, foldChar).join('');
}

/** Mots d'une demande, repliés, sans doublon. */
export function searchWords(query: string): string[] {
  return [...new Set(foldSearch(query).split(/\s+/).filter(Boolean))];
}

/** Cours dont le titre, la séquence ou le niveau contiennent tous les mots. */
export function filterBoards(boards: Board[], words: string[]): Board[] {
  if (words.length === 0) return boards;
  return boards.filter((b) => {
    const haystack = foldSearch(`${b.title} ${b.chapter ?? ''} ${b.level ?? ''}`);
    return words.every((w) => haystack.includes(w));
  });
}

export interface TextPart {
  text: string;
  /** Morceau qui correspond à un mot cherché. */
  hit: boolean;
}

/** Découpe un texte en morceaux trouvés / non trouvés, pour surligner les mots cherchés. */
export function highlightParts(text: string, words: string[]): TextPart[] {
  const chars = Array.from(text);
  const folded = chars.map(foldChar);
  const marked = new Array<boolean>(chars.length).fill(false);
  const haystack = folded.join('');
  // Chaque caractère replié tient en une unité : une position dans `haystack` est un indice de `chars`
  const aligned = haystack.length === chars.length;
  if (aligned) {
    for (const word of words) {
      if (!word) continue;
      let from = haystack.indexOf(word);
      while (from !== -1) {
        for (let i = from; i < from + word.length; i++) marked[i] = true;
        from = haystack.indexOf(word, from + word.length);
      }
    }
  }
  const parts: TextPart[] = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[i]) last.text += ch;
    else parts.push({ text: ch, hit: marked[i] });
  });
  return parts;
}

/**
 * Extrait présentable : espaces resserrés, et mots coupés aux deux bouts retirés quand cela ne fait
 * pas disparaître le mot trouvé (l'extrait de la base commence 50 caractères avant lui).
 */
export function tidyExcerpt(excerpt: string, words: string[]): string {
  const flat = excerpt.replace(/\s+/g, ' ').trim();
  const trimmed = flat.replace(/^\S*\s/, '').replace(/\s\S*$/, '');
  const stillFound = trimmed !== '' && highlightParts(trimmed, words).some((p) => p.hit);
  return stillFound ? `… ${trimmed} …` : flat;
}

export interface CourseTextHit {
  boardId: string;
  excerpt: string;
}

let searchUnavailable = false;

/** Vrai si la fonction de recherche manque en base (migration 076 non appliquée). */
export const courseTextSearchUnavailable = () => searchUnavailable;

/**
 * Cours rédigés dont le texte contient tous les mots (deux lettres au moins, règle de la base).
 * Fonction absente ou erreur : liste vide — la recherche dans les titres reste disponible.
 */
export async function searchCourseText(words: string[]): Promise<CourseTextHit[]> {
  const usable = words.filter((w) => w.length >= 2);
  if (searchUnavailable || usable.length === 0) return [];
  const { data, error } = await supabase.rpc('search_courses', { p_query: usable.join(' ') });
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883' || /search_courses/i.test(error.message ?? '');
    if (missing) {
      searchUnavailable = true;
      console.warn('[courseSearch] fonction « search_courses » absente : migration 076 à appliquer');
    } else {
      console.warn('[courseSearch] recherche dans le texte :', error.message);
    }
    return [];
  }
  return ((data ?? []) as { board_id: string; excerpt: string | null }[])
    .map((row) => ({ boardId: row.board_id, excerpt: tidyExcerpt(row.excerpt ?? '', usable) }));
}
