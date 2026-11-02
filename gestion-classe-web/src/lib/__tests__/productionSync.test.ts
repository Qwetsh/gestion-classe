import { describe, expect, it } from 'vitest';
import { worksToSync } from '../productionSync';
import type { WorkRow } from '../productionsQueries';

function work(student: string, total: number | null, status: WorkRow['status'], correctedAt: string | null): WorkRow {
  return {
    id: `w-${student}`, activity_id: 'act', student_id: student, class_id: 'c', group_key: null, group_pseudos: [],
    content: {}, status, version: 1, first_submitted_at: null, submitted_at: null, modified_after_correction: false,
    correction: null, advice: null, skills: null, total_points: total, corrected_by: 'prof', corrected_at: correctedAt,
    validated_at: null, updated_at: '2026-11-01T10:00:00Z', students: null, classes: null,
  };
}

describe('la note d’une production suit sa correction', () => {
  it('rattrape les notes absentes ou plus anciennes que la correction, pas les retouches du prof', () => {
    const works = [
      work('a', 8, 'corrected', '2026-11-02T10:00:00Z'),   // pas de note au carnet
      work('b', 7, 'corrected', '2026-11-02T10:00:00Z'),   // note plus ancienne, différente
      work('c', 6, 'validated', '2026-11-02T10:00:00Z'),   // retouchée à la main après la correction
      work('d', 5, 'corrected', '2026-11-02T10:00:00Z'),   // déjà à jour
      work('e', null, 'submitted', null),                  // pas corrigée
    ];
    const grades = [
      { student_id: 'b', grade_raw: 5, status: 'noted', updated_at: '2026-11-01T10:00:00Z' },
      { student_id: 'c', grade_raw: 7, status: 'noted', updated_at: '2026-11-03T10:00:00Z' },
      { student_id: 'd', grade_raw: 5, status: 'noted', updated_at: '2026-11-01T10:00:00Z' },
    ];
    expect(worksToSync(works, grades).map((w) => w.student_id)).toEqual(['a', 'b']);
  });
});
