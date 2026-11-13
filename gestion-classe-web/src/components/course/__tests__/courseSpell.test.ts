import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import type { SpellIssue } from '../../../lib/boardSpell';
import { batchTexts, splitIssues, textBlocks, worthChecking } from '../courseSpell';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
    hardBreak: { group: 'inline', inline: true },
  },
  marks: { bold: {} },
});

const issue = (offset: number, length: number, text: string): SpellIssue => ({
  offset, length, text, message: '', short: '', suggestions: [], kind: 'grammar', ruleId: 'R',
});

describe('textBlocks', () => {
  it('un texte par paragraphe, positions de chaque caractère', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('les '), schema.text('élève', [schema.mark('bold')])]),
      schema.node('paragraph', null, [schema.text('a'), schema.node('hardBreak'), schema.text('b')]),
    ]);
    const blocks = textBlocks(doc);
    expect(blocks.map((b) => b.text)).toEqual(['les élève', 'a b']);
    expect(doc.textBetween(blocks[0].starts[4], blocks[0].starts[8] + 1)).toBe('élève');
    expect(blocks[1].starts).toHaveLength(3);
  });
});

describe('lots de paragraphes', () => {
  it('regroupe sans dépasser la taille', () => {
    expect(batchTexts(['aaaa', 'bbbb', 'cccc'], 10)).toEqual([['aaaa', 'bbbb'], ['cccc']]);
  });
  it('écarte un texte trop long', () => {
    expect(batchTexts(['x'.repeat(20), 'ok'], 10)).toEqual([['ok']]);
  });
  it('rend chaque faute à son paragraphe, décalage relatif', () => {
    const batch = ['les élève travaille', 'il a manger'];
    // texte envoyé : « les élève travaille\n\nil a manger »
    const map = splitIssues(batch, [issue(4, 5, 'élève'), issue(26, 6, 'manger')]);
    expect(map.get('les élève travaille')).toEqual([issue(4, 5, 'élève')]);
    expect(map.get('il a manger')).toEqual([issue(5, 6, 'manger')]);
  });
  it('une faute à cheval sur deux paragraphes est écartée', () => {
    const map = splitIssues(['abc', 'def'], [issue(2, 4, 'c\n\nd')]);
    expect(map.get('abc')).toEqual([]);
    expect(map.get('def')).toEqual([]);
  });
});

describe('worthChecking', () => {
  it('au moins un mot', () => {
    expect(worthChecking('Le cours')).toBe(true);
    expect(worthChecking('1. 2) — ?')).toBe(false);
    expect(worthChecking('')).toBe(false);
  });
});
