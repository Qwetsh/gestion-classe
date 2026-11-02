import { describe, expect, it } from 'vitest';
import { buildPronoteColumn, comparePronoteOrder, pronoteCell, pronoteColumnText, splitPseudo } from '../pronoteColumn';

describe('colonne Pronote', () => {
  it('lit le pseudo « Prénom XX. »', () => {
    expect(splitPseudo('Alisia ZH.')).toEqual({ first: 'Alisia', initials: 'ZH' });
    expect(splitPseudo('Marie-Lou DE.')).toEqual({ first: 'Marie-Lou', initials: 'DE' });
    expect(splitPseudo('Jean Paul BA')).toEqual({ first: 'Jean Paul', initials: 'BA' });
    expect(splitPseudo('Lina')).toEqual({ first: 'Lina', initials: '' });
  });

  it('trie sur le début du nom, puis le prénom', () => {
    const names = ['Zoé AB.', 'Alisia ZH.', 'Baptiste RO.', 'Amina DU.', 'Adam AB.'];
    expect([...names].sort(comparePronoteOrder)).toEqual(['Adam AB.', 'Zoé AB.', 'Amina DU.', 'Baptiste RO.', 'Alisia ZH.']);
  });

  it('écrit la note brute sur le barème, ou le code du statut', () => {
    expect(pronoteCell({ student_id: 'x', grade: 17, grade_raw: 8.5, status: 'noted' }, 10)).toBe('8,5');
    expect(pronoteCell({ student_id: 'x', grade: 15, grade_raw: null, status: 'noted' }, 10)).toBe('7,5');
    expect(pronoteCell({ student_id: 'x', grade: null, grade_raw: null, status: 'absent' }, 10)).toBe('Abs');
    expect(pronoteCell({ student_id: 'x', grade: null, grade_raw: null, status: 'dispense' }, 10)).toBe('Disp');
    expect(pronoteCell({ student_id: 'x', grade: null, grade_raw: null, status: 'non_rendu' }, 10)).toBe('N.Rdu');
    expect(pronoteCell({ student_id: 'x', grade: 0, grade_raw: 0, status: 'non_rendu_zero' }, 10)).toBe('N.Rdu0');
    expect(pronoteCell(undefined, 10)).toBe('');
  });

  it('garde une ligne par élève et signale l’ordre douteux et les brouillons', () => {
    const rows = buildPronoteColumn(
      [{ id: 'b', pseudo: 'Zoé AB.' }, { id: 'a', pseudo: 'Adam AB.' }, { id: 'c', pseudo: 'Amina DU.' }, { id: 'd', pseudo: 'Lina' }],
      [
        { student_id: 'a', grade: 16, grade_raw: 8, status: 'noted', is_validated: true },
        { student_id: 'b', grade: 10, grade_raw: 5, status: 'noted', is_validated: false },
        { student_id: 'c', grade: null, grade_raw: null, status: 'absent', is_validated: true },
      ],
      10,
    );
    expect(rows.map((r) => r.pseudo)).toEqual(['Lina', 'Adam AB.', 'Zoé AB.', 'Amina DU.']);
    expect(rows.map((r) => r.orderToCheck)).toEqual([true, true, true, false]);
    expect(rows.map((r) => r.draft)).toEqual([false, false, true, false]);
    expect(pronoteColumnText(rows)).toBe('\n8\n5\nAbs');
  });
});
