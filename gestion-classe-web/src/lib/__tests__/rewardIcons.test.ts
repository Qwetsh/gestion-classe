import { describe, expect, it } from 'vitest';
import { REWARD_ICON_LIBRARY, lucideRef, parseIconRef, searchRewardIcons, validateIconFile } from '../rewardIcons';

describe('parseIconRef', () => {
  it('reconnaît une icône de la bibliothèque', () => {
    const p = parseIconRef('lucide:Star');
    expect(p?.kind).toBe('lucide');
    if (p?.kind === 'lucide') { expect(p.name).toBe('Star'); expect(p.def?.group).toBe('Récompenses'); }
  });

  it('accepte un nom Lucide hors bibliothèque (def null) et refuse un nom mal formé', () => {
    const p = parseIconRef('lucide:Owl');
    expect(p?.kind === 'lucide' && p.def === null).toBe(true);
    expect(parseIconRef('lucide:star')).toBeNull();
    expect(parseIconRef('lucide:<script>')).toBeNull();
  });

  it('reconnaît une image https et refuse le reste', () => {
    expect(parseIconRef('https://x.supabase.co/storage/v1/object/public/reward-icons/u/a.png')).toEqual({
      kind: 'image', url: 'https://x.supabase.co/storage/v1/object/public/reward-icons/u/a.png',
    });
    expect(parseIconRef('http://insecure.example/a.png')).toBeNull();
    expect(parseIconRef('⭐')).toBeNull();
    expect(parseIconRef('')).toBeNull();
    expect(parseIconRef(null)).toBeNull();
  });

  it('lucideRef produit une référence relisible', () => {
    expect(parseIconRef(lucideRef('Trophy'))?.kind).toBe('lucide');
  });
});

describe('bibliothèque', () => {
  it('n’a pas de doublon de nom', () => {
    const names = REWARD_ICON_LIBRARY.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('cherche sans accents ni casse, dans le nom et les mots-clés', () => {
    expect(searchRewardIcons('ETOILE').map((d) => d.name)).toContain('Star');
    expect(searchRewardIcons('trophee').map((d) => d.name)).toContain('Trophy');
    expect(searchRewardIcons('zzzz')).toHaveLength(0);
    expect(searchRewardIcons('')).toHaveLength(REWARD_ICON_LIBRARY.length);
  });
});

describe('validateIconFile', () => {
  it('accepte une petite image et refuse le reste', () => {
    expect(validateIconFile({ type: 'image/png', size: 10_000 })).toBeNull();
    expect(validateIconFile({ type: 'application/pdf', size: 10_000 })).toMatch(/Format/);
    expect(validateIconFile({ type: 'image/png', size: 600 * 1024 })).toMatch(/trop lourde/);
  });
});
