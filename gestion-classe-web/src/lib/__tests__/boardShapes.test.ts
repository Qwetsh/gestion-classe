import { describe, expect, it } from 'vitest';
import { contrastColor, followShape, pointsInsideShape, shapeContainsPoint, shapeTextBox, toShapeLocal, type ShapeObject } from '../boardShapes';
import { followAttachedInk, type Stroke } from '../boardRender';

const rect: ShapeObject = { id: 's1', type: 'shape', kind: 'rect', x: 100, y: 100, w: 200, h: 100, stroke: '#111827', strokeWidth: 4, fill: '#DC2626' };
const arrow: ShapeObject = { ...rect, id: 's2', kind: 'arrow', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } };

describe('repère local et contenance (sans canvas : test sur la boîte)', () => {
  it('convertit un point de la page dans le repère de la forme', () => {
    expect(toShapeLocal(rect, 100, 100)).toEqual({ x: 0, y: 0 });
    expect(toShapeLocal(rect, 300, 200)).toEqual({ x: 200, y: 100 });
  });

  it('tient compte de la rotation', () => {
    // Tourné de 90°, le coin haut-gauche de la boîte tournée est à (250, 50) sur la page
    const p = toShapeLocal({ ...rect, rotation: 90 }, 250, 50);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('accepte un point au bord avec tolérance, jamais dans une flèche', () => {
    expect(shapeContainsPoint(rect, 150, 150, null)).toBe(true);
    expect(shapeContainsPoint(rect, 302, 150, null)).toBe(false);
    expect(shapeContainsPoint(rect, 302, 150, null, 4)).toBe(true);
    expect(shapeContainsPoint(arrow, 150, 150, null, 4)).toBe(false);
  });

  it('attache un trait seulement si tous ses points sont dedans', () => {
    expect(pointsInsideShape([{ x: 120, y: 120 }, { x: 280, y: 190 }], rect, null)).toBe(true);
    expect(pointsInsideShape([{ x: 120, y: 120 }, { x: 320, y: 190 }], rect, null)).toBe(false);
    expect(pointsInsideShape([], rect, null)).toBe(false);
  });
});

describe('suivi d’une forme', () => {
  it('translate avec la forme', () => {
    const p = followShape({ x: 150, y: 150, p: 0.5 }, rect, { ...rect, x: 400, y: 300 });
    expect(p).toEqual({ x: 450, y: 350, p: 0.5 });
  });

  it('se met à l’échelle avec la forme', () => {
    const p = followShape({ x: 200, y: 150 }, rect, { ...rect, w: 400, h: 200 });
    expect(p).toEqual({ x: 300, y: 200 });
  });

  it('tourne avec la forme autour de son centre', () => {
    const p = followShape({ x: 300, y: 150 }, rect, { ...rect, rotation: 90 });
    expect(Math.round(p.x)).toBe(200);
    expect(Math.round(p.y)).toBe(250);
  });
});

describe('encre attachée', () => {
  const ink: Stroke[] = [
    { id: 'a', tool: 'pen', color: '#000', size: 3, points: [{ x: 150, y: 150, p: 1 }], parentId: 's1' },
    { id: 'b', tool: 'pen', color: '#000', size: 3, points: [{ x: 10, y: 10, p: 1 }] },
  ];

  it('ne change rien quand la forme ne bouge pas', () => {
    expect(followAttachedInk([rect], [rect], ink)).toBe(ink);
    expect(followAttachedInk([rect], [{ ...rect, fill: null }], ink)).toBe(ink);
  });

  it('suit la forme et laisse l’encre libre en place', () => {
    const out = followAttachedInk([rect], [{ ...rect, x: 110 }], ink);
    expect(out[0].points[0]).toEqual({ x: 160, y: 150, p: 1 });
    expect(out[1]).toBe(ink[1]);
  });

  it('disparaît avec la forme supprimée', () => {
    const out = followAttachedInk([rect], [], ink);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });
});

describe('texte dans la forme', () => {
  it('a une boîte intérieure plus étroite dans une ellipse que dans un rectangle', () => {
    expect(shapeTextBox(rect).w).toBeGreaterThan(shapeTextBox({ ...rect, kind: 'ellipse' }).w);
  });
  it('choisit une couleur lisible sur le remplissage', () => {
    expect(contrastColor('#DC2626')).toBe('#FFFFFF');
    expect(contrastColor('#FDE68A')).toBe('#111827');
    expect(contrastColor(null)).toBe('#111827');
  });
});
