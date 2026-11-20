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
      // Lignes affichées : une activité et sa correction comptent pour une
      count: [...sequences.values()].reduce((n, list) => n + groupActivities(list).length, 0),
      sequences: [...sequences.entries()]
        .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : naturalCompare(a[0], b[0])))
        .map(([chapter, list]) => ({ chapter, boards: [...list].sort((x, y) => naturalCompare(x.title, y.title)) })),
    }));
}

// ---------------------------------------------------------------------------------------------
// Rayons : bibliothèque des activités, fiches méthode (boards.category, migration 082)
// ---------------------------------------------------------------------------------------------

/** Fiche méthode : rangée dans l'onglet « Fiches méthode », pas dans la bibliothèque des activités. */
export const isMethodSheet = (b: Pick<Board, 'category'>): boolean => b.category === 'methode';

/** Les cours de la bibliothèque des activités d'un côté, les fiches méthode de l'autre (ordre gardé). */
export function splitShelves(boards: Board[]): { activities: Board[]; methods: Board[] } {
  const activities: Board[] = [];
  const methods: Board[] = [];
  for (const b of boards) (isMethodSheet(b) ? methods : activities).push(b);
  return { activities, methods };
}

// ---------------------------------------------------------------------------------------------
// Activité › correction › documents : rattachés par le titre, sans colonne en base
// ---------------------------------------------------------------------------------------------

/** Rôle d'un original dans son activité, lu à la fin de son titre. */
export type CourseVariant = 'fiche' | 'correction' | 'documents' | 'copie';

/**
 * Ordre de la séance : la fiche, ses documents, la copie modèle (les réponses d'un élève, écrites
 * dans la fiche par le classeur virtuel), puis la correction (toujours en dernier).
 */
export const VARIANT_ORDER: CourseVariant[] = ['fiche', 'documents', 'copie', 'correction'];

export const VARIANT_LABEL: Record<CourseVariant, string> = { fiche: 'Fiche', correction: 'Correction', documents: 'Documents', copie: 'Copie modèle' };

/** Intitulé du bouton d'un original : pour une évaluation, la fiche est le « Sujet ». */
export const variantLabel = (variant: CourseVariant, evaluation = false): string =>
  (evaluation && variant === 'fiche' ? 'Sujet' : VARIANT_LABEL[variant]);

/** « Évaluation — La Terre… », « Evaluation : … », « Évaluations … » (accent et casse indifférents). */
const EVALUATION_PREFIX = /^\s*[ée]valuations?(?![\p{L}\p{N}])\s*[—–:-]?\s*/iu;

export const isEvaluationTitle = (title: string): boolean => EVALUATION_PREFIX.test(title.normalize('NFC'));

/** Titre d'une évaluation sans son préfixe, quand une pastille « Évaluation » le précède. */
export function withoutEvaluationPrefix(title: string): string {
  const rest = title.normalize('NFC').replace(EVALUATION_PREFIX, '').trim();
  return rest || title;
}

/** « Activité 3 — Wegener (correction) » → correction de « Activité 3 — Wegener ». */
const VARIANT_SUFFIX = /\s*\((correction|corrig[ée]|documents?|copie mod[èe]le)\)\s*$/i;

export function splitVariant(title: string): { base: string; variant: CourseVariant } {
  const m = VARIANT_SUFFIX.exec(title);
  if (!m) return { base: title.trim(), variant: 'fiche' };
  const word = m[1].toLowerCase();
  return { base: title.slice(0, m.index).trim(), variant: word.startsWith('doc') ? 'documents' : word.startsWith('copie') ? 'copie' : 'correction' };
}

export interface ActivityGroup {
  /** Identifiant stable pour React : celui du premier original du groupe. */
  key: string;
  /** Titre de l'activité, sans « (correction) ». */
  title: string;
  /** Dans l'ordre fiche, documents, correction ; au plus un original par rôle. */
  members: { variant: CourseVariant; board: Board }[];
  /** Évaluation de la séquence (titre « Évaluation — … ») plutôt qu'activité. */
  evaluation: boolean;
}

/**
 * Rassemble, dans une séquence, la fiche d'une activité avec sa correction et ses documents
 * (même titre, suivi de « (correction) » ou « (documents) »). L'ordre des activités suit
 * celui de la liste reçue ; les évaluations viennent ensuite, dans leur ordre. Un original seul
 * (correction orpheline comprise) forme un groupe d'un membre ; un doublon de titre reste à part,
 * au lieu d'en cacher un.
 */
export function groupActivities(boards: Board[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  const byBase = new Map<string, ActivityGroup>();
  for (const board of boards) {
    const { base, variant } = splitVariant(board.title);
    // Même activité malgré une apostrophe typographique ou une espace en trop dans un des titres
    const key = base.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').toLocaleLowerCase('fr');
    const found = byBase.get(key);
    if (found && !found.members.some((m) => m.variant === variant)) {
      found.members.push({ variant, board });
      found.members.sort((a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant));
      continue;
    }
    const title = base || board.title;
    const group: ActivityGroup = { key: board.id, title, members: [{ variant, board }], evaluation: isEvaluationTitle(title) };
    groups.push(group);
    if (!found) byBase.set(key, group);
  }
  return [...groups.filter((g) => !g.evaluation), ...groups.filter((g) => g.evaluation)];
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
