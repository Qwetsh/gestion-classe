import type { CopyOverview } from './copyStatus';
import type { AssessmentKind, AssessmentRow, GradeRow } from './evaluationQueries';
import { hasCopies, neverScanned } from './assessmentGroups';

/**
 * Ce que montre la grille du carnet (hub Évaluations, phase 1 — PLAN_hub_evaluations.md) :
 * filtres de colonnes, libellés d'en-tête, indicateur discret d'une cellule. Logique pure, testée.
 */

export type PublishedFilter = 'all' | 'yes' | 'no';

export interface CarnetFilters {
  kind: AssessmentKind | 'all';
  /** Une séquence, '' = évals sans séquence, 'all' = toutes. */
  sequence: string;
  published: PublishedFilter;
}

export const NO_FILTERS: CarnetFilters = { kind: 'all', sequence: 'all', published: 'all' };

export function isFiltered(f: CarnetFilters): boolean {
  return f.kind !== 'all' || f.sequence !== 'all' || f.published !== 'all';
}

/** Séquence d'une éval, nettoyée ('' = aucune). */
export function sequenceOf(a: Pick<AssessmentRow, 'sequence'>): string {
  return (a.sequence ?? '').trim();
}

export function filterAssessments<T extends Pick<AssessmentRow, 'kind' | 'sequence' | 'published_to_students'>>(
  list: T[],
  f: CarnetFilters,
): T[] {
  return list.filter((a) =>
    (f.kind === 'all' || a.kind === f.kind)
    && (f.sequence === 'all' || sequenceOf(a) === f.sequence)
    && (f.published === 'all' || (f.published === 'yes') === !!a.published_to_students));
}

/** Types présents, dans l'ordre du formulaire de création. */
export function kindsPresent(list: Pick<AssessmentRow, 'kind'>[]): AssessmentKind[] {
  const order: AssessmentKind[] = ['ecrit', 'dm', 'tp', 'groupe', 'oral', 'projet'];
  const seen = new Set(list.map((a) => a.kind));
  return order.filter((k) => seen.has(k));
}

/** Séquences présentes, « Séquence 2 » avant « Séquence 10 ». */
export function sequencesPresent(list: Pick<AssessmentRow, 'sequence'>[]): string[] {
  const set = new Set(list.map(sequenceOf).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }));
}

/** Une ou plusieurs évals n'ont pas de séquence (pour proposer « Sans séquence »). */
export function hasUnsequenced(list: Pick<AssessmentRow, 'sequence'>[]): boolean {
  return list.some((a) => !sequenceOf(a));
}

/** Le titre d'en-tête : le titre court s'il existe, sinon le nom. */
export function headerTitle(a: Pick<AssessmentRow, 'name' | 'short_name'>): string {
  return a.short_name?.trim() || a.name;
}

/** « 11/09 » : jour et mois d'une date ISO (AAAA-MM-JJ), '' sinon. */
export function shortDate(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}` : '';
}

/** Statuts qui dispensent de copie : rien ne manque pour ces élèves. */
const NO_COPY = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);

export type CellMark = 'draft' | 'to_grade' | 'missing_copy' | null;

/**
 * L'indicateur discret d'une cellule, un seul à la fois, du plus urgent au moins urgent :
 * - draft : note du Correcteur ou de Claude pas encore validée (invisible pour l'élève) ;
 * - to_grade : la copie est là, pas de note ;
 * - missing_copy : des copies ont été scannées pour cette éval, pas celle de cet élève.
 * Une éval jamais scannée (notes saisies à la main) ne marque aucune copie manquante.
 */
export function cellMark(
  a: Pick<AssessmentRow, 'kind'>,
  row: Pick<GradeRow, 'grade' | 'is_validated' | 'status'> | undefined,
  hasCopy: boolean,
  overview: Pick<CopyOverview, 'scanned' | 'transcribed'> | undefined,
): CellMark {
  if (row && row.grade != null && !row.is_validated) return 'draft';
  if (!hasCopies(a)) return null;
  if (row && NO_COPY.has(row.status)) return null;
  const graded = !!row && row.grade != null;
  if (hasCopy && !graded) return 'to_grade';
  if (!hasCopy && !graded && overview && !neverScanned(overview)) return 'missing_copy';
  return null;
}

export const CELL_MARK_LABEL: Record<Exclude<CellMark, null>, string> = {
  draft: 'brouillon à valider (invisible pour l’élève)',
  to_grade: 'copie à corriger',
  missing_copy: 'copie manquante',
};

/** Préférences d'affichage du carnet, gardées dans le navigateur. */
export interface CarnetPrefs {
  filters: CarnetFilters;
  showAverage: boolean;
}

export const DEFAULT_PREFS: CarnetPrefs = { filters: NO_FILTERS, showAverage: true };

/** Relit des préférences enregistrées en ignorant ce qui ne ressemble à rien de connu. */
export function parsePrefs(raw: string | null): CarnetPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<CarnetPrefs> & { filters?: Partial<CarnetFilters> };
    const f: Partial<CarnetFilters> = v.filters ?? {};
    const kinds: (AssessmentKind | 'all')[] = ['all', 'ecrit', 'dm', 'tp', 'groupe', 'oral', 'projet'];
    return {
      filters: {
        kind: kinds.includes(f.kind as AssessmentKind) ? (f.kind as AssessmentKind | 'all') : 'all',
        sequence: typeof f.sequence === 'string' ? f.sequence : 'all',
        published: f.published === 'yes' || f.published === 'no' ? f.published : 'all',
      },
      showAverage: v.showAverage !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}
