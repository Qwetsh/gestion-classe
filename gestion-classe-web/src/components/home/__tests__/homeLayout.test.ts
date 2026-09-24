import { describe, it, expect } from 'vitest';
import {
  compactLayout,
  mergeLayout,
  readingOrder,
  itemPixelHeight,
  DEFAULT_HOME_LAYOUT,
  HOME_LAYOUT_VERSION,
  HOME_ROW_HEIGHT,
  HOME_GAP,
  type HomeLayoutItem,
} from '../homeLayout';

describe('compactLayout', () => {
  it('remonte un module quand rien ne le retient', () => {
    const items: HomeLayoutItem[] = [{ i: 'a', x: 0, y: 5, w: 4, h: 2 }];
    expect(compactLayout(items)[0].y).toBe(0);
  });

  it('empile deux modules de la même colonne sans les faire se chevaucher', () => {
    const items: HomeLayoutItem[] = [
      { i: 'a', x: 0, y: 0, w: 6, h: 3 },
      { i: 'b', x: 0, y: 9, w: 6, h: 2 },
    ];
    const out = compactLayout(items);
    expect(out.find(i => i.i === 'b')!.y).toBe(3);
  });

  it('laisse deux colonnes indépendantes remonter chacune de leur côté', () => {
    const items: HomeLayoutItem[] = [
      { i: 'gauche', x: 0, y: 0, w: 8, h: 10 },
      { i: 'droite', x: 8, y: 6, w: 4, h: 3 },
    ];
    const out = compactLayout(items);
    expect(out.find(i => i.i === 'droite')!.y).toBe(0);
    expect(out.find(i => i.i === 'gauche')!.y).toBe(0);
  });

  it('comble le trou laissé par un module retiré', () => {
    const items: HomeLayoutItem[] = [
      { i: 'a', x: 0, y: 0, w: 12, h: 3 },
      // le module qui occupait y=3..7 a disparu
      { i: 'c', x: 0, y: 8, w: 12, h: 4 },
    ];
    expect(compactLayout(items).find(i => i.i === 'c')!.y).toBe(3);
  });

  it('ne modifie pas le tableau reçu', () => {
    const items: HomeLayoutItem[] = [{ i: 'a', x: 0, y: 7, w: 4, h: 2 }];
    compactLayout(items);
    expect(items[0].y).toBe(7);
  });
});

describe('mergeLayout', () => {
  const ids = DEFAULT_HOME_LAYOUT.items.map(i => i.i);

  it('retombe sur les défauts quand rien n’est enregistré', () => {
    const out = mergeLayout(null, ids);
    expect(out.items).toHaveLength(DEFAULT_HOME_LAYOUT.items.length);
    expect(out.version).toBe(HOME_LAYOUT_VERSION);
  });

  it('retombe sur les défauts quand la version enregistrée est périmée', () => {
    const stale = { version: 0, hidden: [], items: [{ i: 'boards', x: 0, y: 0, w: 4, h: 4 }] };
    expect(mergeLayout(stale, ids).items).toHaveLength(DEFAULT_HOME_LAYOUT.items.length);
  });

  it('ignore un module qui n’existe plus dans le code', () => {
    const saved = {
      version: HOME_LAYOUT_VERSION,
      hidden: [],
      items: [
        { i: 'boards', x: 0, y: 0, w: 4, h: 4 },
        { i: 'module-supprime', x: 4, y: 0, w: 4, h: 4 },
      ],
    };
    const out = mergeLayout(saved, ['boards']);
    expect(out.items.map(i => i.i)).toEqual(['boards']);
  });

  it('ajoute en bas un module livré après la personnalisation', () => {
    const saved = {
      version: HOME_LAYOUT_VERSION,
      hidden: [],
      items: [{ i: 'boards', x: 0, y: 0, w: 4, h: 4 }],
    };
    const out = mergeLayout(saved, ['boards', 'nouveau']);
    const nouveau = out.items.find(i => i.i === 'nouveau');
    expect(nouveau).toBeDefined();
    expect(nouveau!.y).toBeGreaterThanOrEqual(0);
  });

  it('respecte les modules masqués, y compris les nouveaux', () => {
    const saved = {
      version: HOME_LAYOUT_VERSION,
      hidden: ['timetable'],
      items: [{ i: 'boards', x: 0, y: 0, w: 4, h: 4 }],
    };
    const out = mergeLayout(saved, ['boards', 'timetable']);
    expect(out.items.map(i => i.i)).not.toContain('timetable');
    expect(out.hidden).toEqual(['timetable']);
  });

  it('oublie un masquage qui vise un module disparu', () => {
    const saved = {
      version: HOME_LAYOUT_VERSION,
      hidden: ['module-supprime'],
      items: [{ i: 'boards', x: 0, y: 0, w: 4, h: 4 }],
    };
    expect(mergeLayout(saved, ['boards']).hidden).toEqual([]);
  });
});

describe('readingOrder', () => {
  it('ordonne de haut en bas puis de gauche à droite', () => {
    const items: HomeLayoutItem[] = [
      { i: 'bas', x: 0, y: 5, w: 4, h: 2 },
      { i: 'haut-droite', x: 8, y: 0, w: 4, h: 2 },
      { i: 'haut-gauche', x: 0, y: 0, w: 8, h: 2 },
    ];
    expect(readingOrder(items).map(i => i.i)).toEqual(['haut-gauche', 'haut-droite', 'bas']);
  });
});

describe('itemPixelHeight', () => {
  it('compte les gouttières entre les rangées', () => {
    expect(itemPixelHeight(1)).toBe(HOME_ROW_HEIGHT);
    expect(itemPixelHeight(3)).toBe(3 * HOME_ROW_HEIGHT + 2 * HOME_GAP);
  });
});
