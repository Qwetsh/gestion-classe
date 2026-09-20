import { describe, expect, it } from 'vitest';
import { connectorBox, dropOrphanConnectors, nearestSide, newConnector, refreshConnectors, remapConnectorEnds, resolveConnector, sidePoint } from '../boardConnectors';
import type { BoardObject } from '../boardObjects';
import type { ShapeObject } from '../boardShapes';

const a: ShapeObject = { id: 'a', type: 'shape', kind: 'rect', x: 100, y: 100, w: 200, h: 100, stroke: '#111827', strokeWidth: 4, fill: '#DC2626' };
const b: ShapeObject = { ...a, id: 'b', x: 600, y: 300 };

describe('ancrage', () => {
  it('donne le milieu de chaque côté', () => {
    expect(sidePoint(a, 'e')).toEqual({ x: 300, y: 150 });
    expect(sidePoint(a, 's')).toEqual({ x: 200, y: 200 });
  });

  it('tourne avec la forme', () => {
    const p = sidePoint({ ...a, rotation: 90 }, 'e');
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(250, 6);
  });

  it('choisit le côté qui regarde l’autre extrémité', () => {
    expect(nearestSide(a, { x: 700, y: 150 })).toBe('e');
    expect(nearestSide(a, { x: 200, y: 900 })).toBe('s');
    expect(nearestSide(a, { x: -50, y: 120 })).toBe('w');
    expect(nearestSide(a, { x: 220, y: -300 })).toBe('n');
  });
});

describe('géométrie dérivée', () => {
  const objects: BoardObject[] = [a, b];
  const c = newConnector('c', { objectId: 'a', side: 'auto' }, { objectId: 'b', side: 'auto' });

  it('part du côté est de a vers le côté ouest de b, en courbe', () => {
    const g = resolveConnector(c, objects);
    expect(g.side0).toBe('e');
    expect(g.side1).toBe('w');
    expect(g.p0).toEqual({ x: 300, y: 150 });
    expect(g.p1).toEqual({ x: 600, y: 350 });
    expect(g.path.startsWith('M300 150C')).toBe(true);
    expect(g.heads).toHaveLength(1);
  });

  it('suit la forme quand elle bouge, sans rien stocker', () => {
    const moved: BoardObject[] = [a, { ...b, x: 100, y: 500 }];
    const g = resolveConnector(c, moved);
    expect(g.side0).toBe('s');
    expect(g.side1).toBe('n');
    expect(g.p1).toEqual({ x: 200, y: 500 });
  });

  it('accepte une extrémité libre et une droite', () => {
    const g = resolveConnector({ ...c, to: { x: 400, y: 150 }, route: 'straight' }, objects);
    expect(g.path).toBe('M300 150L400 150');
    expect(g.mid).toEqual({ x: 350, y: 150 });
  });

  it('retombe sur sa boîte si l’objet a disparu', () => {
    const g = resolveConnector({ ...c, x: 10, y: 20, w: 30, h: 40 }, [a]);
    expect(g.p1).toEqual({ x: 40, y: 60 });
  });
});

describe('entretien des connecteurs', () => {
  const c = newConnector('c', { objectId: 'a', side: 'auto' }, { objectId: 'b', side: 'auto' });

  it('met à jour la boîte englobante et ne rend un nouveau tableau que si elle change', () => {
    const objects: BoardObject[] = [a, b, c];
    const fresh = refreshConnectors(objects);
    const cc = fresh[2];
    expect(cc.type).toBe('connector');
    expect(cc.w).toBeGreaterThan(0);
    expect(refreshConnectors(fresh)).toBe(fresh);
    expect(connectorBox(resolveConnector(c, objects)).x).toBeLessThanOrEqual(300);
  });

  it('supprime la flèche d’un objet supprimé, garde une flèche vers un objet jamais connu', () => {
    expect(dropOrphanConnectors([a, b, c], [a, c]).map((o) => o.id)).toEqual(['a']);
    const free = { ...c, id: 'd', to: { objectId: 'zz', side: 'auto' as const } };
    expect(dropOrphanConnectors([a, free], [a, free]).map((o) => o.id)).toEqual(['a', 'd']);
  });

  it('suit les identifiants recopiés', () => {
    const ids = new Map([['a', 'a2']]);
    const out = remapConnectorEnds(c, ids);
    expect(out.from).toEqual({ objectId: 'a2', side: 'auto' });
    expect(out.to).toEqual({ objectId: 'b', side: 'auto' });
  });
});
