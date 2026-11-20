/**
 * Tableau blanc improvisé depuis l'emploi du temps : choisir vite l'activité du cours.
 * Fonctions pures, sans accès à la base.
 *
 * Quand le tableau n'est pas préparé, on propose d'abord ce qui a le plus de chances d'être le bon :
 * la suite logique de ce que la classe a vu en dernier (ou la correction de l'activité qu'elle vient
 * de faire), puis les activités suivantes de la séquence. Le reste de la bibliothèque du niveau est
 * à un geste, rangé par séquence.
 */
import type { Board } from './boardsQueries';
import { binderDocKind } from './binder';
import { groupActivities, isMethodSheet, naturalCompare, splitVariant, type ActivityGroup, type CourseVariant } from './courseLibrary';

export interface PickableSequence {
  chapter: string;
  groups: ActivityGroup[];
}

/** Clé de comparaison d'un titre d'activité (apostrophes, espaces, casse). */
export const activityTitleKey = (title: string): string =>
  splitVariant(title).base.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');

/**
 * Activités de la bibliothèque d'un niveau, par séquence : les fiches d'activité et d'évaluation
 * (avec leurs documents et leur correction), pas les documents propres au classeur, ni les fiches
 * méthode, ni les cours sans séquence (`listBoards` écarte déjà les modèles et les tableaux posés sur
 * l'emploi du temps).
 */
export function pickableActivities(boards: Board[], level: string | null): PickableSequence[] {
  const bySequence = new Map<string, Board[]>();
  for (const b of boards) {
    if (!b.chapter || (level !== null && b.level !== level)) continue;
    if (isMethodSheet(b) || binderDocKind(b.title) !== null) continue;
    bySequence.set(b.chapter, [...(bySequence.get(b.chapter) ?? []), b]);
  }
  return [...bySequence.entries()]
    .sort((a, b) => naturalCompare(a[0], b[0]))
    .map(([chapter, list]) => ({
      chapter,
      groups: groupActivities([...list].sort((x, y) => naturalCompare(x.title, y.title)))
        // Une copie modèle seule n'est pas une activité à projeter
        .filter((g) => g.members.some((m) => m.variant !== 'copie')),
    }))
    .filter((s) => s.groups.length > 0);
}

/** Pourquoi une activité est proposée. */
export type SuggestionReason = 'correction' | 'suite' | 'apres' | 'debut';

export interface Suggestion {
  group: ActivityGroup;
  chapter: string;
  reason: SuggestionReason;
  /** « Correction de la dernière activité », « Suite de la séquence »… */
  label: string;
  /** Rôle à ouvrir en premier dans le panneau de l'activité. */
  open: CourseVariant;
}

export interface SuggestInput {
  sequences: PickableSequence[];
  /** Dernier tableau projeté avec cette classe (titre d'un tableau placé : peut porter « (correction) »). */
  last?: { title: string } | null;
  /** Combien d'activités proposer au plus. */
  max?: number;
}

/**
 * Les activités les plus probables pour ce cours, dans l'ordre. Rien n'est proposé deux fois.
 * Sans historique, on propose le début de chaque séquence du niveau.
 */
export function suggestActivities({ sequences, last, max = 4 }: SuggestInput): Suggestion[] {
  const flat = sequences.flatMap((s) => s.groups.map((group) => ({ chapter: s.chapter, group })));
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (entry: { chapter: string; group: ActivityGroup } | undefined, reason: SuggestionReason, label: string, open: CourseVariant = 'fiche') => {
    if (!entry || seen.has(entry.group.key) || out.length >= max) return;
    seen.add(entry.group.key);
    out.push({ group: entry.group, chapter: entry.chapter, reason, label, open });
  };

  const lastKey = last ? activityTitleKey(last.title) : null;
  const at = lastKey ? flat.findIndex((e) => activityTitleKey(e.group.title) === lastKey) : -1;
  if (at >= 0) {
    const done = flat[at];
    const lastVariant = last ? splitVariant(last.title).variant : 'fiche';
    // Une activité faite en dernier se corrige d'abord ; si la classe a déjà vu la correction, on passe à la suite
    if (lastVariant !== 'correction' && done.group.members.some((m) => m.variant === 'correction')) {
      add(done, 'correction', 'Correction de la dernière activité', 'correction');
    }
    add(flat[at + 1], 'suite', 'Suite de la séquence');
    for (let i = at + 2; i < flat.length; i++) add(flat[i], 'apres', 'Ensuite');
    return out;
  }
  // Pas d'historique : le début de chaque séquence
  for (const s of sequences) add(s.groups.length ? { chapter: s.chapter, group: s.groups[0] } : undefined, 'debut', 'Début de séquence');
  return out;
}

/** Filtre de la liste complète : tous les mots saisis doivent se trouver dans le titre ou la séquence. */
export function searchActivities(sequences: PickableSequence[], query: string): PickableSequence[] {
  const words = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr').split(/\s+/).filter(Boolean);
  if (words.length === 0) return sequences;
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');
  return sequences
    .map((s) => ({
      chapter: s.chapter,
      groups: s.groups.filter((g) => {
        const hay = `${plain(g.title)} ${plain(s.chapter)}`;
        return words.every((w) => hay.includes(w));
      }),
    }))
    .filter((s) => s.groups.length > 0);
}

/**
 * L'activité d'un tableau, d'après son titre (celui de l'activité) et sa séquence. Sans séquence
 * connue, le titre seul décide. Null si le tableau n'a pas été créé depuis une activité.
 */
export function findActivityGroup(sequences: PickableSequence[], title: string, chapter: string | null): { group: ActivityGroup; chapter: string } | null {
  const key = activityTitleKey(title);
  for (const s of sequences) {
    if (chapter && s.chapter !== chapter) continue;
    const group = s.groups.find((g) => activityTitleKey(g.title) === key);
    if (group) return { group, chapter: s.chapter };
  }
  return null;
}
