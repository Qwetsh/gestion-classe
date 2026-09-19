import { describe, expect, it } from 'vitest';
import { CURTAIN_OPEN_AT, curtainSlide, settleCurtain, type RevealState } from '../boardReveal';

describe('settleCurtain', () => {
  it('compte un rideau presque sorti comme découvert', () => {
    expect(settleCurtain({ dx: 0, dy: CURTAIN_OPEN_AT })).toBe(true);
    expect(settleCurtain({ dx: 0, dy: -1 })).toBe(true);
  });

  it('remet en place un rideau à peine bougé', () => {
    expect(settleCurtain({ dx: 0, dy: 0.01 })).toBeNull();
    expect(settleCurtain({ dx: 0, dy: -0.019 })).toBeNull();
  });

  it('garde un décalage intermédiaire tel quel', () => {
    const slide = { dx: 0, dy: 0.4 };
    expect(settleCurtain(slide)).toEqual(slide);
  });
});

describe('curtainSlide', () => {
  const state: RevealState = { pages: {}, gaps: {}, shown: {}, objects: { a: true, b: 'data:image/png;base64,x', c: { dx: 0, dy: 0.3 } } };

  it('ne renvoie un décalage que pour un rideau tiré en partie', () => {
    expect(curtainSlide(state, 'a')).toBeNull();
    expect(curtainSlide(state, 'b')).toBeNull();
    expect(curtainSlide(state, 'c')).toEqual({ dx: 0, dy: 0.3 });
    expect(curtainSlide(state, 'zz')).toBeNull();
  });
});
