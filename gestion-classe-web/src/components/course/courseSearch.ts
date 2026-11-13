/**
 * Rechercher / remplacer dans un cours (AUDIT_editeur_texte.md, lot T7).
 *
 * Module maison plutôt que `prosemirror-search` : pas de deuxième exemplaire de
 * prosemirror-state / prosemirror-view à côté de celui de TipTap, et une recherche « à la
 * française » : sans tenir compte des accents ni des majuscules par défaut (« evaluation »
 * trouve « Évaluation »), avec deux cases pour être strict (casse, mot entier).
 *
 * Les résultats sont surlignés par des décorations (rien n'est écrit dans le document) ; le
 * résultat courant a sa propre couleur. La recherche se refait à chaque modification du texte.
 */
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchOptions {
  /** Respecter les majuscules (et les accents). */
  caseSensitive: boolean;
  /** Mot entier seulement. */
  wholeWord: boolean;
}

export interface SearchMatch { from: number; to: number }

interface SearchState {
  query: string;
  options: SearchOptions;
  matches: SearchMatch[];
  /** Indice du résultat courant (-1 : aucun). */
  current: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>('courseSearch');

const DEFAULT_OPTIONS: SearchOptions = { caseSensitive: false, wholeWord: false };

/** Un caractère sans accent ni majuscule ; un caractère qui changerait de longueur reste tel quel (positions alignées). */
function foldChar(c: string): string {
  const base = c.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  return base.length === 1 ? base : c;
}

/** Texte replié caractère par caractère : même longueur que l'original. */
export function foldText(s: string): string {
  let out = '';
  for (const c of s) out += c.length === 1 ? foldChar(c) : c;
  return out;
}

const WORD = /[\p{L}\p{N}_]/u;

/**
 * Positions des occurrences de `query` dans `text` (indices dans `text`). Fonction pure, testée
 * à part. `query` vide : aucune occurrence.
 */
export function findInText(text: string, query: string, options: SearchOptions = DEFAULT_OPTIONS): Array<[number, number]> {
  if (!query) return [];
  const hay = options.caseSensitive ? text : foldText(text);
  const needle = options.caseSensitive ? query : foldText(query);
  const out: Array<[number, number]> = [];
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const end = i + needle.length;
    const ok = !options.wholeWord || ((i === 0 || !WORD.test(text[i - 1])) && (end >= text.length || !WORD.test(text[end])));
    if (ok) out.push([i, end]);
    i = hay.indexOf(needle, ok ? end : i + 1);
  }
  return out;
}

/**
 * Occurrences dans le document : on cherche paragraphe par paragraphe (jamais à cheval sur deux
 * blocs) ; un élément en ligne qui n'est pas du texte (image, saut de ligne) coupe la recherche.
 */
export function findInDoc(doc: PMNode, query: string, options: SearchOptions): SearchMatch[] {
  if (!query) return [];
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const starts: number[] = [];
    node.forEach((child, offset) => {
      const at = pos + 1 + offset;
      if (child.isText) {
        for (let k = 0; k < child.text!.length; k++) starts.push(at + k);
        text += child.text;
      } else {
        starts.push(at);
        text += '\uFFFC';
      }
    });
    for (const [a, b] of findInText(text, query, options)) {
      matches.push({ from: starts[a], to: starts[b - 1] + 1 });
    }
    return false;
  });
  return matches;
}

function buildDecorations(doc: PMNode, matches: SearchMatch[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, matches.map((m, i) =>
    Decoration.inline(m.from, m.to, { class: i === current ? 'ce-find ce-find--current' : 'ce-find' })));
}

/** Résultat courant : le premier à partir de `pos` (le curseur), sinon le premier du document. */
function nearest(matches: SearchMatch[], pos: number): number {
  if (matches.length === 0) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
}

type SearchMeta =
  | { type: 'set'; query: string; options: SearchOptions }
  | { type: 'current'; index: number }
  | { type: 'clear' };

function compute(state: EditorState | { doc: PMNode; selection: { from: number } }, query: string, options: SearchOptions, current?: number): SearchState {
  const matches = findInDoc(state.doc, query, options);
  const idx = current !== undefined && current < matches.length ? current : nearest(matches, state.selection.from);
  return { query, options, matches, current: idx, decorations: buildDecorations(state.doc, matches, idx) };
}

const EMPTY: SearchState = { query: '', options: DEFAULT_OPTIONS, matches: [], current: -1, decorations: DecorationSet.empty };

export const CourseSearch = Extension.create({
  name: 'courseSearch',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => EMPTY,
          apply: (tr: Transaction, prev: SearchState, _old: EditorState, next: EditorState): SearchState => {
            const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
            if (meta?.type === 'clear') return EMPTY;
            if (meta?.type === 'set') return compute(next, meta.query, meta.options);
            if (meta?.type === 'current') {
              const current = prev.matches.length ? ((meta.index % prev.matches.length) + prev.matches.length) % prev.matches.length : -1;
              return { ...prev, current, decorations: buildDecorations(next.doc, prev.matches, current) };
            }
            if (tr.docChanged && prev.query) {
              // Le texte a changé : on recherche à nouveau, en gardant à peu près la même place
              const keep = prev.matches[prev.current];
              const pos = keep ? tr.mapping.map(keep.from) : next.selection.from;
              const res = compute(next, prev.query, prev.options);
              res.current = nearest(res.matches, pos);
              res.decorations = buildDecorations(next.doc, res.matches, res.current);
              return res;
            }
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

/**
 * Comme Word quand la casse est ignorée : le remplacement reprend la casse du mot trouvé
 * (« Cellule » → « Neurone », « CELLULE » → « NEURONE »), sinon il est gardé tel quel.
 */
export function adaptCase(found: string, replacement: string): string {
  if (!replacement) return replacement;
  const letters = found.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return replacement.toUpperCase();
  const first = [...found].find((c) => /\p{L}/u.test(c));
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    const [r0, ...rest] = [...replacement];
    return r0.toUpperCase() + rest.join('');
  }
  return replacement;
}

const replacementFor = (state: EditorState, s: SearchState, m: SearchMatch, replacement: string) =>
  s.options.caseSensitive ? replacement : adaptCase(state.doc.textBetween(m.from, m.to), replacement);

// ---- Commandes (appelées par la barre de recherche) ----

type View = { state: EditorState; dispatch: (tr: Transaction) => void };

export function getSearch(state: EditorState): SearchState {
  return searchKey.getState(state) ?? EMPTY;
}

export function setSearch(view: View, query: string, options: SearchOptions): void {
  view.dispatch(view.state.tr.setMeta(searchKey, { type: 'set', query, options } satisfies SearchMeta));
}

export function clearSearch(view: View): void {
  if (getSearch(view.state).query) view.dispatch(view.state.tr.setMeta(searchKey, { type: 'clear' } satisfies SearchMeta));
}

/** Passe au résultat suivant (+1) ou précédent (−1) ; renvoie le résultat devenu courant. */
export function stepSearch(view: View, dir: 1 | -1): SearchMatch | null {
  const s = getSearch(view.state);
  if (s.matches.length === 0) return null;
  const index = s.current === -1 ? 0 : s.current + dir;
  view.dispatch(view.state.tr.setMeta(searchKey, { type: 'current', index } satisfies SearchMeta));
  const after = getSearch(view.state);
  return after.matches[after.current] ?? null;
}

/** Remplace le résultat courant puis passe au suivant. */
export function replaceCurrent(view: View, replacement: string): SearchMatch | null {
  const s = getSearch(view.state);
  const m = s.matches[s.current];
  if (!m) return null;
  view.dispatch(view.state.tr.insertText(replacementFor(view.state, s, m, replacement), m.from, m.to).scrollIntoView());
  const after = getSearch(view.state);
  return after.matches[after.current] ?? null;
}

/** Remplace toutes les occurrences en une seule étape (un seul Ctrl+Z pour tout défaire). */
export function replaceAll(view: View, replacement: string): number {
  const s = getSearch(view.state);
  if (s.matches.length === 0) return 0;
  const tr = view.state.tr;
  for (let i = s.matches.length - 1; i >= 0; i--) {
    const m = s.matches[i];
    tr.insertText(replacementFor(view.state, s, m, replacement), m.from, m.to);
  }
  view.dispatch(tr);
  return s.matches.length;
}
