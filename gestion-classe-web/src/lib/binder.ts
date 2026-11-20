/**
 * Classeur virtuel (PLAN_classeur_virtuel.md, lot 1) : le classeur d'un élève, assemblé à la volée
 * depuis la bibliothèque de « Mes cours ». Fonctions pures, sans accès à la base.
 *
 * Le classeur suit le mode d'emploi de Thomas : le mode d'emploi en page 1, puis trois
 * intercalaires, pas plus.
 * 1. Séquences : pour chaque séquence, sa page de garde, puis ses activités dans l'ordre (la fiche,
 *    puis la feuille de documents) ;
 * 2. Fiches méthodes : FM1 à FM9 ;
 * 3. Je révise : pour chaque séquence, la feuille de bilans et la fiche de mémorisation.
 *
 * Une page du classeur porte un seul document, imprimé en A5 et collé par le bord gauche : un
 * document de deux pages est une fiche A5 recto verso. Les documents du classeur sont reconnus par
 * leur titre (« Page de garde — … », « Feuille de bilans — … ») : il n'y a pas de rayon pour eux en
 * base. Les évaluations et les corrections n'y entrent pas (la correction viendra en écriture
 * d'élève au lot 2).
 */
import type { Board } from './boardsQueries';
import { groupActivities, isEvaluationTitle, isMethodSheet, naturalCompare, splitVariant } from './courseLibrary';

export type BinderSection = 'sequences' | 'methodes' | 'revise';

export const SECTION_LABEL: Record<BinderSection, string> = {
  sequences: 'Séquences',
  methodes: 'Fiches méthodes',
  revise: 'Je révise',
};

export const SECTION_ORDER: BinderSection[] = ['sequences', 'methodes', 'revise'];

/** Une page du classeur : un intercalaire, ou une feuille à grands carreaux portant une fiche collée. */
export type BinderPage =
  | { kind: 'divider'; key: string; section: BinderSection }
  | {
    kind: 'sheet';
    key: string;
    /** Partie du classeur ; null pour le mode d'emploi, avant le premier intercalaire. */
    section: BinderSection | null;
    /** Séquence de la page (`boards.chapter`), pour le sommaire. */
    chapter: string | null;
    /** Intitulé court du sommaire (« Activité 2 — documents », « Page de garde »). */
    label: string;
    board: Board;
  };

// ---------------------------------------------------------------------------------------------
// Les documents propres au classeur, reconnus par leur titre
// ---------------------------------------------------------------------------------------------

/** Rôle d'un document du classeur, lu au début de son titre. */
export type BinderDocKind = 'guide' | 'cover' | 'summaries' | 'memo';

const DOC_PREFIX: { kind: BinderDocKind; re: RegExp }[] = [
  { kind: 'guide', re: /^\s*mon classeur\b/iu },
  { kind: 'cover', re: /^\s*page de garde\b/iu },
  { kind: 'summaries', re: /^\s*feuilles? de bilans?\b/iu },
  { kind: 'memo', re: /^\s*fiches? de m[ée]morisation\b/iu },
];

/** Mode d'emploi, page de garde, feuille de bilans, fiche de mémorisation, ou null. */
export function binderDocKind(title: string): BinderDocKind | null {
  const t = title.normalize('NFC');
  return DOC_PREFIX.find((d) => d.re.test(t))?.kind ?? null;
}

/** Fiche d'activité : « Activité 3 — … », « Activité bonus — … ». */
const isActivityTitle = (title: string): boolean => /^\s*activit[ée]s?(?![\p{L}])/iu.test(title.normalize('NFC'));

/** Clé de comparaison d'un titre (apostrophes, espaces, casse). */
const titleKey = (title: string): string =>
  title.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');

/**
 * Un seul original par titre : un cours copié plusieurs fois garde un seul exemplaire dans le
 * classeur, le plus récemment modifié.
 */
function uniqueByTitle(boards: Board[]): Board[] {
  const kept = new Map<string, Board>();
  for (const b of boards) {
    const key = `${b.chapter ?? ''}|${titleKey(b.title)}`;
    const prev = kept.get(key);
    if (!prev || b.updated_at > prev.updated_at) kept.set(key, b);
  }
  return [...kept.values()];
}

/** Niveaux qui ont un classeur : au moins une page de garde de séquence. */
export function binderLevels(boards: Board[]): string[] {
  const set = new Set<string>();
  for (const b of boards) if (b.level && b.chapter && binderDocKind(b.title) === 'cover') set.add(b.level);
  const order = ['6e', '5e', '4e', '3e', 'Autre'];
  return [...set].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || naturalCompare(a, b));
}

/** Libellé court d'une activité dans le sommaire : « Activité 2 » plutôt que tout le titre. */
export function shortActivityLabel(title: string): string {
  const m = /^\s*(activit[ée]s?\s+[^\s—–:-]+)/iu.exec(title.normalize('NFC'));
  return m ? m[1].replace(/^a/, 'A') : title;
}

/**
 * Pages du classeur d'un niveau, dans l'ordre. Une séquence n'y entre que si elle a sa page de
 * garde : les séquences pas encore préparées pour le classeur restent dans « Mes cours » seulement.
 * Les fiches méthode (sans niveau) et le mode d'emploi (sans niveau de préférence) sont communs à
 * tous les classeurs.
 */
export function buildBinder(boards: Board[], level: string): BinderPage[] {
  const all = uniqueByTitle(boards);
  const pages: BinderPage[] = [];

  // Page 1 : le mode d'emploi (celui du niveau s'il existe, sinon le commun)
  const guides = all.filter((b) => binderDocKind(b.title) === 'guide' && !isMethodSheet(b));
  const guide = guides.find((b) => b.level === level) ?? guides.find((b) => !b.level);
  if (guide) pages.push({ kind: 'sheet', key: guide.id, section: null, chapter: null, label: 'Mode d’emploi', board: guide });

  // Séquences du niveau qui ont une page de garde
  const ofLevel = all.filter((b) => b.level === level && b.chapter && !isMethodSheet(b));
  const byChapter = new Map<string, Board[]>();
  for (const b of ofLevel) byChapter.set(b.chapter!, [...(byChapter.get(b.chapter!) ?? []), b]);
  const chapters = [...byChapter.keys()]
    .filter((ch) => byChapter.get(ch)!.some((b) => binderDocKind(b.title) === 'cover'))
    .sort(naturalCompare);
  const docOf = (chapter: string, kind: BinderDocKind) => byChapter.get(chapter)!
    .filter((b) => binderDocKind(b.title) === kind && splitVariant(b.title).variant === 'fiche')
    .sort((a, b) => naturalCompare(a.title, b.title))[0];

  pages.push({ kind: 'divider', key: 'divider:sequences', section: 'sequences' });
  for (const chapter of chapters) {
    const cover = docOf(chapter, 'cover');
    if (cover) pages.push({ kind: 'sheet', key: cover.id, section: 'sequences', chapter, label: 'Page de garde', board: cover });
    const activities = byChapter.get(chapter)!
      .filter((b) => isActivityTitle(b.title) && !isEvaluationTitle(b.title))
      .sort((a, b) => naturalCompare(a.title, b.title));
    for (const group of groupActivities(activities)) {
      const short = shortActivityLabel(group.title);
      for (const { variant, board } of group.members) {
        if (variant === 'correction') continue;
        pages.push({
          kind: 'sheet', key: board.id, section: 'sequences', chapter,
          label: variant === 'documents' ? `${short} — documents` : short, board,
        });
      }
    }
  }

  pages.push({ kind: 'divider', key: 'divider:methodes', section: 'methodes' });
  const methods = all.filter(isMethodSheet).sort((a, b) => naturalCompare(a.title, b.title));
  for (const b of methods) {
    const code = /^\s*(FM\s*\d+)/i.exec(b.title)?.[1].replace(/\s+/g, '') ?? b.title;
    pages.push({ kind: 'sheet', key: b.id, section: 'methodes', chapter: null, label: code, board: b });
  }

  pages.push({ kind: 'divider', key: 'divider:revise', section: 'revise' });
  for (const chapter of chapters) {
    const summaries = docOf(chapter, 'summaries');
    if (summaries) pages.push({ kind: 'sheet', key: summaries.id, section: 'revise', chapter, label: 'Feuille de bilans', board: summaries });
    const memo = docOf(chapter, 'memo');
    if (memo) pages.push({ kind: 'sheet', key: memo.id, section: 'revise', chapter, label: 'Fiche de mémorisation', board: memo });
  }
  return pages;
}

// ---------------------------------------------------------------------------------------------
// Feuilleter : double page comme un livre ouvert (la page 1 seule, à droite), ou page seule
// ---------------------------------------------------------------------------------------------

/** Pages visibles autour de la page `index` : [gauche, droite] (null = pas de page de ce côté). */
export function spreadOf(index: number, count: number, double: boolean): [number | null, number | null] {
  if (count === 0) return [null, null];
  const i = Math.max(0, Math.min(count - 1, index));
  if (!double) return [null, i];
  // Pages 0 | 1-2 | 3-4… : la page 0 est seule à droite ; une page impaire est à gauche
  const left = i % 2 === 1 ? i : i - 1;
  const right = left + 1;
  return [left >= 0 ? left : null, right < count ? right : null];
}

/** Première page de la vue suivante (ou précédente), bornée au classeur. */
export function turn(index: number, count: number, double: boolean, dir: 1 | -1): number {
  if (count === 0) return 0;
  if (!double) return Math.max(0, Math.min(count - 1, index + dir));
  const [left, right] = spreadOf(index, count, true);
  const first = left ?? right ?? 0;
  if (dir === 1) {
    const next = (right ?? first) + 1;
    return next < count ? next : first;
  }
  const prev = first - 1;
  return prev >= 0 ? spreadOf(prev, count, true)[0] ?? prev : first;
}

/** Partie du classeur où se trouve la page (celle du dernier intercalaire passé). */
export function sectionAt(pages: BinderPage[], index: number): BinderSection | null {
  for (let i = Math.min(index, pages.length - 1); i >= 0; i--) {
    const p = pages[i];
    if (p.kind === 'divider') return p.section;
    if (p.section) return p.section;
  }
  return null;
}

/** Index de l'intercalaire d'une partie. */
export const dividerIndex = (pages: BinderPage[], section: BinderSection): number =>
  pages.findIndex((p) => p.kind === 'divider' && p.section === section);

/** Sommaire : parties, puis séquences, puis pages. */
export interface BinderTocEntry {
  index: number;
  label: string;
  depth: 0 | 1 | 2;
}

export function binderToc(pages: BinderPage[]): BinderTocEntry[] {
  const toc: BinderTocEntry[] = [];
  let chapter: string | null = null;
  pages.forEach((p, index) => {
    if (p.kind === 'divider') {
      chapter = null;
      toc.push({ index, label: SECTION_LABEL[p.section], depth: 0 });
      return;
    }
    if (p.chapter && p.chapter !== chapter) {
      chapter = p.chapter;
      toc.push({ index, label: p.chapter, depth: 1 });
    }
    toc.push({ index, label: p.label, depth: p.chapter ? 2 : p.section ? 1 : 0 });
  });
  return toc;
}

/** Petit angle de collage (en degrés, entre -0,7 et 0,7), toujours le même pour une fiche. */
export function glueAngle(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return Math.round((((h >>> 0) % 1401) / 1000 - 0.7) * 100) / 100;
}
