import { describeGrades, type GradeStats, type GradeStatus } from './gradeStats';
import type { SeriesClassRow } from './evaluationQueries';

/** Les notes d'une classe pour une éval d'une série, résumées pour l'onglet Ensemble de la fiche. */
export interface ClassGradeSummary {
  assessmentId: string;
  className: string;
  stats: GradeStats;
  /** Élèves attendus (lignes de la classe, notées ou non). */
  total: number;
}

/** Les notes d'une série, résumées classe par classe, et l'ensemble du niveau. */
export function summarizeSeries(rows: SeriesClassRow[]): { classes: ClassGradeSummary[]; level: GradeStats; total: number } {
  const toEntries = (r: SeriesClassRow) =>
    r.entries.map((e, i) => ({ studentId: `${r.assessmentId}|${i}`, grade: e.grade, status: e.status as GradeStatus }));
  const classes = rows.map((r) => ({
    assessmentId: r.assessmentId,
    className: r.className,
    stats: describeGrades(toEntries(r)),
    total: r.entries.length,
  }));
  return {
    classes,
    level: describeGrades(rows.flatMap(toEntries)),
    total: rows.reduce((n, r) => n + r.entries.length, 0),
  };
}
