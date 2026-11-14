import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { courseExtensions } from '../courseExtensions';
import { rescaleToColumn } from '../courseTable';
import { activityCartouche } from '../courseBlocks';
import { COL_W, pageGeometry } from '../../../lib/course/coursePage';

const noop = () => undefined;
const schema = getSchema(courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }));

/** Largeur de chaque ligne du tableau (somme des colwidth de ses cellules, fusion verticale comprise). */
function rowWidths(state: EditorState): number[] {
  const table = state.doc.firstChild!.type.name === 'table' ? state.doc.firstChild! : state.doc.child(1);
  const widths: number[] = [];
  table.forEach((row) => { let w = 0; row.forEach((c) => { w += (c.attrs.colwidth as number[]).reduce((a, b) => a + b, 0); }); widths.push(w); });
  return widths;
}

describe('marges du cours', () => {
  it('géométrie : étroites = colonne de 17 cm, page plus haute', () => {
    const n = pageGeometry(undefined);
    const e = pageGeometry('etroites');
    expect(n.colW).toBeCloseTo(COL_W);
    expect(e.colW).toBeCloseTo(642.5, 0);
    expect(e.contentH - n.contentH).toBeCloseTo(2 * (94.49 - 56.69), 0);
  });

  it('le cartouche (fusion sur 6 lignes) suit la colonne, dans les deux sens', () => {
    const narrow = pageGeometry('etroites').colW;
    const doc = schema.nodeFromJSON({ type: 'doc', content: activityCartouche(narrow) });
    let state = EditorState.create({ doc });
    // Première ligne : toute la largeur ; les suivantes sans la colonne fusionnée
    const before = rowWidths(state);
    expect(before[0]).toBeCloseTo(narrow, -1);
    state = state.apply(rescaleToColumn(state, narrow, COL_W)!);
    const after = rowWidths(state);
    expect(after[0]).toBeCloseTo(COL_W, -1);
    after.forEach((w, i) => expect(w / before[i]).toBeCloseTo(COL_W / narrow, 2));
    state = state.apply(rescaleToColumn(state, COL_W, narrow)!);
    expect(rowWidths(state)[0]).toBeCloseTo(narrow, -1);
  });

  it('un tableau plus étroit que la colonne ne bouge pas', () => {
    const cell = { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: [200] }, content: [{ type: 'paragraph' }] };
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell, cell] }] }] });
    expect(rescaleToColumn(EditorState.create({ doc }), COL_W, pageGeometry('etroites').colW)).toBeNull();
  });
});
