import { describe, expect, it } from 'vitest';
import { carnetHeaderChip, describeClassRow, groupAssessments, groupOf, groupStage, pendingDrafts, stageLabel } from '../assessmentGroups';
import type { CopyOverview } from '../copyStatus';
import type { AssessmentRow } from '../evaluationQueries';

const row = (over: Partial<AssessmentRow>): AssessmentRow => ({
  id: 'a',
  user_id: 'u',
  class_id: 'c',
  name: 'Éval',
  subject: null,
  date: null,
  bareme_total: 20,
  subject_path: null,
  correction_path: null,
  created_at: '2026-10-01',
  is_deleted: false,
  classes: { name: '5e2' },
  series_id: null,
  period: 1,
  school_year: '2026-2027',
  coefficient: 1,
  kind: 'ecrit',
  group_id: null,
  counts_in_average: true,
  published_to_students: false,
  session_id: null,
  published_at: null,
  copies_purge_at: null,
  copies_purged_at: null,
  assessment_series: null,
  ...over,
});

const overview = (over: Partial<CopyOverview>): CopyOverview => ({
  total: 26, scanned: 0, absent: 0, missing: 26, pages: 0, graded: 0, validated: 0,
  transcribed: 0, untranscribed: 0, stage: 'vide', ...over,
});

describe('groupAssessments', () => {
  const rows = [
    row({ id: 'b', class_id: 'c4', classes: { name: '5e4' }, series_id: 's1', assessment_series: { id: 's1', name: 'Nutrition' } as never }),
    row({ id: 'a', class_id: 'c2', classes: { name: '5e2' }, series_id: 's1', assessment_series: { id: 's1', name: 'Nutrition' } as never }),
    row({ id: 'solo', name: 'DM 1' }),
  ];

  it('replie une série en une entrée, classes triées par nom', () => {
    const groups = groupAssessments(rows);
    expect(groups.map((g) => g.name)).toEqual(['Nutrition', 'DM 1']);
    expect(groups[0].items.map((a) => a.classes?.name)).toEqual(['5e2', '5e4']);
    expect(groups[1].seriesId).toBeNull();
  });

  it('retrouve le groupe à partir de n’importe quelle classe de la série', () => {
    expect(groupOf(rows, 'b')?.items.map((a) => a.id)).toEqual(['a', 'b']);
    expect(groupOf(rows, 'solo')?.items.map((a) => a.id)).toEqual(['solo']);
    expect(groupOf(rows, 'nope')).toBeNull();
  });

  it('prend l’étape la moins avancée des classes qui ont des copies', () => {
    const g = groupAssessments(rows)[0];
    expect(groupStage(g, {})).toBeNull();
    expect(groupStage(g, { a: overview({ stage: 'publiee' }), b: overview({ stage: 'scan', scanned: 3 }) })).toBe('scan');
    expect(groupStage(g, { a: overview({ stage: 'validee' }), b: overview({ stage: 'vide' }) })).toBe('validee');
  });
});

describe('carnetHeaderChip', () => {
  it('dit ce qui reste à faire, dans l’ordre : valider, publier, scanner, noter', () => {
    expect(carnetHeaderChip(overview({ stage: 'corrigee', graded: 24, validated: 21 }), 2)?.label).toBe('À valider (3)');
    expect(carnetHeaderChip(overview({ stage: 'publiee', graded: 24, validated: 24 }), 0)?.label).toBe('Publiée');
    expect(carnetHeaderChip(overview({ stage: 'scan', scanned: 18, missing: 8 }), 26)?.label).toBe('Scan 18/26');
    expect(carnetHeaderChip(overview({ stage: 'scannee', scanned: 26, missing: 0 }), 26)?.label).toBe('Scannée');
    expect(carnetHeaderChip(overview({ stage: 'vide', graded: 22, validated: 22 }), 4)?.label).toBe('4 sans note');
    expect(carnetHeaderChip(overview({ stage: 'validee', graded: 26, validated: 26 }), 0)?.label).toBe('À publier');
    expect(carnetHeaderChip(overview({ stage: 'corrigee', graded: 26, validated: 26 }), 0)).toBeNull();
    expect(carnetHeaderChip(undefined, 3)?.label).toBe('3 sans note');
    expect(carnetHeaderChip(undefined, 0)).toBeNull();
  });
});

describe('describeClassRow', () => {
  it('parle de notes, pas de scans, pour une éval jamais scannée', () => {
    expect(describeClassRow(overview({ graded: 24, validated: 21, absent: 2 }), true)).toBe('24/26 notées · 2 absents · 3 brouillons');
    expect(describeClassRow(overview({ graded: 1, validated: 1 }), false)).toBe('1/26 notée');
    expect(describeClassRow(overview({ scanned: 22, missing: 4, graded: 20, validated: 20 }), true)).toContain('22/26 scannées');
  });
});

describe('stageLabel', () => {
  it('dit quoi faire : brouillons à valider, scan en cours', () => {
    expect(stageLabel(overview({ stage: 'scan', scanned: 18 }))).toBe('Scan 18/26');
    expect(stageLabel(overview({ stage: 'corrigee', graded: 24, validated: 21 }))).toBe('À valider (3)');
    expect(stageLabel(overview({ stage: 'corrigee', graded: 24, validated: 24 }))).toBe('Corrigée');
    expect(stageLabel(overview({ stage: 'publiee' }))).toBe('Publiée');
    expect(pendingDrafts(undefined)).toBe(0);
  });
});
