import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickedOrFirst, readTabChoices, saveTabChoices } from '../tabChoice';

describe('pickedOrFirst', () => {
  const sections = [{ key: 'planete' }, { key: 'vivant' }, { key: 'corps' }];
  const keyOf = (s: { key: string }) => s.key;

  it('montre la section de l’onglet choisi', () => {
    expect(pickedOrFirst(sections, 'vivant', keyOf)).toBe(sections[1]);
  });

  it('revient à la première sans choix, ou quand l’onglet choisi n’existe plus', () => {
    expect(pickedOrFirst(sections, undefined, keyOf)).toBe(sections[0]);
    expect(pickedOrFirst(sections, '2019', keyOf)).toBe(sections[0]);
  });

  it('ne montre rien quand la liste est vide', () => {
    expect(pickedOrFirst([], 'vivant', keyOf)).toBeNull();
  });
});

describe('choix d’onglet gardé sur l’appareil', () => {
  const store = new Map<string, string>();
  const stub = (getItem: (k: string) => string | null) => vi.stubGlobal('localStorage', {
    getItem,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
  afterEach(() => { vi.unstubAllGlobals(); store.clear(); });

  it('relit ce qui a été enregistré, liste par liste', () => {
    stub((k) => store.get(k) ?? null);
    saveTabChoices('cle', { activites: '4e', methodes: 'Tous niveaux' });
    expect(readTabChoices('cle')).toEqual({ activites: '4e', methodes: 'Tous niveaux' });
    expect(readTabChoices('autre')).toEqual({});
  });

  it('écarte un contenu abîmé ou d’une autre forme', () => {
    stub((k) => ({ a: 'pas du json', b: '["4e"]', c: '{"activites":"4e","methodes":true}', d: 'null' })[k] ?? null);
    expect(readTabChoices('a')).toEqual({});
    expect(readTabChoices('b')).toEqual({});
    expect(readTabChoices('c')).toEqual({ activites: '4e' });
    expect(readTabChoices('d')).toEqual({});
  });

  it('ne plante pas quand le stockage est indisponible', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    expect(readTabChoices('cle')).toEqual({});
    expect(() => saveTabChoices('cle', { tp: '5e' })).not.toThrow();
  });
});
