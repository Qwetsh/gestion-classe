import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Editor, type JSONContent } from '@tiptap/core';
import { courseExtensions } from '../courseExtensions';
import { fitLegacyTables } from '../courseTable';
import { COL_W, CONTENT_H, LEGACY_COL_W, MARGIN, PAGE_H, PAGE_W } from '../../../lib/course/coursePage';

const noop = () => undefined;
const cell = (colwidth: number[], rowspan = 1): JSONContent => ({ type: 'tableCell', attrs: { colspan: colwidth.length, rowspan, colwidth }, content: [{ type: 'paragraph' }] });
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells });
const table = (...rows: JSONContent[]): JSONContent => ({ type: 'table', content: rows });
const doc = (...blocks: JSONContent[]): JSONContent => ({ type: 'doc', content: blocks });
/** Somme des largeurs de la première ligne. */
const firstRowTotal = (t: JSONContent) => (t.content![0].content ?? []).flatMap((c) => c.attrs!.colwidth as number[]).reduce((a, b) => a + b, 0);

describe('marges de 1,5 cm', () => {
  it('colonne de 18 cm et page utile', () => {
    expect(Math.abs(MARGIN * 25.4 / 96 - 15)).toBeLessThan(0.1);
    expect(Math.abs(COL_W * 25.4 / 96 - 180)).toBeLessThan(0.2);
    // Un tableau de Math.floor(COL_W) px plus sa bordure de 1 px tient dans la colonne arrondie
    expect(Math.floor(COL_W) + 1).toBeLessThanOrEqual(Math.round(COL_W));
    expect(CONTENT_H).toBeCloseTo(PAGE_H - 2 * MARGIN, 5);
    expect(LEGACY_COL_W).toBeCloseTo(604.72, 2);
  });

  it('les valeurs en dur de course.css suivent coursePage.ts (image page entière, en-tête et pied)', () => {
    const css = readFileSync(resolve(__dirname, '../course.css'), 'utf8');
    const px = (v: number) => `${Math.round(v * 100) / 100}px`;
    expect(css).toContain(`.ce-img.ce-img--page { display: block; position: relative; margin: 0; height: ${px(CONTENT_H)}; }`);
    expect(css).toContain(`.ce-img__page { position: absolute; left: -${px(MARGIN)}; top: -${px(MARGIN)}; width: ${px(PAGE_W)}; height: ${px(PAGE_H)};`);
    expect(css).toContain(`.ce-hf { position: absolute; left: ${px(MARGIN)}; right: ${px(MARGIN)};`);
    // Projeté en bande : la page entière est ramenée à la largeur de la colonne
    const scale = Number(/\.ce-pres \.ce-img__page \{[^}]*scale\(([\d.]+)\)/.exec(css)?.[1]);
    expect(scale).toBeCloseTo(COL_W / PAGE_W, 3);
  });
});

describe('tableaux écrits pour la colonne de 2,5 cm', () => {
  it('un tableau pleine largeur (604 px) est élargi à la colonne, proportions gardées', () => {
    // Cartouche de la skill : largeurs(17.6, 11, 23.7, 23.7, 24) sur 604,72 px, bandeau fusionné sur 2 lignes
    const t = table(row(cell([106], 2), cell([66]), cell([143, 143, 146])), row(cell([66, 143]), cell([143, 146])));
    const out = fitLegacyTables(doc(t));
    const w = out.content![0];
    expect(firstRowTotal(w)).toBeGreaterThanOrEqual(COL_W - 3);
    expect(firstRowTotal(w)).toBeLessThanOrEqual(COL_W + 1);
    const first = w.content![0].content!.flatMap((c) => c.attrs!.colwidth as number[]);
    expect(first[0] / first[2]).toBeCloseTo(106 / 143, 1);
    // La deuxième ligne garde les mêmes colonnes
    expect(w.content![1].content![0].attrs!.colwidth).toEqual([first[1], first[2]]);
    expect(w.content![1].content![1].attrs!.colwidth).toEqual([first[3], first[4]]);
  });

  it('604,72 (bouton 100 %) et 605 (arrondi) comptent aussi comme pleine largeur', () => {
    for (const ws of [[302.36, 302.36], [303, 302]]) {
      const out = fitLegacyTables(doc(table(row(cell([ws[0]]), cell([ws[1]])))));
      expect(firstRowTotal(out.content![0])).toBeCloseTo(COL_W, -1);
    }
  });

  it('les autres tableaux, les tableaux déjà à 18 cm et ceux d’un encadré ne bougent pas', () => {
    const half = table(row(cell([150]), cell([152])));
    const full = table(row(cell([340]), cell([340])));
    const noWidth = table(row({ type: 'tableCell', content: [{ type: 'paragraph' }] }));
    const inCallout = { type: 'callout', content: [table(row(cell([302]), cell([302])))] };
    const d = doc(half, full, noWidth, inCallout);
    expect(fitLegacyTables(d)).toBe(d);
  });

  it('l’éditeur élargit les tableaux du document qu’on lui donne', () => {
    const editor = new Editor({
      extensions: courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }),
      content: doc(table(row(cell([302]), cell([302])))),
    });
    const t = editor.getJSON().content!.find((b) => b.type === 'table')!;
    expect(firstRowTotal(t)).toBeGreaterThan(LEGACY_COL_W + 50);
  });
});
