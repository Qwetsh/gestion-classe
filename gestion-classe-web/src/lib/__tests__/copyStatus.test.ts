import { describe, expect, it } from 'vitest';
import {
  computeCopyOverview,
  daysUntilPurge,
  describeCopyOverview,
  extendedPurgeDate,
  retentionState,
} from '../copyStatus';

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

  it('counts scanned copies still waiting for a transcription (their scans are kept)', () => {
    const o = computeCopyOverview(students, [page('a'), page('b'), page('b')], [], true, new Set(['a', 'zz']));
    expect(o).toMatchObject({ transcribed: 1, untranscribed: 1 });
    expect(computeCopyOverview(students, [page('a')], [], true)).toMatchObject({ transcribed: 0, untranscribed: 1 });
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

describe('conservation des scans', () => {
  const now = new Date('2026-11-01T10:00:00.000Z');

  it('compte les jours restants avant la suppression', () => {
    expect(daysUntilPurge('2026-12-01T10:00:00.000Z', now)).toBe(30);
    expect(daysUntilPurge('2026-11-01T22:00:00.000Z', now)).toBe(1);
    expect(daysUntilPurge('2026-10-30T10:00:00.000Z', now)).toBe(-2);
  });

  it('« Garder 30 j de plus » part de la date prévue, ou d’aujourd’hui si elle est passée', () => {
    expect(extendedPurgeDate('2026-11-20T00:00:00.000Z', now)).toBe('2026-12-20T00:00:00.000Z');
    expect(extendedPurgeDate('2026-10-01T00:00:00.000Z', now)).toBe('2026-12-01T10:00:00.000Z');
    expect(extendedPurgeDate(null, now)).toBe('2026-12-01T10:00:00.000Z');
  });

  it('dit si les scans sont conservés, programmés ou supprimés', () => {
    expect(retentionState({ copies_purge_at: null, copies_purged_at: null }, 0, now)).toEqual({ kind: 'none' });
    expect(retentionState({ copies_purge_at: null, copies_purged_at: null }, 12, now)).toEqual({ kind: 'kept' });
    expect(retentionState({ copies_purge_at: '2026-11-11T10:00:00.000Z', copies_purged_at: null }, 12, now))
      .toEqual({ kind: 'scheduled', days: 10, at: '2026-11-11T10:00:00.000Z' });
    expect(retentionState({ copies_purge_at: '2026-10-01T00:00:00.000Z', copies_purged_at: '2026-10-02T03:15:00.000Z' }, 0, now))
      .toEqual({ kind: 'purged', at: '2026-10-02T03:15:00.000Z' });
  });
});
