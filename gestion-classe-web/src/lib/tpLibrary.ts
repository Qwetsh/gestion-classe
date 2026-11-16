/**
 * Mes TP (page `/tp-templates`) : rangement niveau › séquence › TP, comme « Mes cours », et
 * recherche. Fonctions pures, sans accès à la base (migration 079).
 */
import { naturalCompare, splitVariant } from './courseLibrary';
import { classLevel } from './classColors';

/** Niveaux du collège dans l'ordre d'affichage (mêmes valeurs que `boards.level`). */
export const TP_LEVELS = ['6e', '5e', '4e', '3e', 'Autre'] as const;

/** Les trois thèmes du programme du cycle 4 (BO du 30/07/2020), proposés à la saisie. */
export const PROGRAMME_THEMES = [
  'La planète Terre, l\'environnement et l\'action humaine',
  'Le vivant et son évolution',
  'Le corps humain et la santé',
] as const;

/** Nom court d'un thème, pour les filtres : le thème du programme s'il est reconnu, sinon tel quel. */
export function themeShortName(theme: string): string {
  const t = fold(theme);
  if (t.includes('planete') || t.includes('terre')) return 'Planète Terre';
  if (t.includes('vivant') || t.includes('evolution')) return 'Le vivant';
  if (t.includes('corps') || t.includes('sante')) return 'Corps humain et santé';
  return theme;
}

/** Ce qu'il faut d'un TP pour le ranger et le chercher. */
export interface TpShelfItem {
  name: string;
  level: string | null;
  chapter: string | null;
  /** Numéro de l'activité qui fait faire le TP (« 3 », « 3a », « bonus »). */
  activity?: string | null;
  theme: string | null;
  problem?: string | null;
  materials?: string[];
}

export interface TpSequence<T> {
  /** Nom de la séquence ; chaîne vide = TP sans séquence. */
  chapter: string;
  items: T[];
}

export interface TpLevel<T> {
  /** Niveau ; null = sans niveau. */
  level: string | null;
  count: number;
  sequences: TpSequence<T>[];
}

const rank = (level: string | null) => {
  if (level === null) return TP_LEVELS.length + 1;
  const i = (TP_LEVELS as readonly string[]).indexOf(level);
  return i === -1 ? TP_LEVELS.length : i;
};

/** Dans une séquence : dans l'ordre des activités (sans activité en dernier), puis par nom. */
const byActivityThenName = (x: TpShelfItem, y: TpShelfItem): number => {
  if (!x.activity !== !y.activity) return x.activity ? -1 : 1;
  return naturalCompare(x.activity ?? '', y.activity ?? '') || naturalCompare(x.name, y.name);
};

/**
 * Niveau › séquence › TP. Niveaux dans l'ordre du collège, séquences et TP par ordre « naturel »
 * (« Séquence 2 » avant « Séquence 10 »). Sans séquence en dernier dans son niveau, sans niveau
 * en dernier dans la liste.
 */
export function groupTps<T extends TpShelfItem>(items: T[]): TpLevel<T>[] {
  const byLevel = new Map<string | null, Map<string, T[]>>();
  for (const item of items) {
    const level = item.level || null;
    const sequences = byLevel.get(level) ?? new Map<string, T[]>();
    const chapter = item.chapter ?? '';
    sequences.set(chapter, [...(sequences.get(chapter) ?? []), item]);
    byLevel.set(level, sequences);
  }
  return [...byLevel.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || naturalCompare(a[0] ?? '', b[0] ?? ''))
    .map(([level, sequences]) => ({
      level,
      count: [...sequences.values()].reduce((n, list) => n + list.length, 0),
      sequences: [...sequences.entries()]
        .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : naturalCompare(a[0], b[0])))
        .map(([chapter, list]) => ({ chapter, items: [...list].sort(byActivityThenName) })),
    }));
}

/** Séquences déjà utilisées dans un niveau, proposées à la saisie (évite les doublons de frappe). */
export function tpChaptersOfLevel(items: TpShelfItem[], level: string | null): string[] {
  const set = new Set<string>();
  for (const t of items) if ((t.level || null) === level && t.chapter) set.add(t.chapter);
  return [...set].sort(naturalCompare);
}

/** Minuscules sans accents. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Mots cherchés (au moins 2 caractères, ou un chiffre : « séquence 4 »), sans accents. */
export function tpSearchWords(query: string): string[] {
  return fold(query).split(/\s+/).filter((w) => w.length >= 2 || /^\d$/.test(w));
}

/** TP dont le nom, la séquence, le niveau, le thème, la problématique ou le matériel contient tous les mots. */
export function filterTps<T extends TpShelfItem>(items: T[], words: string[], theme: string | null = null): T[] {
  return items.filter((t) => {
    if (theme && themeShortName(t.theme ?? '') !== theme) return false;
    if (words.length === 0) return true;
    const hay = fold([t.name, t.chapter, t.level, t.theme, t.problem, ...(t.materials ?? [])].filter(Boolean).join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** Thèmes présents (noms courts), dans l'ordre du programme puis les autres. */
export function themesOf(items: TpShelfItem[]): string[] {
  const set = new Set<string>();
  for (const t of items) if (t.theme?.trim()) set.add(themeShortName(t.theme.trim()));
  const order = PROGRAMME_THEMES.map(themeShortName);
  return [...set].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || naturalCompare(a, b);
  });
}

/**
 * Modèles proposés au lancement d'une séance de groupe : ceux du niveau de la classe et ceux
 * sans niveau. Classe sans niveau reconnu, ou aucun modèle de son niveau : tous.
 */
export function templatesForClass<T extends { level?: string | null }>(templates: T[], className: string | null | undefined): T[] {
  const digit = classLevel(className);
  if (!digit) return templates;
  const mine = templates.filter((t) => !t.level || t.level === `${digit}e`);
  return mine.some((t) => t.level) ? mine : templates;
}

/** Total des points d'un barème, sans les erreurs d'arrondi des demi-points. */
export function totalPoints(criteria: { max_points: number }[]): number {
  return Math.round(criteria.reduce((n, c) => n + (Number(c.max_points) || 0), 0) * 100) / 100;
}

/** « 1,5 » plutôt que « 1.5 ». */
export function formatPoints(points: number): string {
  return String(points).replace('.', ',');
}

// ---------------------------------------------------------------------------------------------
// Lien TP ↔ activité de « Mes cours » (migration 081) : même niveau, même séquence, et le numéro
// du titre « Activité <n> — … ». C'est la règle de rangement de la bibliothèque, donc le lien tient
// quand une activité est réimportée.
// ---------------------------------------------------------------------------------------------

/** Ce qu'il faut d'un cours pour le relier : son titre et sa place dans la bibliothèque. */
export interface ActivityBoard {
  id: string;
  title: string;
  level: string | null;
  chapter: string | null;
}

/** Ce qu'il faut d'un TP pour le relier. */
export interface ActivityTp {
  level: string | null;
  chapter: string | null;
  activity?: string | null;
}

/** Numéro d'un titre « Activité 3 — … » (« 3 », « 3a », « bonus »), en minuscules ; null sinon. */
export function activityNumberOf(title: string): string | null {
  const m = title.trim().match(/^activit[ée]\s+(\d+[a-z]?|bonus)(?![\p{L}\d])/iu);
  return m ? m[1].toLowerCase() : null;
}

/** Séquence comparée sans tenir compte des apostrophes typographiques, espaces ni majuscules. */
const sequenceKey = (level: string | null, chapter: string | null) =>
  `${level ?? ''}|${(chapter ?? '').normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr')}`;

/**
 * Fiche de chaque activité de la bibliothèque, par séquence et numéro. Les corrections et documents
 * (« (correction) », « (documents) ») ne comptent pas ; à titre égal, le premier cours reçu gagne.
 */
export function activityIndex<B extends ActivityBoard>(boards: B[]): Map<string, B> {
  const index = new Map<string, B>();
  for (const b of boards) {
    if (!b.chapter || splitVariant(b.title).variant !== 'fiche') continue;
    const n = activityNumberOf(b.title);
    if (!n) continue;
    const key = `${sequenceKey(b.level, b.chapter)}|${n}`;
    if (!index.has(key)) index.set(key, b);
  }
  return index;
}

/**
 * Activité qui fait faire le TP, ou null. Un TP « 3a » se relie à « Activité 3a », à défaut à
 * « Activité 3 » (une activité en deux temps n'a souvent qu'une fiche).
 */
export function activityOfTp<B extends ActivityBoard>(tp: ActivityTp, index: Map<string, B>): B | null {
  const n = tp.activity?.trim().toLowerCase();
  if (!n || !tp.chapter) return null;
  const base = sequenceKey(tp.level, tp.chapter);
  const digits = n.match(/^\d+/)?.[0];
  return index.get(`${base}|${n}`) ?? (digits && digits !== n ? index.get(`${base}|${digits}`) : undefined) ?? null;
}

/** TP de chaque activité, rangés par identifiant de la fiche, dans l'ordre des noms. */
export function tpsByActivity<T extends ActivityTp & { name: string }, B extends ActivityBoard>(tps: T[], boards: B[]): Map<string, T[]> {
  const index = activityIndex(boards);
  const out = new Map<string, T[]>();
  for (const tp of [...tps].sort((a, b) => naturalCompare(a.name, b.name))) {
    const board = activityOfTp(tp, index);
    if (board) out.set(board.id, [...(out.get(board.id) ?? []), tp]);
  }
  return out;
}

/** Libellé court d'un numéro : « Activité 3 », « Activité bonus ». */
export const activityLabel = (n: string) => `Activité ${n}`;

/** Activités de la bibliothèque dans une séquence, dans l'ordre des numéros (choix du formulaire). */
export function activitiesOfSequence<B extends ActivityBoard>(boards: B[], level: string | null, chapter: string | null): { n: string; board: B }[] {
  if (!chapter?.trim()) return [];
  const prefix = `${sequenceKey(level, chapter)}|`;
  return [...activityIndex(boards).entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, board]) => ({ n: key.slice(prefix.length), board }))
    .sort((a, b) => naturalCompare(a.n, b.n));
}

/** Séquences de la bibliothèque dans un niveau (proposées à la saisie d'un TP, pour qu'il s'y relie). */
export function librarySequences(boards: ActivityBoard[], level: string | null): string[] {
  const set = new Set<string>();
  for (const b of boards) if ((b.level || null) === level && b.chapter) set.add(b.chapter);
  return [...set].sort(naturalCompare);
}
