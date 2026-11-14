import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { pageMeta, parsePageMeta } from '../boardQueries';
import { isRevealEmpty, normalizeReveal } from '../boardReveal';

describe('pageMeta', () => {
  it('ne range rien pour une page aux réglages par défaut', () => {
    expect(pageMeta({})).toBeNull();
    expect(pageMeta({ color: null, curtain: false, height: 562.5 })).toBeNull();
  });

  it('garde la couleur, le rideau et la hauteur d’une page allongée', () => {
    expect(pageMeta({ color: '#FFF8DC', curtain: true, height: 900 })).toEqual({ color: '#FFF8DC', curtain: true, height: 900 });
  });

  it('écarte une hauteur plus courte que le 16:9', () => {
    expect(pageMeta({ height: 300 })).toBeNull();
  });
});

describe('parsePageMeta', () => {
  it('relit ce que pageMeta a rangé', () => {
    const page = { color: '#EAF1F9', curtain: true, height: 1200 };
    expect(parsePageMeta(pageMeta(page))).toEqual(page);
  });

  it('rend un objet vide pour une colonne vide ou invalide', () => {
    expect(parsePageMeta(null)).toEqual({});
    expect(parsePageMeta('x')).toEqual({});
    expect(parsePageMeta({ color: 'rouge', curtain: 'oui', height: '900' })).toEqual({});
  });
});

describe('normalizeReveal', () => {
  it('remplit les rubriques absentes', () => {
    const s = normalizeReveal({ objects: { a: true }, savedAt: 12 });
    expect(s.objects).toEqual({ a: true });
    expect(s.pages).toEqual({});
    expect(s.gaps).toEqual({});
    expect(s.moved).toEqual({});
    expect(isRevealEmpty(s)).toBe(false);
  });

  it('rend un état vide pour une valeur illisible', () => {
    expect(isRevealEmpty(normalizeReveal(null))).toBe(true);
    expect(isRevealEmpty(normalizeReveal('x'))).toBe(true);
  });
});
