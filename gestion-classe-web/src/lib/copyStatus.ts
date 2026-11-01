/**
 * État des copies d'une évaluation, pour une classe : où en est-on entre le scan au téléphone
 * et la publication aux élèves ? Calculé à partir des lignes, jamais stocké (une seule source
 * de vérité : les pages et les notes elles-mêmes). Logique pure, testée.
 *
 * Étapes, dans l'ordre :
 *   vide → scan en cours → scannée → corrigée (des brouillons arrivent) → validée → publiée
 */

export type CopyStage = 'vide' | 'scan' | 'scannee' | 'corrigee' | 'validee' | 'publiee';

export const COPY_STAGE_LABEL: Record<CopyStage, string> = {
  vide: 'Pas de copie',
  scan: 'Scan en cours',
  scannee: 'Scannée',
  corrigee: 'Corrigée',
  validee: 'Validée',
  publiee: 'Publiée',
};

export interface CopyStudentInput {
  id: string;
}

export interface CopyPageInput {
  student_id: string;
}

export interface CopyGradeInput {
  student_id: string;
  status: string | null;
  grade: number | null;
  is_validated: boolean;
}

export interface CopyOverview {
  /** Élèves attendus (classe, ou demi-groupe si l'éval en a un). */
  total: number;
  /** Élèves avec au moins une page scannée. */
  scanned: number;
  absent: number;
  /** Ni copie ni absence notée. */
  missing: number;
  pages: number;
  /** Élèves présents qui ont une note (brouillon ou validée). */
  graded: number;
  /** Parmi eux, notes validées par le prof. */
  validated: number;
  stage: CopyStage;
}

/** Statuts qui dispensent de copie : absent, dispensé, non rendu. */
const NO_COPY_STATUSES = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);

export function computeCopyOverview(
  students: CopyStudentInput[],
  pages: CopyPageInput[],
  grades: CopyGradeInput[],
  published: boolean,
): CopyOverview {
  const expected = new Set(students.map((s) => s.id));
  const pagesBy = new Map<string, number>();
  for (const p of pages) {
    if (!expected.has(p.student_id)) continue;
    pagesBy.set(p.student_id, (pagesBy.get(p.student_id) ?? 0) + 1);
  }
  const gradeBy = new Map(grades.filter((g) => expected.has(g.student_id)).map((g) => [g.student_id, g]));

  let absent = 0;
  let graded = 0;
  let validated = 0;
  for (const id of expected) {
    const g = gradeBy.get(id);
    const hasCopy = pagesBy.has(id);
    if (!hasCopy && g?.status && NO_COPY_STATUSES.has(g.status)) {
      absent += 1;
      continue;
    }
    if (g && g.grade != null) {
      graded += 1;
      if (g.is_validated) validated += 1;
    }
  }

  const scanned = pagesBy.size;
  const total = expected.size;
  const missing = Math.max(0, total - scanned - absent);
  const present = total - absent;

  let stage: CopyStage;
  if (published) stage = 'publiee';
  else if (present > 0 && validated === present) stage = 'validee';
  else if (graded > 0) stage = 'corrigee';
  else if (scanned > 0 && missing === 0) stage = 'scannee';
  else if (scanned > 0) stage = 'scan';
  else stage = 'vide';

  return {
    total,
    scanned,
    absent,
    missing,
    pages: [...pagesBy.values()].reduce((a, b) => a + b, 0),
    graded,
    validated,
    stage,
  };
}

/** Résumé d'une ligne : « 22/26 scannées · 3 absents · 1 manquante ». */
export function describeCopyOverview(o: CopyOverview): string {
  const parts = [`${o.scanned}/${o.total} scannée${o.scanned > 1 ? 's' : ''}`];
  if (o.absent > 0) parts.push(`${o.absent} absent${o.absent > 1 ? 's' : ''}`);
  if (o.missing > 0 && o.scanned > 0) parts.push(`${o.missing} manquante${o.missing > 1 ? 's' : ''}`);
  if (o.graded > 0) parts.push(`${o.graded} notée${o.graded > 1 ? 's' : ''}`);
  if (o.validated > 0) parts.push(`${o.validated} validée${o.validated > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
