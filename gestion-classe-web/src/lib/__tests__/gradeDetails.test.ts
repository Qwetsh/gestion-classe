import { describe, expect, it } from 'vitest';
import { levelScore, parseGradeDetails, questionRate } from '../gradeDetails';

const SAMPLE = {
  v: 1,
  evaluation: 'Nutrition',
  version: 'v5',
  bareme_total: 28,
  note_brute: 19.5,
  note_forcee: false,
  questions: [
    { label: 'Schéma branchie', bareme: 5, points: 2.5, commentaire: 'Il manque le grossissement.', competences: ['Langages'] },
  ],
  competences: [
    { nom: 'Raisonner', niveau: 'Satisfaisante' },
    { nom: 'Langages', niveau: 'Fragile' },
  ],
  forces: 'Définitions apprises.',
  faiblesses: 'Schémas trop rapides.',
  commentaire: 'Bon travail !',
};

describe('parseGradeDetails', () => {
  it('reads the Correcteur v1 format', () => {
    const d = parseGradeDetails(SAMPLE)!;
    expect(d.version).toBe('v5');
    expect(d.baremeTotal).toBe(28);
    expect(d.questions[0]).toEqual({
      label: 'Schéma branchie', bareme: 5, points: 2.5, commentaire: 'Il manque le grossissement.', competences: ['Langages'],
    });
    expect(d.competences.map((c) => c.niveau)).toEqual(['Satisfaisante', 'Fragile']);
    expect(d.commentaire).toBe('Bon travail !');
  });

  it('returns null when there is nothing to show', () => {
    expect(parseGradeDetails(null)).toBeNull();
    expect(parseGradeDetails('texte')).toBeNull();
    expect(parseGradeDetails({ v: 1 })).toBeNull();
  });

  it('never throws on malformed rows and drops unusable entries', () => {
    const d = parseGradeDetails({
      questions: [null, { label: 'Q', bareme: '2', points: '1,5' }, 'x'],
      competences: [{ nom: '' }, { nom: 'Raisonner', niveau: 'très bonne maîtrise' }, { nom: 'Écrire', niveau: 'Excellente' }],
    })!;
    expect(d.questions).toEqual([{ label: 'Q', bareme: 2, points: 1.5, commentaire: '', competences: [] }]);
    expect(d.competences).toEqual([
      { nom: 'Raisonner', niveau: 'Très bonne maîtrise' },
      { nom: 'Écrire', niveau: null },
    ]);
  });
});

describe('radar and rates', () => {
  it('maps the four levels to 1..4 (0 when unknown)', () => {
    expect([levelScore('Insuffisante'), levelScore('Fragile'), levelScore('Satisfaisante'), levelScore('Très bonne maîtrise'), levelScore(null)])
      .toEqual([1, 2, 3, 4, 0]);
  });

  it('computes a bounded success rate per question', () => {
    expect(questionRate({ label: '', bareme: 4, points: 3, commentaire: '', competences: [] })).toBe(0.75);
    expect(questionRate({ label: '', bareme: 0, points: 1, commentaire: '', competences: [] })).toBe(0);
  });
});
