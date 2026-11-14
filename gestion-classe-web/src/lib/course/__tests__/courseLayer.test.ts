import { describe, expect, it } from 'vitest';
import { anchorAt, localBox, placeAt, resolveY, simplify, type BlockBox, type LayerItem } from '../courseLayer';

const blocks: BlockBox[] = [
  { id: 'titre', top: 100, bottom: 140 },
  { id: 'p1', top: 150, bottom: 200 },
  { id: 'p2', top: 210, bottom: 260 },
];

describe('ancrage aux blocs', () => {
  it('le dernier bloc qui commence au-dessus du point', () => {
    expect(anchorAt(blocks, 180)).toEqual({ blockId: 'p1', dy: 30 });
    expect(anchorAt(blocks, 205)).toEqual({ blockId: 'p1', dy: 55 });
  });
  it('au-dessus du premier bloc : le premier bloc (décalage négatif)', () => {
    expect(anchorAt(blocks, 40)).toEqual({ blockId: 'titre', dy: -60 });
  });
  it('document vide : haut de la feuille', () => {
    expect(anchorAt([], 70)).toEqual({ blockId: '', dy: 70 });
  });
  it('le bloc descend (texte ajouté au-dessus) : l’annotation descend avec lui', () => {
    const it = { blockId: 'p1', dy: 30, y: 180 };
    expect(resolveY(it, new Map([['p1', 150]]))).toBe(180);
    expect(resolveY(it, new Map([['p1', 400]]))).toBe(430);
  });
  it('bloc supprimé : dernière position connue', () => {
    expect(resolveY({ blockId: 'disparu', dy: 30, y: 180 }, new Map())).toBe(180);
  });
  it('déplacer réancre au bloc d’arrivée', () => {
    const item: LayerItem = { id: 'a', kind: 'rect', color: '#000', size: 2, blockId: 'titre', dy: 5, x: 10, y: 105, w: 20, h: 10 };
    const moved = placeAt(item, 50, 230, blocks);
    expect(moved).toMatchObject({ x: 50, y: 230, blockId: 'p2', dy: 20 });
  });
});

describe('outils', () => {
  it('simplify garde les extrémités et retire les points trop serrés', () => {
    const pts: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [3, 0], [3.2, 0], [10, 0]];
    expect(simplify(pts)).toEqual([[0, 0], [3, 0], [10, 0]]);
  });
  it('boîte d’une flèche tracée vers le haut à gauche', () => {
    const item: LayerItem = { id: 'f', kind: 'arrow', color: '#000', size: 2, blockId: '', dy: 0, x: 0, y: 0, to: [-30, -20] };
    expect(localBox(item)).toEqual({ x: -30, y: -20, w: 30, h: 20 });
  });
});
