import { describe, expect, it } from 'vitest';
import { describeGradeValue, formatVersionDate, gradeSource } from '../gradeHistory';

describe('auteur d’une version', () => {
  it('suit la règle du trigger de la migration 061', () => {
    expect(gradeSource({ v: 1, source: 'api', questions: [] })).toBe('ia');
    expect(gradeSource({ v: 1, questions: [] })).toBe('correcteur');
    expect(gradeSource(null)).toBe('prof');
    expect(gradeSource(undefined)).toBe('prof');
  });
});

describe('valeur d’une version', () => {
  it('note brute et /20 quand le barème n’est pas sur 20', () => {
    expect(describeGradeValue({ status: 'noted', grade: 10.36, grade_raw: 14.5 }, 28)).toBe('14,5/28 (10,36/20)');
    expect(describeGradeValue({ status: 'noted', grade: 12, grade_raw: 12 }, 20)).toBe('12/20');
    expect(describeGradeValue({ status: 'noted', grade: null, grade_raw: 6 }, 8)).toBe('6/8 (15/20)');
  });

  it('statut sans note', () => {
    expect(describeGradeValue({ status: 'absent', grade: null, grade_raw: null }, 20)).toBe('Absent');
    expect(describeGradeValue({ status: 'noted', grade: null, grade_raw: null }, 20)).toBe('Sans note');
  });

  it('date lisible, vide si absente', () => {
    expect(formatVersionDate(null)).toBe('');
    expect(formatVersionDate('n’importe quoi')).toBe('');
    expect(formatVersionDate('2026-11-02T14:32:00')).toMatch(/^02\/11 à 14:32$/);
  });
});
