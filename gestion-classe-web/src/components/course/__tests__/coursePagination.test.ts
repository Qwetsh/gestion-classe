import { describe, expect, it } from 'vitest';
import { paginate, type Unit } from '../coursePagination';
import { CONTENT_H, MARGIN, PAGE_H, SHEET_GAP } from '../../../lib/course/coursePage';

const STRIDE = PAGE_H + SHEET_GAP;

/** Unités empilées de hauteur `h`, séparées par une marge basse `mb`. */
function stack(n: number, h: number, mb: number, extra: Partial<Unit> = {}, startPos = 0): Unit[] {
  return Array.from({ length: n }, (_, i) => ({ pos: startPos + i * 10, top: i * (h + mb), h, mt: 0, mb, type: 'paragraph', ...extra }));
}

describe('répartition en pages', () => {
  it('tout tient sur une page : aucun intercalaire', () => {
    const l = paginate(stack(10, 20, 8), SHEET_GAP);
    expect(l.pages).toBe(1);
    expect(l.spacers).toEqual([]);
  });

  it('60 éléments de liste se répartissent sur plusieurs pages sans dépasser le bas', () => {
    const units = stack(60, 26, 2, { type: 'paragraph' });
    const l = paginate(units, SHEET_GAP);
    expect(l.pages).toBe(2);
    expect(l.spacers).toHaveLength(1);
    const s = l.spacers[0];
    const idx = units.findIndex((u) => u.pos === s.pos);
    const prev = units[idx - 1];
    // Le dernier élément de la page 1 tient dans la hauteur utile, le suivant ne tiendrait pas
    expect(prev.top + prev.h).toBeLessThanOrEqual(CONTENT_H);
    expect(units[idx].top + units[idx].h).toBeGreaterThan(CONTENT_H);
    // L'élément renvoyé arrive pile en haut de la page 2
    expect(prev.top + prev.h + prev.mb + s.h).toBeCloseTo(STRIDE, 5);
    expect(s.cut).toBeUndefined();
  });

  it('dans un encadré, l’intercalaire porte la bande de bureau entre les deux feuilles', () => {
    const units = stack(40, 30, 0, { inBox: true });
    const l = paginate(units, SHEET_GAP);
    const s = l.spacers[0];
    expect(s.cut).toBeDefined();
    const idx = units.findIndex((u) => u.pos === s.pos);
    const start = units[idx - 1].top + units[idx - 1].h;
    expect(s.cut!.a).toBeCloseTo(PAGE_H - MARGIN - start, 5);
    expect(s.cut!.b - s.cut!.a).toBeCloseTo(SHEET_GAP, 5);
    expect(s.h - s.cut!.b).toBeCloseTo(MARGIN, 5);
  });

  it('à l’impression (sans espace entre les feuilles), la bande est vide', () => {
    const s = paginate(stack(40, 30, 0, { inBox: true }), 0).spacers[0];
    expect(s.cut!.b - s.cut!.a).toBeCloseTo(0, 5);
  });

  it('un titre en bas de page part avec le début du bloc suivant', () => {
    const units = stack(31, 30, 0);
    // Le 31e bloc (dernier qui tient) devient un titre suivi d'un paragraphe qui ne tient plus
    const title = units[30];
    title.type = 'heading';
    units.push({ pos: 999, top: title.top + title.h, h: 60, mt: 0, mb: 0, type: 'paragraph' });
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers[0].pos).toBe(title.pos);
  });

  it('une unité plus haute qu’une page déborde seule sans boucle', () => {
    const units: Unit[] = [
      { pos: 0, top: 0, h: 100, mt: 0, mb: 0, type: 'paragraph' },
      { pos: 10, top: 100, h: CONTENT_H * 1.5, mt: 0, mb: 0, type: 'table' },
      { pos: 20, top: 100 + CONTENT_H * 1.5, h: 20, mt: 0, mb: 0, type: 'paragraph' },
    ];
    const l = paginate(units, SHEET_GAP);
    expect(l.pages).toBeGreaterThanOrEqual(3);
  });

  it('saut de page : le bloc suivant commence la page d’après', () => {
    const units: Unit[] = [
      { pos: 0, top: 0, h: 20, mt: 0, mb: 0, type: 'paragraph' },
      { pos: 10, top: 20, h: 1, mt: 0, mb: 0, type: 'pageBreak' },
      { pos: 20, top: 21, h: 20, mt: 0, mb: 0, type: 'paragraph' },
    ];
    const l = paginate(units, SHEET_GAP);
    expect(l.pages).toBe(2);
    expect(l.spacers).toEqual([{ pos: 20, h: STRIDE - 21 }]);
  });
});
