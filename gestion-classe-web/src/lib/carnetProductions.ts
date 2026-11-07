import type { WorkStatus } from './productionsQueries';

/**
 * Productions numériques dans le carnet (onglet Évaluations).
 *
 * Depuis la phase 6 du hub, la page Productions n'est plus dans le menu : une activité n'apparaît
 * dans le carnet que si une éval lui est liée (activity_assessments), c'est-à-dire après « + Évaluation
 * → Production numérique » ou un envoi des notes. Des productions envoyées par les élèves restaient
 * donc invisibles tant que rien n'était corrigé. Ici : dès qu'un élève de la classe a envoyé une
 * production, sa colonne existe (colonne « en attente » si l'éval n'existe pas encore), et chaque
 * envoi pas encore corrigé s'affiche « À corriger ».
 */

/** Ce que le carnet lit d'une production. */
export interface ClassWorkLite {
  activity_id: string;
  student_id: string;
  status: WorkStatus;
  total_points: number | null;
  submitted_at: string | null;
}

/** Ce que le carnet lit d'une activité (la ligne complète sert à créer l'éval). */
export interface ProductionActivityLite {
  id: string;
  title: string;
  bareme_total: number;
  sequence: string | null;
}

/** Une activité pour la classe : productions par élève, et le compte de celles à corriger. */
export interface ProductionColumn<A extends ProductionActivityLite = ProductionActivityLite> {
  activity: A;
  /** Éval du carnet liée, ou null : la colonne est « en attente » (pas encore au carnet). */
  assessmentId: string | null;
  works: Map<string, ClassWorkLite>;
  toCorrect: number;
}

/** Une production envoyée et pas encore corrigée. */
export const isToCorrect = (w: Pick<ClassWorkLite, 'status'> | undefined | null): boolean => w?.status === 'submitted';

/** Une production arrivée jusqu'au prof (le brouillon reste chez l'élève). */
export const isSent = (w: Pick<ClassWorkLite, 'status'>): boolean => w.status !== 'draft';

/**
 * Colonnes de productions d'une classe. Seules comptent les activités dont au moins un élève de la
 * classe a envoyé une production. `links` : activité → éval liée (non supprimée) de cette classe.
 */
export function productionColumns<A extends ProductionActivityLite>(
  activities: readonly A[],
  works: readonly ClassWorkLite[],
  links: Readonly<Record<string, string>>,
): ProductionColumn<A>[] {
  const byActivity = new Map<string, Map<string, ClassWorkLite>>();
  for (const w of works) {
    if (!isSent(w)) continue;
    let m = byActivity.get(w.activity_id);
    if (!m) { m = new Map(); byActivity.set(w.activity_id, m); }
    const prev = m.get(w.student_id);
    // Une seule production par élève et par activité en principe ; sinon la plus récente.
    if (!prev || (w.submitted_at ?? '') > (prev.submitted_at ?? '')) m.set(w.student_id, w);
  }
  const out: ProductionColumn<A>[] = [];
  for (const activity of activities) {
    const m = byActivity.get(activity.id);
    if (!m || m.size === 0) continue;
    let toCorrect = 0;
    for (const w of m.values()) if (isToCorrect(w)) toCorrect++;
    out.push({ activity, assessmentId: links[activity.id] ?? null, works: m, toCorrect });
  }
  return out.sort((a, b) => a.activity.title.localeCompare(b.activity.title));
}

/**
 * La cellule d'une éval liée affiche-t-elle « À corriger » ? Oui si l'élève a envoyé une production
 * pas encore corrigée et que la cellule n'a ni note ni statut (absent, non rendu…) : une note saisie
 * à la main reste affichée.
 */
export function cellToCorrect(
  work: Pick<ClassWorkLite, 'status'> | undefined,
  row: { status: string; grade_raw: number | null } | undefined,
): boolean {
  if (!isToCorrect(work)) return false;
  if (!row) return true;
  return row.status === 'noted' && row.grade_raw == null;
}

/** Le premier élève à corriger, dans l'ordre des lignes du carnet (le clic sur l'en-tête l'ouvre). */
export function firstToCorrect(
  column: Pick<ProductionColumn, 'works'>,
  studentOrder: readonly { id: string }[],
  grades?: (studentId: string) => { status: string; grade_raw: number | null } | undefined,
): string | null {
  for (const s of studentOrder) {
    const w = column.works.get(s.id);
    if (grades ? cellToCorrect(w, grades(s.id)) : isToCorrect(w)) return s.id;
  }
  return null;
}
