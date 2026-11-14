import { describe, expect, it } from 'vitest';
import { courseScreens } from '../courseDoc';

describe('courseScreens', () => {
  it('rend la liste des écrans, dans l’ordre du document', () => {
    expect(courseScreens({ screens: ['b', 'a', 'c'] })).toEqual(['b', 'a', 'c']);
  });

  it('rend une liste vide pour un cours sans face écran', () => {
    expect(courseScreens({})).toEqual([]);
    expect(courseScreens(null)).toEqual([]);
    expect(courseScreens(undefined)).toEqual([]);
  });

  it('écarte ce qui n’est pas un identifiant de page', () => {
    const doc = { screens: ['a', '', 3, null, 'b'] } as unknown as { screens: string[] };
    expect(courseScreens(doc)).toEqual(['a', 'b']);
    expect(courseScreens({ screens: 'a' } as unknown as { screens: string[] })).toEqual([]);
  });
});
