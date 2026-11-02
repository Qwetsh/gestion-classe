import { describe, expect, it } from 'vitest';
import { isGroupGradeAdjusted, parseGroupDetails } from '../groupDetails';
import { gradeSource } from '../gradeHistory';

const raw = {
  v: 2,
  type: 'groupe',
  groupe: {
    nom: 'Groupe 3',
    membres: ['Ayaz SO.', 'Charlotte RI.'],
    criteres: [{ label: 'Protocole', points: 3, max: 4 }, { label: 'Schéma', points: 4.5, max: 6 }],
    malus: 0.5,
    total: 7,
    bareme: 10,
    seance_id: 'abc',
  },
};

describe('détail d’une note de groupe', () => {
  it('se lit, et seulement s’il est de type groupe', () => {
    const d = parseGroupDetails(raw);
    expect(d?.nom).toBe('Groupe 3');
    expect(d?.membres).toEqual(['Ayaz SO.', 'Charlotte RI.']);
    expect(d?.criteres).toHaveLength(2);
    expect(d?.total).toBe(7);
    expect(parseGroupDetails({ v: 1, questions: [] })).toBeNull();
    expect(parseGroupDetails(null)).toBeNull();
    expect(parseGroupDetails({ type: 'groupe', groupe: { nom: 'x' } })).toBeNull();
  });

  it('repère une note ajustée par le prof', () => {
    const d = parseGroupDetails(raw);
    expect(isGroupGradeAdjusted({ status: 'noted', grade_raw: 7 }, d)).toBe(false);
    expect(isGroupGradeAdjusted({ status: 'noted', grade_raw: 8 }, d)).toBe(true);
    expect(isGroupGradeAdjusted({ status: 'absent', grade_raw: null }, d)).toBe(true);
    expect(isGroupGradeAdjusted(null, d)).toBe(false);
  });

  it('auteur d’une version de groupe : la séance, ou le prof s’il l’avait ajustée', () => {
    expect(gradeSource(raw, { status: 'noted', grade_raw: 7 })).toBe('groupe');
    expect(gradeSource(raw, { status: 'noted', grade_raw: 8 })).toBe('prof');
    expect(gradeSource(raw, { status: 'absent', grade_raw: null })).toBe('prof');
  });
});
