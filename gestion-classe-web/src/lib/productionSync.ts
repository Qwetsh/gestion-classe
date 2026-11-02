import { gradableWorks, type WorkRow } from './productionsQueries';

/**
 * La note d'une production suit sa correction (hub Évaluations, phase 6, Q5 du plan).
 *
 * À l'ouverture de la fiche d'une éval liée à une activité, on rattrape les notes du carnet
 * en retard : production corrigée sans note au carnet, ou corrigée APRÈS la dernière
 * modification de la note avec un total différent. Une note retouchée à la main dans le carnet
 * après la correction est plus récente : on la laisse.
 */
export function worksToSync(
  works: readonly WorkRow[],
  grades: readonly { student_id: string; grade_raw: number | null; status: string | null; updated_at: string | null }[],
): WorkRow[] {
  const byStudent = new Map(grades.map((g) => [g.student_id, g]));
  return gradableWorks([...works]).filter((w) => {
    const g = byStudent.get(w.student_id);
    if (!g) return true;
    const same = g.status === 'noted' && g.grade_raw != null && Number(g.grade_raw) === Number(w.total_points);
    if (same) return false;
    if (!w.corrected_at || !g.updated_at) return !g.updated_at;
    return new Date(w.corrected_at).getTime() > new Date(g.updated_at).getTime();
  });
}
