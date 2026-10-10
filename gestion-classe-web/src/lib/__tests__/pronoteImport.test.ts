import { describe, expect, it } from 'vitest';
import { isoDateFromPronote, parsePronoteCsv, splitPronoteName } from '../pronoteImport';

/** Export à trois lignes d'en-tête : dates, libellés, barèmes. */
const TROIS_LIGNES = [
  ';;;01/10;15/10',
  '29 élèves;Moyenne;N.R.;;',
  ';;;1-/10;2-/20',
  '"BACHARI Amina";"14,00";"";"7,00";"Abs"',
  '"NGUYEN VAN Kalissa";"16,00";"";"8,00";"16,50"',
  '"Moyenne de la classe :";"15,00";"";"7,50";"16,50"',
].join('\r\n');

/** Export d'un seul devoir : les barèmes sont sur la ligne des libellés (fichier du 10/10/2026). */
const DEUX_LIGNES = [
  '﻿;;22/09',
  '29 élèves;Moyenne;1-/10',
  '"AGAZZI Thomas";"20,00";"10,00"',
  '"BERAZI Kamel";"";"Disp"',
  '"KOCHER David";"";"X"',
  '"LAMKADDEM Asma";"";"Abs"',
  '"Moyenne de la classe :";"17,00";"8,50"',
].join('\r\n');

describe('parsePronoteCsv', () => {
  it('lit l’export à trois lignes d’en-tête (dates, libellés, barèmes)', () => {
    const r = parsePronoteCsv(TROIS_LIGNES);
    expect(r.evals.map((e) => [e.col, e.bareme, e.coefficient, e.rawDate])).toEqual([[3, 10, 1, '01/10'], [4, 20, 2, '15/10']]);
    expect(r.students).toHaveLength(2);
    expect(r.students[0].lastName).toBe('BACHARI');
    expect(r.students[0].grades).toEqual([{ status: 'noted', raw: 7 }, { status: 'absent', raw: null }]);
    expect(r.students[1].grades[1]).toEqual({ status: 'noted', raw: 16.5 });
  });

  it('lit l’export d’un seul devoir, barème sur la ligne des libellés', () => {
    const r = parsePronoteCsv(DEUX_LIGNES.replace(/^﻿/, ''));
    expect(r.evals).toEqual([{ col: 2, label: '', rawDate: '22/09', bareme: 10, coefficient: 1 }]);
    expect(r.students.map((s) => s.fullName)).toEqual(['AGAZZI Thomas', 'BERAZI Kamel', 'KOCHER David', 'LAMKADDEM Asma']);
    expect(r.students[0].grades).toEqual([{ status: 'noted', raw: 10 }]);
    expect(r.students[1].grades).toEqual([{ status: 'dispense', raw: null }]);
    expect(r.students[3].grades).toEqual([{ status: 'absent', raw: null }]);
    // « X » n'est pas un statut connu : signalé, pas avalé.
    expect(r.students[2].grades).toEqual([null]);
    expect(r.students[2].unknown).toEqual([{ col: 2, text: 'X' }]);
  });

  it('ne prend jamais la colonne « Moyenne » (sur 20) pour une évaluation', () => {
    for (const text of [TROIS_LIGNES, DEUX_LIGNES.replace(/^﻿/, '')]) {
      expect(parsePronoteCsv(text).evals.some((e) => e.col === 1)).toBe(false);
    }
  });

  it('refuse un fichier sans barème', () => {
    expect(() => parsePronoteCsv('a;b\nc;d\ne;f')).toThrow(/pas un export de notes Pronote/);
  });
});

describe('splitPronoteName / isoDateFromPronote', () => {
  it('sépare le nom en capitales du prénom', () => {
    expect(splitPronoteName('NGUYEN VAN Kalissa')).toEqual({ lastName: 'NGUYEN VAN', firstName: 'Kalissa' });
    expect(splitPronoteName('EL MOUSSATI Dina')).toEqual({ lastName: 'EL MOUSSATI', firstName: 'Dina' });
  });

  it('place la date dans la bonne année scolaire', () => {
    expect(isoDateFromPronote('22/09', '2026-2027')).toBe('2026-09-22');
    expect(isoDateFromPronote('15/03', '2026-2027')).toBe('2027-03-15');
  });
});
