import { describe, expect, it } from 'vitest';
import { columnLabels, normalizeName, relinkTargets, sameNameTarget } from '../columnHeader';

const base = { bareme_total: 10, coefficient: 1, school_year: '2026-2027', period: 1, series_id: null as string | null };

function ev(id: string, cls: string, name: string, extra: Record<string, unknown> = {}) {
  return { ...base, id, name, kind: 'ecrit' as const, date: '2026-09-28', class_id: `c-${cls}`, classes: { name: cls }, ...extra };
}

describe('titres des colonnes', () => {
  it('raccourcit les TP de groupe et numérote deux séances le même jour', () => {
    const labels = columnLabels([
      { id: 'a', name: 'Évaluation du 11/09', kind: 'ecrit', date: '2026-09-11', bareme_total: 8, coefficient: 1 },
      { id: 'b', name: 'TP de groupe du 22/09', kind: 'groupe', date: '2026-09-22', bareme_total: 10, coefficient: 1 },
      { id: 'c', name: 'TP de groupe du 22/09', kind: 'groupe', date: '2026-09-22', bareme_total: 10, coefficient: 1 },
      { id: 'd', name: 'TP de groupe du 06/10', kind: 'groupe', date: '2026-10-06', bareme_total: 5, coefficient: 1 },
      { id: 'e', name: 'Expérience microbiote', kind: 'groupe', date: '2026-10-02', bareme_total: 10, coefficient: 1 },
      { id: 'f', name: 'Evaluation séquence 2', kind: 'ecrit', date: '2026-11-02', bareme_total: 20, coefficient: 2, short_name: 'Séq. 2' },
    ]);
    expect(labels.get('a')).toEqual({ title: 'Évaluation du 11/09', meta: 'Écrit · 11/09 · /8', coefficient: null });
    expect(labels.get('b')?.title).toBe('TP de groupe · 1');
    expect(labels.get('c')?.title).toBe('TP de groupe · 2');
    expect(labels.get('d')?.title).toBe('TP de groupe');
    expect(labels.get('e')?.title).toBe('Expérience microbiote');
    expect(labels.get('f')).toEqual({ title: 'Séq. 2', meta: 'Écrit · 02/11 · /20', coefficient: 2 });
  });
});

describe('relier une éval à une autre classe', () => {
  const all = [
    ev('4a', '4A', 'Séquence 1 - Activité 4 - Les roches', { series_id: 's1', assessment_series: { name: 'Séquence 1 - Activité 4 - Les roches' } }),
    ev('4b', '4B', 'Séquence 1 - Activité 4 - Les roches', { series_id: 's1', assessment_series: { name: 'Séquence 1 - Activité 4 - Les roches' } }),
    ev('4c', '4C', 'Sequence 1 – activité 4 : les roches'),
    ev('4b2', '4B', 'Éval 1 – Volcans', { bareme_total: 20, date: '2026-10-05' }),
    ev('4c2', '4C', 'Autre éval de 4C'),
    ev('3a', '3A', 'Séquence 1 - Activité 4 - Les roches'),
    ev('4dT2', '4D', 'Éval de T2', { period: 2, date: '2026-12-01' }),
    ev('4dOral', '4D', 'Oral', { kind: 'oral' }),
  ];

  it('compare les noms sans accents, casse ni ponctuation', () => {
    expect(normalizeName('Sequence 1 – activité 4 : les roches')).toBe(normalizeName('Séquence 1 - Activité 4 - Les roches'));
  });

  it('propose la série de même nom d’abord, jamais une autre classe de 4C ni un autre niveau', () => {
    const current = all.find((a) => a.id === '4c')!;
    const targets = relinkTargets(current, all);
    expect(targets.map((t) => t.key)).toEqual(['s:s1', 'a:4b2', 'a:4dT2']);
    expect(targets[0]).toMatchObject({ seriesId: 's1', classNames: ['4A', '4B'], sameName: true });
    expect(sameNameTarget(current, all)?.key).toBe('s:s1');
  });

  it('ne propose rien de sa propre série, ni pour un TP de groupe', () => {
    const inSeries = all.find((a) => a.id === '4a')!;
    expect(relinkTargets(inSeries, all).some((t) => t.key === 's:s1')).toBe(false);
    expect(relinkTargets({ ...inSeries, kind: 'groupe' }, all)).toEqual([]);
    expect(sameNameTarget(all.find((a) => a.id === '4c2')!, all)).toBeNull();
  });
});
