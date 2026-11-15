/**
 * Mes cours (page `/cours`) : rangement de la bibliothèque et adresse d'ouverture d'un cours.
 * Fonctions pures, sans accès à la base (voir PLAN_mes_cours.md, lot C1).
 */
import type { Board } from './boardsQueries';

/** Niveaux du collège dans l'ordre d'affichage (même liste que BOARD_LEVELS, sans dépendre de la base). */
const LEVEL_ORDER = ['6e', '5e', '4e', '3e', 'Autre'];
const UNRANKED = LEVEL_ORDER.length;

/** Tri « naturel » : « Activité 2 » avant « Activité 10 », sans tenir compte des accents ni de la casse. */
export const naturalCompare = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });

export interface LibrarySequence {
  /** Nom de la séquence (`boards.chapter`) ; chaîne vide = cours sans séquence. */
  chapter: string;
  boards: Board[];
}

export interface LibraryLevel {
  /** Niveau (`boards.level`) ; null = sans niveau. */
  level: string | null;
  count: number;
  sequences: LibrarySequence[];
}

/**
 * Niveau › séquence › activités. Niveaux dans l'ordre du collège, séquences et activités triées
 * par leur titre : l'ordre ne bouge pas quand on retouche un cours. Les cours sans séquence
 * viennent en dernier dans leur niveau, les cours sans niveau en dernier dans la liste.
 * `extraSequences` : séquences à montrer même sans cours (elles portent des fichiers).
 */
export function groupLibrary(boards: Board[], extraSequences: { level: string | null; chapter: string }[] = []): LibraryLevel[] {
  const byLevel = new Map<string | null, Map<string, Board[]>>();
  // Séquences sans cours mais avec des fichiers : elles gardent leur place, vides de cours
  for (const extra of extraSequences) {
    const sequences = byLevel.get(extra.level) ?? new Map<string, Board[]>();
    if (!sequences.has(extra.chapter)) sequences.set(extra.chapter, []);
    byLevel.set(extra.level, sequences);
  }
  for (const b of boards) {
    const level = b.level ?? null;
    const sequences = byLevel.get(level) ?? new Map<string, Board[]>();
    const chapter = b.chapter ?? '';
    sequences.set(chapter, [...(sequences.get(chapter) ?? []), b]);
    byLevel.set(level, sequences);
  }
  const rank = (level: string | null) => {
    if (level === null) return UNRANKED + 1;
    const i = LEVEL_ORDER.indexOf(level);
    return i === -1 ? UNRANKED : i;
  };
  return [...byLevel.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || naturalCompare(a[0] ?? '', b[0] ?? ''))
    .map(([level, sequences]) => ({
      level,
      count: [...sequences.values()].reduce((n, list) => n + list.length, 0),
      sequences: [...sequences.entries()]
        .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : naturalCompare(a[0], b[0])))
        .map(([chapter, list]) => ({ chapter, boards: [...list].sort((x, y) => naturalCompare(x.title, y.title)) })),
    }));
}

/** Les cours modifiés le plus récemment (module « Repris récemment » de l'accueil). */
export function recentBoards(boards: Board[], count = 3): Board[] {
  return [...boards].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, count);
}

/** Séquences déjà utilisées dans un niveau, pour les proposer à la saisie (évite les doublons de frappe). */
export function chaptersOfLevel(boards: Board[], level: string | null): string[] {
  const set = new Set<string>();
  for (const b of boards) if ((b.level ?? null) === level && b.chapter) set.add(b.chapter);
  return [...set].sort(naturalCompare);
}

// ---------------------------------------------------------------------------------------------
// Adresse d'ouverture : /cours?ouvrir=<id>&mode=texte|tableau|classe
// ---------------------------------------------------------------------------------------------

/** Texte : la feuille (ou le tableau blanc). Tableau : les pages projetées. Classe : la présentation, en essai. */
export type OpenMode = 'texte' | 'tableau' | 'classe';

/** Valeur de `ouvrir` pour l'ardoise libre gardée sur l'appareil. */
export const DRAFT_ID = 'brouillon';

export interface OpenTarget {
  id: string;
  mode: OpenMode;
}

/** Adresse qui ouvre un cours dans la page « Mes cours ». */
export function courseHref(id: string, mode: OpenMode = 'texte'): string {
  const params = new URLSearchParams({ ouvrir: id });
  if (mode !== 'texte') params.set('mode', mode);
  return `/cours?${params.toString()}`;
}

/** Cours demandé par l'adresse, ou null. Un mode inconnu vaut « texte ». */
export function parseOpenTarget(params: URLSearchParams): OpenTarget | null {
  const id = (params.get('ouvrir') ?? '').trim();
  if (!id) return null;
  const mode = params.get('mode');
  return { id, mode: mode === 'tableau' || mode === 'classe' ? mode : 'texte' };
}
