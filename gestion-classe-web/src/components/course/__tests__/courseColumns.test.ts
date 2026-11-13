import { describe, expect, it } from 'vitest';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { getSchema, Node } from '@tiptap/core';
import { EditorState, NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { Column, Columns, findColumns, type ColumnsLayout } from '../courseColumns';
import { flipCrop, rotateCrop } from '../courseImageTypes';

const Img = Node.create({ name: 'image', group: 'block', atom: true, addAttributes: () => ({ path: { default: null } }) });
const schema = getSchema([Document, Paragraph, Text, Img, Columns, Column]);

type Cmd = (props: { state: EditorState; tr: Transaction; dispatch?: (tr: Transaction) => void }) => boolean;
const cmds = (Columns.config.addCommands as () => Record<string, (...a: unknown[]) => Cmd>).call({} as never);

function run(state: EditorState, name: string, ...args: unknown[]): EditorState {
  let next = state;
  const tr = state.tr;
  const ok = cmds[name](...args)({ state, tr, dispatch: (t) => { next = state.apply(t); } });
  expect(ok).toBe(true);
  return next;
}

const p = (t?: string) => schema.nodes.paragraph.create(null, t ? schema.text(t) : null);
const json = (s: EditorState) => s.doc.toJSON() as { content: Array<{ type: string; attrs?: { layout?: ColumnsLayout }; content?: Array<{ content?: unknown[] }> }> };

describe('colonnes', () => {
  it('insère deux colonnes au curseur, curseur dans la première', () => {
    const doc = schema.nodes.doc.create(null, [p('avant')]);
    let s = EditorState.create({ doc, selection: TextSelection.create(doc, 7) });
    s = run(s, 'insertColumns', '1-1');
    const cols = json(s).content.find((n) => n.type === 'columns')!;
    expect(cols.attrs?.layout).toBe('1-1');
    expect(cols.content).toHaveLength(2);
    expect(findColumns(s)).not.toBeNull();
  });

  it('image sélectionnée : elle va dans la première colonne', () => {
    const doc = schema.nodes.doc.create(null, [p('a'), schema.nodes.image.create({ path: 'x.png' }), p('b')]);
    let s = EditorState.create({ doc, selection: NodeSelection.create(doc, 3) });
    s = run(s, 'insertColumns', '1-2');
    const cols = s.doc.child(1);
    expect(cols.type.name).toBe('columns');
    expect(cols.child(0).firstChild!.type.name).toBe('image');
    // plus d'image hors des colonnes
    let outside = 0;
    s.doc.forEach((n) => { if (n.type.name === 'image') outside++; });
    expect(outside).toBe(0);
  });

  it('pas de colonnes dans des colonnes', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.columns.create(null, [schema.nodes.column.create(null, p('x')), schema.nodes.column.create(null, p('y'))])]);
    const s = EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
    expect(cmds.insertColumns('1-1')({ state: s, tr: s.tr })).toBe(false);
  });

  it('passer de 3 à 2 colonnes garde le texte de la 3e', () => {
    const col = (t: string) => schema.nodes.column.create(null, p(t));
    const doc = schema.nodes.doc.create(null, [schema.nodes.columns.create({ layout: '1-1-1' }, [col('un'), col('deux'), col('trois')])]);
    let s = EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
    s = run(s, 'setColumnsLayout', '1-1');
    const cols = s.doc.child(0);
    expect(cols.childCount).toBe(2);
    expect(cols.child(1).textContent).toBe('deuxtrois');
    s = run(s, 'setColumnsLayout', '1-1-1');
    expect(s.doc.child(0).childCount).toBe(3);
  });

  it('curseur dans la 3e colonne retirée : il reste dans les colonnes', () => {
    const col = (t: string) => schema.nodes.column.create(null, p(t));
    const doc = schema.nodes.doc.create(null, [schema.nodes.columns.create({ layout: '1-1-1' }, [col('un'), col('deux'), col('trois')])]);
    const inThird = doc.child(0).child(0).nodeSize + doc.child(0).child(1).nodeSize + 4;
    let s = EditorState.create({ doc, selection: TextSelection.create(doc, inThird) });
    s = run(s, 'setColumnsLayout', '1-1');
    expect(findColumns(s)).not.toBeNull();
  });

  it('retirer les colonnes garde tout le contenu, à la suite', () => {
    const col = (t: string) => schema.nodes.column.create(null, p(t));
    const doc = schema.nodes.doc.create(null, [p('avant'), schema.nodes.columns.create(null, [col('gauche'), col('droite')])]);
    let s = EditorState.create({ doc, selection: TextSelection.create(doc, 12) });
    s = run(s, 'unsetColumns');
    expect(s.doc.childCount).toBe(3);
    expect(s.doc.textContent).toBe('avantgauchedroite');
  });
});

describe('rognage et rotation', () => {
  const c = { t: 0.1, r: 0.2, b: 0.3, l: 0.4 };
  it('quatre quarts de tour reviennent au départ', () => {
    let x: typeof c | null = c;
    for (let i = 0; i < 4; i++) x = rotateCrop(x, true);
    expect(x).toEqual(c);
  });
  it('un quart à droite puis à gauche reviennent au départ', () => {
    expect(rotateCrop(rotateCrop(c, true), false)).toEqual(c);
  });
  it('à droite : le côté gauche passe en haut', () => {
    expect(rotateCrop(c, true)).toEqual({ t: 0.4, r: 0.1, b: 0.2, l: 0.3 });
  });
  it('miroir : gauche et droite échangés', () => {
    expect(flipCrop(c)).toEqual({ t: 0.1, r: 0.4, b: 0.3, l: 0.2 });
  });
  it('sans rognage : rien', () => {
    expect(rotateCrop(null, true)).toBeNull();
    expect(flipCrop(null)).toBeNull();
  });
});
