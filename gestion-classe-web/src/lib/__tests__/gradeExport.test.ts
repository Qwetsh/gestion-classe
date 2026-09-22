import { describe, expect, it } from 'vitest';
import { exportCell, sheetName, studentLabel } from '../gradeExport';
import type { GradeRow } from '../evaluationQueries';
import type { GradeStatus } from '../gradeStats';

const row = (grade: number | null, status: GradeStatus = 'noted'): GradeRow => ({
  id: 'g', assessment_id: 'a', student_id: 's',
  grade, grade_raw: null, comment: null, status,
  is_validated: false, validated_at: null, updated_at: null,
});

describe('sheetName — contraintes Excel', () => {
  it('garde un nom court tel quel', () => {
    expect(sheetName('5e2', new Set())).toBe('5e2');
  });

  it('tronque à 31 caractères', () => {
    const long = 'Classe de cinquième deux groupe A';
    const out = sheetName(long, new Set());
    expect(out.length).toBeLessThanOrEqual(31);
    expect(long.startsWith(out)).toBe(true);
  });

  it('remplace les caractères interdits par Excel', () => {
    expect(sheetName('6e/A', new Set())).toBe('6e-A');
    expect(sheetName('4e[TP]', new Set())).toBe('4e-TP-');
    expect(sheetName('3e:B', new Set())).toBe('3e-B');
  });

  it('déduplique sans jamais dépasser la limite', () => {
    const taken = new Set<string>();
    expect(sheetName('5e2', taken)).toBe('5e2');
    expect(sheetName('5e2', taken)).toBe('5e2 (2)');
    expect(sheetName('5e2', taken)).toBe('5e2 (3)');

    const taken2 = new Set<string>();
    const long = 'A'.repeat(40);
    const first = sheetName(long, taken2);
    const second = sheetName(long, taken2);
    expect(first.length).toBe(31);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second).not.toBe(first);
  });

  it('retombe sur un nom par défaut si tout est vide', () => {
    expect(sheetName('', new Set())).toBe('Classe');
  });
});

describe('studentLabel — un élève parti reste dans la sauvegarde', () => {
  it('signale celui qui a quitté la classe', () => {
    expect(studentLabel({ id: '1', pseudo: 'Alice D.', attached: true })).toBe('Alice D.');
    expect(studentLabel({ id: '2', pseudo: 'Bastien M.', attached: false }))
      .toBe('Bastien M. (a quitté la classe)');
  });
});

describe('exportCell — ce qui atterrit dans le fichier', () => {
  it('exporte une note comme un nombre, arrondi au centième', () => {
    expect(exportCell(row(14.5))).toBe(14.5);
    expect(exportCell(row(13.333333))).toBe(13.33);
    expect(exportCell(row(0))).toBe(0);
  });

  it('exporte un statut comme un libellé lisible', () => {
    expect(exportCell(row(null, 'absent'))).toBe('abs');
    expect(exportCell(row(null, 'dispense'))).toBe('disp');
    expect(exportCell(row(null, 'non_rendu'))).toBe('n.r.');
    expect(exportCell(row(null, 'non_rendu_zero'))).toBe('n.r. (0)');
  });

  it('laisse vide une note pas encore corrigée ou absente du carnet', () => {
    expect(exportCell(row(null))).toBe('');
    expect(exportCell(undefined)).toBe('');
  });

  it('ignore une note résiduelle portée par un statut sans note', () => {
    // Un élève noté puis marqué absent ne doit pas exporter son ancienne note.
    expect(exportCell(row(12, 'absent'))).toBe('abs');
  });
});
