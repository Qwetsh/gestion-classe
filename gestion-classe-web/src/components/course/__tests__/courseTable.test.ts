import { describe, expect, it } from 'vitest';
import { getSchema, type JSONContent } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { courseExtensions } from '../courseExtensions';
import { applyColumnWidths } from '../courseTable';

const noop = () => undefined;
const schema = getSchema(courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }));

const cell = (colwidth: number[], rowspan = 1): JSONContent => ({ type: 'tableCell', attrs: { colspan: colwidth.length, rowspan, colwidth }, content: [{ type: 'paragraph' }] });
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells });

/** Largeurs (colwidth) de chaque ligne, cellule par cellule. */
const widthsByRow = (table: PMNode) => {
  const out: number[][][] = [];
  table.forEach((r) => { const line: number[][] = []; r.forEach((c) => line.push(c.attrs.colwidth as number[])); out.push(line); });
  return out;
};

describe('largeurs des colonnes d’un tableau', () => {
  it('une cellule fusionnée sur trois lignes ne décale pas les largeurs des lignes suivantes', () => {
    // Colonne 0 fusionnée sur 3 lignes (comme le bandeau du cartouche), puis colonnes 1 à 3
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
      row(cell([100], 3), cell([100, 100]), cell([100])),
      row(cell([100]), cell([100, 100])),
      row(cell([100, 100, 100])),
    ] }] });
    const state = EditorState.create({ doc });
    const tr = state.tr;
    applyColumnWidths(tr, 0, doc.firstChild!, [50, 150, 200, 250]);
    const w = widthsByRow(tr.doc.firstChild!);
    expect(w[0]).toEqual([[50], [150, 200], [250]]);
    expect(w[1]).toEqual([[150], [200, 250]]);
    expect(w[2]).toEqual([[150, 200, 250]]);
  });

  it('un tableau sans fusion garde le comportement d’avant', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [row(cell([10]), cell([10])), row(cell([10, 10]))] }] });
    const tr = EditorState.create({ doc }).tr;
    applyColumnWidths(tr, 0, doc.firstChild!, [120, 80]);
    expect(widthsByRow(tr.doc.firstChild!)).toEqual([[[120], [80]], [[120, 80]]]);
  });
});
