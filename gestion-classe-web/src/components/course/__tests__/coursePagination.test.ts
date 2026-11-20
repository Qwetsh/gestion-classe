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

  it('tableau coupé : ligne fantôme, puis la ligne suivante sous l’en-tête répété', () => {
    const row = { cols: 3, headPos: 1, headH: 30 };
    const units: Unit[] = [
      { pos: 0, top: 0, h: 60, mt: 4, mb: 12, type: 'tableRow' },
      ...Array.from({ length: 39 }, (_, i) => ({ pos: 100 + i * 10, top: 60 + i * 28, h: 28, mt: 0, mb: 0, type: 'tableRow', row })),
    ];
    units[units.length - 1].mb = 12;
    const l = paginate(units, SHEET_GAP);
    const s = l.spacers[0];
    expect(s.row).toEqual(row);
    expect(s.cut).toBeDefined();
    const idx = units.findIndex((u) => u.pos === s.pos);
    const prev = units[idx - 1];
    expect(prev.top + prev.h).toBeLessThanOrEqual(CONTENT_H);
    expect(prev.top + prev.h + s.h).toBeCloseTo(STRIDE, 5);
    expect(l.pages).toBe(2);
  });

  it('la place de l’en-tête répété est comptée : moins de lignes de données sur la page suivante', () => {
    const make = (row: Unit['row']): Unit[] => [
      { pos: 0, top: 0, h: 60, mt: 0, mb: 0, type: 'tableRow' },
      ...Array.from({ length: 79 }, (_, i) => ({ pos: 100 + i * 10, top: 60 + i * 28, h: 28, mt: 0, mb: 0, type: 'tableRow', row })),
    ];
    const withHead = paginate(make({ cols: 3, headPos: 1, headH: 56 }), SHEET_GAP);
    const without = paginate(make({ cols: 3, headPos: null, headH: 0 }), SHEET_GAP);
    expect(withHead.spacers[0].pos).toBe(without.spacers[0].pos);
    expect(withHead.spacers[1].pos).toBe(without.spacers[1].pos - 20);
  });
});

describe('paragraphe qui se coupe (T15c)', () => {
  const LH = 20;
  /** Un paragraphe de `n` lignes de 20 px dont le haut est à `top`, précédé d'un bloc qui le descend jusque-là. */
  function withPara(top: number, n: number, ok: (j: number) => boolean = () => true): { units: Unit[]; para: Unit } {
    const filler: Unit = { pos: 0, top: 0, h: top, mt: 0, mb: 0, type: 'paragraph' };
    const para: Unit = {
      pos: 100, top, h: n * LH, mt: 0, mb: 0, type: 'paragraph',
      lines: Array.from({ length: n }, (_, j) => ({ pos: 101 + j * 30, top: top + j * LH, ok: j > 0 && ok(j) })),
    };
    return { units: [filler, para], para };
  }

  it('coupe au début de la dernière ligne qui tient, le reste arrive en haut de la page suivante', () => {
    const { units, para } = withPara(CONTENT_H - 5 * LH, 12);
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers).toHaveLength(1);
    const s = l.spacers[0];
    expect(s.inline).toBe(true);
    expect(s.pos).toBe(para.lines![5].pos); // 5 lignes en bas de la page 1
    expect(s.pos).not.toBe(para.pos);
    expect(s.h).toBeCloseTo(STRIDE - CONTENT_H, 5);
    expect(l.pages).toBe(2);
  });

  it('jamais moins de deux lignes de chaque côté (veuves)', () => {
    // 6 lignes, dont 5 tiennent : on coupe à la ligne 4 pour garder deux lignes en haut de la page suivante
    const { units, para } = withPara(CONTENT_H - 5 * LH, 6);
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers[0].pos).toBe(para.lines![4].pos);
  });

  it('une seule ligne tiendrait en bas de page : le paragraphe passe entier à la suivante (orphelines)', () => {
    const { units, para } = withPara(CONTENT_H - LH, 12);
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers).toHaveLength(1);
    expect(l.spacers[0].inline).toBeUndefined();
    expect(l.spacers[0].pos).toBe(para.pos);
  });

  it('ne coupe pas au milieu d’un mot', () => {
    // la ligne 5 est un mot coupé par la césure : on coupe avant, à la ligne 4
    const { units, para } = withPara(CONTENT_H - 5 * LH, 12, (j) => j !== 5);
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers[0].pos).toBe(para.lines![4].pos);
  });

  it('un paragraphe de plus d’une page se coupe autant de fois qu’il le faut', () => {
    const { units } = withPara(0, 120); // 2 400 px : plus de deux pages
    const l = paginate(units, SHEET_GAP);
    expect(l.spacers.length).toBeGreaterThanOrEqual(2);
    expect(l.spacers.every((s) => s.inline)).toBe(true);
    expect(l.pages).toBeGreaterThanOrEqual(3);
  });

  it('un paragraphe qui tient n’est pas touché', () => {
    const { units } = withPara(100, 12);
    expect(paginate(units, SHEET_GAP).spacers).toEqual([]);
  });

  it('le bloc suivant se range après la dernière coupure', () => {
    const { units, para } = withPara(CONTENT_H - 5 * LH, 12);
    const after: Unit = { pos: 500, top: para.top + para.h, h: 30, mt: 0, mb: 0, type: 'paragraph' };
    const l = paginate([...units, after], SHEET_GAP);
    // 7 lignes restantes en haut de la page 2, puis le bloc : aucun autre intercalaire
    expect(l.spacers).toHaveLength(1);
  });
});

