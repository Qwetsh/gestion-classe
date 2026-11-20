import { describe, expect, it } from 'vitest';
import { planFlip } from '../binderFlip';

describe('planFlip — classeur ouvert', () => {
  it('tourner vers l’avant : la page de droite part, la suivante apparaît au verso', () => {
    expect(planFlip([1, 2], [3, 4], 1, true, 2, 3)).toEqual({ kind: 'next-double', front: 2, back: 3, under: { side: 'left', page: 1 } });
  });

  it('depuis la première page (seule à droite), l’ancien côté gauche est la couverture', () => {
    expect(planFlip([null, 0], [1, 2], 1, true, 0, 1)).toEqual({ kind: 'next-double', front: 0, back: 1, under: { side: 'left', page: null } });
  });

  it('tourner vers l’arrière : la page de gauche revient à droite', () => {
    expect(planFlip([3, 4], [1, 2], -1, true, 3, 1)).toEqual({ kind: 'prev-double', front: 3, back: 2, under: { side: 'right', page: 4 } });
  });

  it('revenir à la première page', () => {
    expect(planFlip([1, 2], [null, 0], -1, true, 1, 0)).toEqual({ kind: 'prev-double', front: 1, back: 0, under: { side: 'right', page: 2 } });
  });

  it('pas de feuille pour un saut', () => {
    expect(planFlip([1, 2], [9, 10], 1, true, 2, 9)).toBeNull();
    expect(planFlip([9, 10], [1, 2], -1, true, 9, 1)).toBeNull();
  });

  it('pas de feuille au bout du classeur', () => {
    expect(planFlip([7, null], [7, null], 1, true, 7, 7)).toBeNull();
  });
});

describe('planFlip — une page à la fois', () => {
  it('en avant : la page courante part', () => {
    expect(planFlip([null, 3], [null, 4], 1, false, 3, 4)).toEqual({ kind: 'next-single', front: 3, back: null, under: null });
  });

  it('en arrière : la page précédente revient se poser sur l’ancienne', () => {
    expect(planFlip([null, 3], [null, 2], -1, false, 3, 2)).toEqual({ kind: 'prev-single', front: 2, back: null, under: { side: 'right', page: 3 } });
  });

  it('pas de feuille pour un saut', () => {
    expect(planFlip([null, 3], [null, 8], 1, false, 3, 8)).toBeNull();
  });
});
