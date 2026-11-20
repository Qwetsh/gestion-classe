import { describe, expect, it } from 'vitest';
import { Schema, type Node as PMNode } from '@tiptap/pm/model';
import { extendRange, isNumberedQuestion, pickLevels, pickedContent } from '../activityBlocks';

/** Un schéma minimal aux noms de nœuds de l'éditeur de cours. */
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    hardBreak: { inline: true, group: 'inline', selectable: false },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block', attrs: { level: { default: 2 } } },
    image: { group: 'block', atom: true, attrs: { path: { default: null }, src: { default: null }, alt: { default: null } } },
    bulletList: { content: 'listItem+', group: 'block' },
    orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } } },
    listItem: { content: 'paragraph block*' },
    callout: { content: 'block+', group: 'block' },
    table: { content: 'tableRow+', group: 'block' },
    tableRow: { content: '(tableCell | tableHeader)+' },
    tableCell: { content: 'block+' },
    tableHeader: { content: 'block+' },
  },
  marks: {
    bold: {}, italic: {}, underline: {},
    textStyle: { attrs: { color: { default: null } } },
  },
});

const t = (text: string, ...marks: [string, Record<string, unknown>?][]) => schema.text(text, marks.map(([m, a]) => schema.marks[m].create(a)));
const p = (...c: (PMNode | string)[]) => schema.nodes.paragraph.create(null, c.map((x) => (typeof x === 'string' ? schema.text(x) : x)));
const doc = (...c: PMNode[]) => schema.nodes.doc.create(null, c);

/** Début et fin du nœud n°`index` du document. */
const span = (d: PMNode, index: number) => { let from = 0; for (let i = 0; i < index; i++) from += d.child(i).nodeSize; return { from, to: from + d.child(index).nodeSize }; };

describe('pickLevels', () => {
  it('un toucher dans un paragraphe choisit ce paragraphe', () => {
    const d = doc(p('Un'), p('Deux'), p('Trois'));
    const { from, to } = span(d, 1);
    expect(pickLevels(d, from + 2)).toEqual([{ from, to, label: 'Paragraphe' }]);
  });

  it('une image se choisit par sa position, sans texte', () => {
    const d = doc(p('Avant'), schema.nodes.image.create({ path: 'a/b.png' }), p('Après'));
    const img = span(d, 1);
    expect(pickLevels(d, img.from, img.from)[0]).toEqual({ ...img, label: 'Image' });
  });

  it('dans une liste : le paragraphe, puis l’élément, puis toute la liste', () => {
    const li = (s: string) => schema.nodes.listItem.create(null, [p(s)]);
    const d = doc(schema.nodes.bulletList.create(null, [li('a'), li('b'), li('c')]));
    // « b » : liste (1) › élément 2 › paragraphe › texte
    const inside = 1 + span(d.child(0), 1).from + 2;
    const levels = pickLevels(d, inside);
    expect(levels.map((l) => l.label)).toEqual(['Paragraphe', 'Élément de liste', 'Liste']);
    expect(levels[2]).toEqual({ from: 0, to: d.content.size, label: 'Liste' });
  });

  it('dans un tableau : le paragraphe, la cellule, la ligne, le tableau', () => {
    const cell = (s: string) => schema.nodes.tableCell.create(null, [p(s)]);
    const row = (a: string, b: string) => schema.nodes.tableRow.create(null, [cell(a), cell(b)]);
    const d = doc(schema.nodes.table.create(null, [row('a', 'b'), row('c', 'd')]));
    // « d » est le dernier caractère : table › ligne › cellule › paragraphe › texte
    const pos = d.content.size - 5;
    expect(pickLevels(d, pos).map((l) => l.label)).toEqual(['Paragraphe', 'Cellule', 'Ligne', 'Tableau']);
  });

  it('un paragraphe numéroté s’élargit à la question entière, jusqu’à la suivante', () => {
    const d = doc(p('1. Compare les deux éruptions.'), p('Aide : regarde le tableau.'), schema.nodes.image.create({ path: 'x.png' }), p('2. Explique.'), p('Fin'));
    const first = span(d, 0);
    const levels = pickLevels(d, first.from + 3);
    expect(levels.map((l) => l.label)).toEqual(['Paragraphe', 'Question']);
    expect(levels[1].to).toBe(span(d, 2).to);
    expect(isNumberedQuestion(d.child(3))).toBe(true);
  });

  it('une question d’un seul bloc ne propose pas de niveau en double', () => {
    const d = doc(p('1. Seule.'), p('2. Autre.'));
    expect(pickLevels(d, 3).map((l) => l.label)).toEqual(['Paragraphe']);
  });

  it('un encadré : le paragraphe, puis l’encadré', () => {
    const d = doc(schema.nodes.callout.create(null, [p('Rappel : le magma…'), p('Suite')]));
    expect(pickLevels(d, 4).map((l) => l.label)).toEqual(['Paragraphe', 'Encadré']);
  });
});

describe('extendRange', () => {
  it('ajoute les blocs suivants, sans dépasser la fin', () => {
    const d = doc(p('a'), p('b'), p('c'));
    const first = { ...span(d, 0), label: 'Paragraphe' };
    expect(extendRange(d, first, 1).to).toBe(span(d, 1).to);
    expect(extendRange(d, first, 9).to).toBe(d.content.size);
  });

  it('au bout du document, la sélection ne bouge pas', () => {
    const d = doc(p('a'));
    const r = { ...span(d, 0), label: 'Paragraphe' };
    expect(extendRange(d, r, 3)).toBe(r);
  });
});

describe('pickedContent', () => {
  it('garde le gras et la couleur, pas la taille', () => {
    const d = doc(p('Le ', t('magma', ['bold']), ' est ', t('chaud', ['textStyle', { color: '#C00000' }]), '.'));
    const c = pickedContent(d, { ...span(d, 0), label: 'Paragraphe' });
    expect(c.html).toBe('<div>Le <b>magma</b> est <span style="color: #C00000">chaud</span>.</div>');
    expect(c.text).toBe('Le magma est chaud.');
    expect(c.table).toBeNull();
  });

  it('échappe le HTML du texte', () => {
    const d = doc(p('a < b & c'));
    expect(pickedContent(d, { ...span(d, 0), label: 'Paragraphe' }).html).toBe('<div>a &lt; b &amp; c</div>');
  });

  it('numérote les listes ordonnées et met des puces aux autres', () => {
    const li = (s: string) => schema.nodes.listItem.create(null, [p(s)]);
    const d = doc(schema.nodes.orderedList.create({ start: 3 }, [li('x'), li('y')]), schema.nodes.bulletList.create(null, [li('z')]));
    expect(pickedContent(d, { from: 0, to: d.content.size, label: 'Liste' }).html).toBe('<div>3.&nbsp;x</div><div>4.&nbsp;y</div><div>•&nbsp;z</div>');
  });

  it('un tableau choisi seul devient un tableau du tableau blanc, première ligne en en-tête', () => {
    const cell = (s: string, header = false) => schema.nodes[header ? 'tableHeader' : 'tableCell'].create(null, [p(s)]);
    const d = doc(schema.nodes.table.create(null, [
      schema.nodes.tableRow.create(null, [cell('Critère', true), cell('Effusif', true)]),
      schema.nodes.tableRow.create(null, [cell('Gaz'), cell('peu')]),
    ]));
    const c = pickedContent(d, { from: 0, to: d.content.size, label: 'Tableau' });
    expect(c.table).toEqual({ cells: [['Critère', 'Effusif'], ['Gaz', 'peu']], header: true });
    expect(c.html).toBe('');
  });

  it('un tableau au milieu d’autres blocs devient des lignes de texte', () => {
    const cell = (s: string) => schema.nodes.tableCell.create(null, [p(s)]);
    const d = doc(p('Avant'), schema.nodes.table.create(null, [schema.nodes.tableRow.create(null, [cell('a'), cell('b')])]));
    const c = pickedContent(d, { from: 0, to: d.content.size, label: 'Paragraphe' });
    expect(c.table).toBeNull();
    expect(c.html).toBe('<div>Avant</div><div>a | b</div>');
  });

  it('range les images à part, avec leur chemin', () => {
    const d = doc(p('Légende'), schema.nodes.image.create({ path: 'cours/x.png', alt: 'Schéma' }));
    const c = pickedContent(d, { from: 0, to: d.content.size, label: 'Paragraphe' });
    expect(c.images).toEqual([{ path: 'cours/x.png', src: null, alt: 'Schéma' }]);
    expect(c.html).toBe('<div>Légende</div>');
  });
});
