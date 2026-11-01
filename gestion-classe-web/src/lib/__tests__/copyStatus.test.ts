import { describe, expect, it } from 'vitest';
import { computeCopyOverview, describeCopyOverview } from '../copyStatus';

const students = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const page = (student_id: string) => ({ student_id });
const grade = (student_id: string, over: Partial<{ status: string; grade: number | null; is_validated: boolean }> = {}) => ({
  student_id,
  status: 'noted',
  grade: null,
  is_validated: false,
  ...over,
});

describe('computeCopyOverview', () => {
  it('starts empty', () => {
    const o = computeCopyOverview(students, [], [], false);
    expect(o).toMatchObject({ total: 4, scanned: 0, missing: 4, stage: 'vide' });
  });

  it('counts students (not pages) and stays « en cours » while copies are missing', () => {
    const o = computeCopyOverview(students, [page('a'), page('a'), page('b')], [], false);
    expect(o).toMatchObject({ scanned: 2, pages: 3, missing: 2, stage: 'scan' });
  });

  it('is « scannée » once every present student has a copy (absents excluded)', () => {
    const o = computeCopyOverview(
      students,
      [page('a'), page('b'), page('c')],
      [grade('d', { status: 'absent' })],
      false,
    );
    expect(o).toMatchObject({ scanned: 3, absent: 1, missing: 0, stage: 'scannee' });
  });

  it('a scanned copy wins over an absent mark', () => {
    const o = computeCopyOverview(students, [page('d')], [grade('d', { status: 'absent' })], false);
    expect(o.absent).toBe(0);
    expect(o.scanned).toBe(1);
  });

  it('is « corrigée » as soon as draft grades arrive, « validée » when all present ones are validated', () => {
    const pages = students.map((s) => page(s.id));
    const drafts = students.map((s) => grade(s.id, { grade: 12 }));
    expect(computeCopyOverview(students, pages, drafts, false)).toMatchObject({ graded: 4, validated: 0, stage: 'corrigee' });
    const valid = students.map((s) => grade(s.id, { grade: 12, is_validated: true }));
    expect(computeCopyOverview(students, pages, valid, false).stage).toBe('validee');
  });

  it('publication wins over everything', () => {
    expect(computeCopyOverview(students, [], [], true).stage).toBe('publiee');
  });

  it('ignores pages and grades of students outside the expected list (other half-group)', () => {
    const o = computeCopyOverview([{ id: 'a' }], [page('a'), page('zz')], [grade('zz', { grade: 5 })], false);
    expect(o).toMatchObject({ total: 1, scanned: 1, graded: 0, stage: 'scannee' });
  });
});

describe('describeCopyOverview', () => {
  it('summarises a class in one line', () => {
    const o = computeCopyOverview(
      students,
      [page('a'), page('b')],
      [grade('c', { status: 'absent' }), grade('a', { grade: 14 })],
      false,
    );
    expect(describeCopyOverview(o)).toBe('2/4 scannées · 1 absent · 1 manquante · 1 notée');
  });
});
