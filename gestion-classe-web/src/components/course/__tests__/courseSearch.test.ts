import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { adaptCase, findInDoc, findInText, foldText } from '../courseSearch';
import { outlineOf } from '../courseHeadings';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    text: { group: 'inline' },
    image: { group: 'inline', inline: true },
  },
  marks: { bold: {} },
});

describe('findInText', () => {
  it('ignore accents et majuscules par défaut', () => {
    expect(findInText('Une Évaluation, deux évaluations', 'evaluation')).toEqual([[4, 14], [21, 31]]);
  });
  it('respecte majuscules et accents sur demande', () => {
    expect(findInText('Une Évaluation, deux évaluations', 'évaluation', { caseSensitive: true, wholeWord: false })).toEqual([[21, 31]]);
  });
  it('mot entier', () => {
    expect(findInText('cellule, cellules, unicellulaire', 'cellule', { caseSensitive: false, wholeWord: true })).toEqual([[0, 7]]);
  });
  it('requête vide : rien', () => {
    expect(findInText('abc', '')).toEqual([]);
  });
  it('garde la longueur du texte (positions alignées)', () => {
    const s = 'Œuvre ÉCOLE ﬁn 😀 été';
    expect(foldText(s).length).toBe(s.length);
  });
  it('occurrences qui se chevauchent : on avance après chaque résultat', () => {
    expect(findInText('aaaa', 'aa')).toEqual([[0, 2], [2, 4]]);
  });
});

describe('findInDoc', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('La '), schema.text('photo', [schema.mark('bold')]), schema.text('synthèse')]),
    schema.node('paragraph', null, [schema.text('photo'), schema.node('image'), schema.text('synthese')]),
  ]);
  it('trouve un mot à cheval sur deux mises en forme', () => {
    const m = findInDoc(doc, 'photosynthese', { caseSensitive: false, wholeWord: false });
    expect(m).toHaveLength(1);
    expect(doc.textBetween(m[0].from, m[0].to)).toBe('photosynthèse');
  });
  it('une image coupe la recherche', () => {
    // « photo » seul n'est un mot entier que dans le 2e paragraphe (suivi de l'image)
    expect(findInDoc(doc, 'photo', { caseSensitive: false, wholeWord: true })).toHaveLength(1);
    expect(findInDoc(doc, 'photo', { caseSensitive: false, wholeWord: false })).toHaveLength(2);
    expect(findInDoc(doc, 'photosynthese', { caseSensitive: false, wholeWord: false })).toHaveLength(1);
  });
});

describe('outlineOf', () => {
  const h = (level: number, t: string) => schema.node('heading', { level }, t ? [schema.text(t)] : []);
  const doc = schema.node('doc', null, [
    h(1, 'Chapitre'), h(2, 'Partie A'), h(3, 'Sous 1'), h(3, 'Sous 2'), schema.node('paragraph'), h(2, 'Partie B'), h(3, 'Sous 3'), h(2, ''),
  ]);
  it('numérote comme la feuille (romain)', () => {
    expect(outlineOf(doc, 'roman').map((i) => i.number)).toEqual(['', 'I.', '1.', '2.', 'II.', '1.', '']);
  });
  it('numérote 1. puis a.', () => {
    expect(outlineOf(doc, 'alpha').map((i) => i.number)).toEqual(['', '1.', 'a.', 'b.', '2.', 'a.', '']);
  });
  it('numérote 1. puis 1.1', () => {
    expect(outlineOf(doc, 'decimal').map((i) => i.number)).toEqual(['', '1.', '1.1', '1.2', '2.', '2.1', '']);
  });
  it('sans numéros', () => {
    expect(outlineOf(doc, 'none').every((i) => i.number === '')).toBe(true);
  });
});

describe('adaptCase', () => {
  it('reprend la majuscule initiale', () => { expect(adaptCase('Cellule', 'neurone')).toBe('Neurone'); });
  it('reprend les capitales', () => { expect(adaptCase('CELLULE', 'neurone')).toBe('NEURONE'); });
  it('garde le remplacement tel quel en minuscules', () => { expect(adaptCase('cellule', 'Neurone')).toBe('Neurone'); });
  it('accent en tête', () => { expect(adaptCase('Évaluation', 'épreuve')).toBe('Épreuve'); });
  it('remplacement vide', () => { expect(adaptCase('Cellule', '')).toBe(''); });
});
