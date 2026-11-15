/**
 * Mes TP (page `/tp-templates`) : rangement niveau › séquence › TP, comme « Mes cours », et
 * recherche. Fonctions pures, sans accès à la base (migration 079).
 */
import { naturalCompare } from './courseLibrary';
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
        .map(([chapter, list]) => ({ chapter, items: [...list].sort((x, y) => naturalCompare(x.name, y.name)) })),
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
