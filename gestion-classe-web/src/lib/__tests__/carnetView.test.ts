import { describe, expect, it } from 'vitest';
import {
  cellMark,
  filterAssessments,
  hasUnsequenced,
  headerTitle,
  isFiltered,
  kindsPresent,
  NO_FILTERS,
  parsePrefs,
  sequencesPresent,
  shortDate,
} from '../carnetView';

const ev = (over: Record<string, unknown>) => ({
  kind: 'ecrit' as const, sequence: null as string | null, published_to_students: false, name: 'Éval', short_name: null as string | null, ...over,
});

describe('filtres de colonnes', () => {
  const list = [
    ev({ name: 'A', kind: 'ecrit', sequence: 'Séquence 1', published_to_students: true }),
    ev({ name: 'B', kind: 'tp', sequence: 'Séquence 2' }),
    ev({ name: 'C', kind: 'ecrit', sequence: null }),
    ev({ name: 'D', kind: 'oral', sequence: ' Séquence 10 ' }),
  ];

  it('sans filtre, tout passe', () => {
    expect(filterAssessments(list, NO_FILTERS)).toHaveLength(4);
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it('par type, séquence (y compris « sans séquence ») et publication', () => {
    expect(filterAssessments(list, { ...NO_FILTERS, kind: 'ecrit' }).map((a) => a.name)).toEqual(['A', 'C']);
    expect(filterAssessments(list, { ...NO_FILTERS, sequence: 'Séquence 10' }).map((a) => a.name)).toEqual(['D']);
    expect(filterAssessments(list, { ...NO_FILTERS, sequence: '' }).map((a) => a.name)).toEqual(['C']);
    expect(filterAssessments(list, { ...NO_FILTERS, published: 'yes' }).map((a) => a.name)).toEqual(['A']);
    expect(filterAssessments(list, { ...NO_FILTERS, published: 'no' })).toHaveLength(3);
    expect(isFiltered({ ...NO_FILTERS, published: 'no' })).toBe(true);
  });

  it('liste les types et les séquences présents, dans un ordre naturel', () => {
    expect(kindsPresent(list)).toEqual(['ecrit', 'tp', 'oral']);
    expect(sequencesPresent(list)).toEqual(['Séquence 1', 'Séquence 2', 'Séquence 10']);
    expect(hasUnsequenced(list)).toBe(true);
    expect(hasUnsequenced(list.slice(0, 2))).toBe(false);
  });
});

describe('en-tête', () => {
  it('prend le titre court s’il existe', () => {
    expect(headerTitle(ev({ name: 'Évaluation du 11/09', short_name: 'Éval 1' }))).toBe('Éval 1');
    expect(headerTitle(ev({ name: 'Évaluation du 11/09', short_name: '  ' }))).toBe('Évaluation du 11/09');
    expect(headerTitle(ev({ name: 'TP' }))).toBe('TP');
  });

  it('date courte', () => {
    expect(shortDate('2026-09-11')).toBe('11/09');
    expect(shortDate(null)).toBe('');
    expect(shortDate('n’importe quoi')).toBe('');
  });
});

describe('indicateur de cellule', () => {
  const scanned = { scanned: 20, transcribed: 0 };
  const manual = { scanned: 0, transcribed: 0 };
  const g = (over: Record<string, unknown>) => ({ grade: null as number | null, is_validated: true, status: 'noted' as const, ...over });

  it('brouillon d’abord, quel que soit le type', () => {
    expect(cellMark({ kind: 'tp' }, g({ grade: 12, is_validated: false }), false, undefined)).toBe('draft');
    expect(cellMark({ kind: 'ecrit' }, g({ grade: 12, is_validated: false }), true, scanned)).toBe('draft');
  });

  it('copie à corriger, copie manquante, rien pour un absent ou une éval saisie à la main', () => {
    expect(cellMark({ kind: 'ecrit' }, undefined, true, scanned)).toBe('to_grade');
    expect(cellMark({ kind: 'ecrit' }, undefined, false, scanned)).toBe('missing_copy');
    expect(cellMark({ kind: 'ecrit' }, g({ status: 'absent' }), false, scanned)).toBeNull();
    expect(cellMark({ kind: 'ecrit' }, undefined, false, manual)).toBeNull();
    expect(cellMark({ kind: 'ecrit' }, g({ grade: 14 }), false, scanned)).toBeNull();
    expect(cellMark({ kind: 'oral' }, undefined, false, scanned)).toBeNull();
  });
});

describe('préférences enregistrées', () => {
  it('relit ce qui est valide, ignore le reste', () => {
    expect(parsePrefs(null).showAverage).toBe(true);
    expect(parsePrefs('{pas du json')).toEqual(parsePrefs(null));
    const p = parsePrefs(JSON.stringify({ filters: { kind: 'tp', sequence: 'Séquence 1', published: 'no' }, showAverage: false }));
    expect(p).toEqual({ filters: { kind: 'tp', sequence: 'Séquence 1', published: 'no' }, showAverage: false });
    expect(parsePrefs(JSON.stringify({ filters: { kind: 'bidon', published: 'peut-être' } })).filters).toEqual(NO_FILTERS);
  });
});
