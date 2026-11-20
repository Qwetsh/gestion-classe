import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { CELL_SIZE, HAND_FONT, INK_BLUE, INK_RED, RULED_SIZE, fillSheet, fillSummaries, hasInk, modelAnswers, plainText, summaryTexts, tickCover } from '../binderInk';

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
    expect(word.marks).toEqual([{ type: 'underline' }, { type: 'textStyle', attrs: { color: INK_RED, fontFamily: HAND_FONT, fontSize: RULED_SIZE } }]);
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

describe('copie modèle', () => {
  const hand = (t: string, extra: NonNullable<JSONContent['marks']> = []): JSONContent =>
    text(t, [...extra, { type: 'textStyle', attrs: { color: INK_BLUE, fontFamily: HAND_FONT } }]);
  const dots: JSONContent = { type: 'dots', attrs: { cm: null } };
  const blank = cell({ type: 'paragraph' });
  const copy = doc(
    p(text('Réponses d’un élève modèle.')),
    p(text('Q1 — '), hand('10 août 2026')),
    p(hand('—')),
    p(hand('7,4')),
    p(text('Q2 — '), hand('que la '), hand('magnitude', [{ type: 'underline' }]), hand(' est forte.')),
    p(text('Q3 — '), hand('Les dégâts dépendent aussi de la profondeur du foyer.')),
    p(hand('en trop')),
  );
  const sheet = doc(
    table(cell(p(text('Critère'))), blank, blank, blank),
    p(text('J’observe '), dots),
    { type: 'writingZone', attrs: { style: 'lignes', lines: 4 } },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(text('Islande'))] }] },
    { type: 'callout', attrs: { kind: 'libre', title: '✅ J’ai réussi l’activité si je peux :' }, content: [
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(text('comparer deux séismes'))] }] },
    ] },
  );
  const cellsText = (tbl: JSONContent): string[] => (tbl.content ?? []).flatMap((row) => row.content ?? []).map(plainText);

  it('lit les réponses dans l’ordre, sans les repères ni les notes', () => {
    const answers = modelAnswers(copy);
    expect(answers.map((a) => (a ? a.map((n) => n.text).join('') : null)))
      .toEqual(['10 août 2026', null, '7,4', 'que la magnitude est forte.', 'Les dégâts dépendent aussi de la profondeur du foyer.', 'en trop']);
  });

  it('écrit chaque réponse dans sa zone : cellules vides, pointillés, zone de lignes', () => {
    const filled = fillSheet(sheet, modelAnswers(copy));
    const [tbl, sentence, written, rest, choice, success] = filled.content!;
    expect(cellsText(tbl)).toEqual(['Critère', '10 août 2026', '', '7,4']);
    expect(plainText(sentence)).toBe('J’observe que la magnitude est forte.');
    expect(sentence.content![2].marks).toEqual([{ type: 'underline' }, { type: 'textStyle', attrs: { color: INK_BLUE, fontFamily: HAND_FONT } }]);
    // La zone de 4 lignes : le texte sur des lignes, puis les 3 lignes restantes
    expect(written.content![0].marks).toEqual([{ type: 'textStyle', attrs: { color: INK_BLUE, fontFamily: HAND_FONT, fontSize: RULED_SIZE } }]);
    expect(rest).toEqual({ type: 'writingZone', attrs: { style: 'lignes', lines: 3 } });
    // Dans une cellule, l'écriture est petite
    expect(tbl.content![1].content![0].content![0].content![0].marks).toEqual([{ type: 'textStyle', attrs: { color: INK_BLUE, fontFamily: HAND_FONT, fontSize: CELL_SIZE } }]);
    // Seules les cases de « J'ai réussi » sont cochées, pas une case de choix
    expect(choice.content![0].attrs).toEqual({ checked: false });
    expect(success.content![0].content![0].attrs).toEqual({ checked: true });
    expect(JSON.stringify(sheet)).toContain('"checked":false'); // la fiche d'origine n'est pas modifiée
  });

  it('ne remplit pas la ligne d’identité', () => {
    const withName = doc(p(text('Nom : '), dots, text('   Prénom : '), dots, text('   Classe : '), dots), ...sheet.content!);
    const filled = fillSheet(withName, modelAnswers(copy));
    expect(filled.content![0]).toEqual(withName.content![0]);
    expect(cellsText(filled.content![1])).toEqual(['Critère', '10 août 2026', '', '7,4']);
  });

  it('laisse la fiche telle quelle sans réponse, et les zones en trop vides', () => {
    expect(fillSheet(sheet, [])).toBe(sheet);
    const filled = fillSheet(sheet, modelAnswers(doc(p(hand('seule réponse')))));
    expect(cellsText(filled.content![0])).toEqual(['Critère', 'seule réponse', '', '']);
    expect(JSON.stringify(filled)).toContain('"lines":4');
  });
});
