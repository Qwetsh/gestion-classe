import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import { buildCorrectionsDocx } from '../correctionsDocx';
import { parseGradeDetails } from '../gradeDetails';

describe('fiches de correction en Word', () => {
  it('produit un vrai .docx avec le récapitulatif et une fiche par élève', async () => {
    const details = parseGradeDetails({
      bareme_total: 10, note_brute: 7,
      questions: [{ label: 'Q1 Magma', bareme: 4, points: 3, commentaire: 'Bien' }, { label: 'Q2', bareme: 6, points: 4, commentaire: '' }],
      competences: [{ nom: 'Raisonner', niveau: 'Satisfaisante' }],
      forces: 'Rigueur', faiblesses: 'Vocabulaire', commentaire: 'Bon travail',
    })!;
    const doc = buildCorrectionsDocx({
      assessmentName: 'Les séismes',
      className: '4B',
      summary: true,
      sheets: [
        { pseudo: 'Élève A.', grade: 14, validated: true, details },
        { pseudo: 'Élève B.', grade: 9.5, validated: false, details },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    // Un .docx est une archive zip : signature « PK ».
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    expect(buf.length).toBeGreaterThan(5000);
  });
});
