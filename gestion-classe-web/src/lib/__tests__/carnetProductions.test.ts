import { describe, expect, it } from 'vitest';
import { cellToCorrect, firstToCorrect, productionColumns, type ClassWorkLite } from '../carnetProductions';

const act = (id: string, title: string) => ({ id, title, bareme_total: 20, sequence: null });
const work = (activity_id: string, student_id: string, status: ClassWorkLite['status'], submitted_at = '2026-11-01'): ClassWorkLite =>
  ({ activity_id, student_id, status, total_points: status === 'submitted' ? null : 12, submitted_at });

describe('productionColumns', () => {
  it('une colonne par activité envoyée, liée ou non, brouillons exclus', () => {
    const cols = productionColumns(
      [act('a', 'Hôpital'), act('b', 'Plaques'), act('c', 'Rien envoyé')],
      [work('a', 's1', 'submitted'), work('a', 's2', 'corrected'), work('b', 's1', 'validated'), work('c', 's1', 'draft')],
      { b: 'eval-b' },
    );
    expect(cols.map((c) => [c.activity.id, c.assessmentId, c.works.size, c.toCorrect])).toEqual([
      ['a', null, 2, 1],
      ['b', 'eval-b', 1, 0],
    ]);
  });

  it('garde la production la plus récente d’un élève', () => {
    const [col] = productionColumns([act('a', 'A')], [work('a', 's1', 'corrected', '2026-10-01'), work('a', 's1', 'submitted', '2026-11-02')], {});
    expect(col.works.get('s1')?.status).toBe('submitted');
  });
});

describe('cellToCorrect', () => {
  it('« À corriger » seulement pour un envoi non corrigé sans note ni statut', () => {
    expect(cellToCorrect({ status: 'submitted' }, undefined)).toBe(true);
    expect(cellToCorrect({ status: 'submitted' }, { status: 'noted', grade_raw: null })).toBe(true);
    expect(cellToCorrect({ status: 'submitted' }, { status: 'noted', grade_raw: 14 })).toBe(false);
    expect(cellToCorrect({ status: 'submitted' }, { status: 'absent', grade_raw: null })).toBe(false);
    expect(cellToCorrect({ status: 'corrected' }, undefined)).toBe(false);
    expect(cellToCorrect(undefined, undefined)).toBe(false);
  });
});

describe('firstToCorrect', () => {
  it('suit l’ordre des lignes du carnet', () => {
    const [col] = productionColumns([act('a', 'A')], [work('a', 's3', 'submitted'), work('a', 's2', 'submitted'), work('a', 's1', 'corrected')], {});
    expect(firstToCorrect(col, [{ id: 's1' }, { id: 's2' }, { id: 's3' }])).toBe('s2');
    expect(firstToCorrect(col, [{ id: 's1' }, { id: 's2' }, { id: 's3' }], (id) => (id === 's2' ? { status: 'noted', grade_raw: 10 } : undefined))).toBe('s3');
  });
});
