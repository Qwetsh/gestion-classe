import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { HAND_FONT, INK_BLUE, INK_RED, fillSummaries, hasInk, plainText, summaryTexts, tickCover } from '../binderInk';

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const cell = (...content: JSONContent[]): JSONContent => ({ type: 'tableCell', content });
const table = (...cells: JSONContent[]): JSONContent => ({ type: 'table', content: cells.map((c) => ({ type: 'tableRow', content: [c] })) });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const zone: JSONContent = { type: 'writingZone', attrs: { style: 'lignes', lines: 4 } };
const label = p(text('Bilan :', [{ type: 'bold' }]));

const activity = (title: string, body: JSONContent[]) => table(cell(p(text(title))), cell(label, ...body));

describe('tickCover', () => {
  it('coche les cases vides et laisse le reste', () => {
    const cover = doc(table(cell(p(text('Deux types de volcanisme'))), cell(p(text('☐', [{ type: 'textStyle', attrs: { fontSize: '11pt' } }])))));
    const ticked = tickCover(cover);
    expect(plainText(ticked)).toBe('Deux types de volcanisme✓');
    const tick = ticked.content![0].content![1].content![0].content![0].content![0];
    expect(tick.marks).toContainEqual({ type: 'textStyle', attrs: { color: INK_BLUE, fontSize: '11pt' } });
    expect(plainText(cover)).toContain('☐'); // le document d'origine n'est pas modifié
  });
});

describe('feuille de bilans', () => {
  const blank = doc(
    table(cell(p(text('L’ESSENTIEL — Séquence 1')))),
    activity('Activité 1 — Volcanisme   —   Pourquoi ?', [zone]),
    activity('Activité 2 — Séisme   —   Comment ?', [zone]),
    activity('Activité 3 — Répartition', [zone]),
  );
  const corrected = doc(
    table(cell(p(text('L’ESSENTIEL — CORRIGÉ')))),
    // Dans un autre ordre : le rattachement se fait par le numéro de l'activité
    activity('Activité 2 — Séisme', [p(text('Un '), text('séisme', [{ type: 'underline' }]), text(' est une rupture.'))]),
    activity('Activite 1 — Volcanisme', [p(text('Deux types d’éruptions.')), p(text('   '))]),
  );

  it('lit les bilans corrigés par activité', () => {
    const texts = summaryTexts(corrected);
    expect([...texts.keys()]).toEqual(['activite 2', 'activite 1']);
    expect(texts.get('activite 1')).toHaveLength(1); // le paragraphe vide est écarté
  });

  it('recopie chaque bilan en rouge à la place des lignes, mots soulignés compris', () => {
    const filled = fillSummaries(blank, corrected);
    const [, a1, a2, a3] = filled.content!;
    expect(plainText(a1)).toContain('Bilan :Deux types d’éruptions.');
    expect(plainText(a2)).toContain('Un séisme est une rupture.');
    const word = a2.content![1].content![0].content![1].content![1];
    expect(word.marks).toEqual([{ type: 'underline' }, { type: 'textStyle', attrs: { color: INK_RED, fontFamily: HAND_FONT } }]);
    expect(JSON.stringify(a1)).not.toContain('writingZone');
    // Pas de bilan corrigé pour l'activité 3 : ses lignes restent
    expect(JSON.stringify(a3)).toContain('writingZone');
    expect(hasInk(filled)).toBe(true);
    expect(hasInk(blank)).toBe(false);
  });

  it('rend la feuille vierge telle quelle sans feuille corrigée exploitable', () => {
    expect(fillSummaries(blank, doc(p(text('rien'))))).toBe(blank);
  });
});
