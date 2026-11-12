import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabase', () => ({ supabase: {} }));

import { countWords, versionsToPrune, type CourseVersion } from '../courseVersions';

const NOW = new Date('2026-11-12T12:00:00').getTime();
const v = (id: string, minutesAgo: number, kind: CourseVersion['kind'] = 'auto'): CourseVersion => ({
  id, kind, label: null, words: 0, created_at: new Date(NOW - minutesAgo * 60000).toISOString(),
});

describe('versionsToPrune', () => {
  it('garde tout sous 30 versions', () => {
    const list = Array.from({ length: 30 }, (_, i) => v(`v${i}`, i * 10));
    expect(versionsToPrune(list, NOW)).toEqual([]);
  });

  it('au-delà des 30 dernières, garde une version par jour sur 30 jours', () => {
    const recent = Array.from({ length: 30 }, (_, i) => v(`r${i}`, i)); // aujourd'hui
    const older = [v('d2a', 2 * 1440), v('d2b', 2 * 1440 + 30), v('d40', 40 * 1440)];
    const drop = versionsToPrune([...older, ...recent], NOW);
    // d2a = la plus récente de son jour : gardée ; d2b = même jour : effacée ; d40 : trop vieille
    expect(drop.sort()).toEqual(['d2b', 'd40']);
  });

  it('ne supprime jamais une version nommée', () => {
    const recent = Array.from({ length: 30 }, (_, i) => v(`r${i}`, i));
    expect(versionsToPrune([...recent, v('m', 90 * 1440, 'manual')], NOW)).toEqual([]);
  });
});

describe('countWords', () => {
  it('compte les mots des nœuds texte', () => {
    expect(countWords({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Les volcans  actifs' }] }, { type: 'heading', content: [{ type: 'text', text: 'Bilan' }] }] })).toBe(4);
  });
});
