import { describe, expect, it } from 'vitest';
import { snapMove, unionRect } from '../boardSnap';

const other = { x: 100, y: 100, w: 200, h: 100 };

describe('aimantation', () => {
  it('aligne un bord sur le bord voisin dans le seuil', () => {
    const r = snapMove({ x: 304, y: 400, w: 50, h: 50 }, [other], 6);
    expect(r.dx).toBe(-4);
    expect(r.vertical).toEqual([300]);
    expect(r.dy).toBe(0);
    expect(r.horizontal).toEqual([]);
  });

  it('aligne les centres', () => {
    const r = snapMove({ x: 178, y: 400, w: 40, h: 40 }, [other], 6);
    expect(r.dx).toBe(2);
    expect(r.vertical).toEqual([200]);
  });

  it('ne bouge rien hors du seuil', () => {
    expect(snapMove({ x: 320, y: 400, w: 50, h: 50 }, [other], 6)).toEqual({ dx: 0, dy: 0, vertical: [], horizontal: [] });
  });

  it('prend le guide le plus proche', () => {
    // Bord gauche à 97 : le bord de `other` (100, à 3) gagne sur celui du petit rectangle (102, à 5)
    const r = snapMove({ x: 97, y: 400, w: 50, h: 50 }, [other, { x: 102, y: 600, w: 10, h: 10 }], 6);
    expect(r.dx).toBe(3);
    expect(r.vertical).toEqual([100]);
  });

  it('accroche à la grille quand aucun guide ne prend l’axe', () => {
    const r = snapMove({ x: 52, y: 401, w: 50, h: 50 }, [], 6, 25);
    expect(r).toEqual({ dx: -2, dy: -1, vertical: [], horizontal: [] });
  });

  it('laisse le guide gagner sur la grille', () => {
    const r = snapMove({ x: 304, y: 401, w: 50, h: 50 }, [other], 6, 25);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(-1);
  });

  it('unit des rectangles', () => {
    expect(unionRect([other, { x: 50, y: 250, w: 10, h: 10 }])).toEqual({ x: 50, y: 100, w: 250, h: 160 });
    expect(unionRect([])).toBeNull();
  });
});
