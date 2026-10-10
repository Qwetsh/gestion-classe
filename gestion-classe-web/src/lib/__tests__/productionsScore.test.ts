import { describe, expect, it } from 'vitest';
import { computeTotal, questionScore, type ActivityDefinition, type ActivityQuestion, type WorkCorrection } from '../productionsQueries';

const q3: ActivityQuestion = {
  id: 'q3', num: '3', points: 0.5, type: 'texte', titre: 'Calcul', consigne: 'c3',
  criteres: [{ id: 'conversion', nom: 'Conversion', points: 0.25 }, { id: 'resultat', nom: 'Résultat', points: 0.25 }],
};
const q2: ActivityQuestion = {
  id: 'q2', num: '2', points: 1.5, type: 'deductive', titre: 'Comparer', consigne: 'c2',
  criteres: [{ id: 'observe', nom: 'O', points: 0.5 }, { id: 'sais', nom: 'S', points: 0.5 }, { id: 'deduis', nom: 'D', points: 0.5 }],
};
const bonus: ActivityQuestion = {
  id: 'bonus', num: '★', points: 0, bonus: true, type: 'texte', titre: 'Bonus', consigne: 'b',
  criteres: [{ id: 'indice1', nom: 'I1', points: 0 }],
};
const def: ActivityDefinition = { questions: [q2, q3, bonus] };

describe('questionScore (points lus par le prof et par l’élève)', () => {
  it('somme les critères cochés', () => {
    const corr: WorkCorrection = { questions: { q2: { criteres: { observe: true, sais: false, deduis: true } } } };
    expect(questionScore(q2, corr)).toBe(1);
  });

  it('préfère les points libres quand ils sont saisis', () => {
    const corr: WorkCorrection = { questions: { q3: { criteres: { conversion: true, resultat: true }, points: 0.25 } } };
    expect(questionScore(q3, corr)).toBe(0.25);
  });

  it('vaut 0 sans correction de la question', () => {
    expect(questionScore(q3, { questions: {} })).toBe(0);
    expect(questionScore(q3, null)).toBe(0);
  });

  it('arrondit au centième (0,1 + 0,2 n’est pas 0,30000000000000004)', () => {
    const q: ActivityQuestion = { ...q3, criteres: [{ id: 'a', nom: 'a', points: 0.1 }, { id: 'b', nom: 'b', points: 0.2 }] };
    expect(questionScore(q, { questions: { q3: { criteres: { a: true, b: true } } } })).toBe(0.3);
  });

  it('est cohérent avec computeTotal, bonus exclu', () => {
    const corr: WorkCorrection = {
      questions: {
        q2: { criteres: { observe: true, sais: true, deduis: false } },
        q3: { criteres: { conversion: true, resultat: false } },
        bonus: { criteres: { indice1: true } },
      },
    };
    const parQuestion = def.questions.filter((q) => !q.bonus).reduce((s, q) => s + questionScore(q, corr), 0);
    expect(computeTotal(def, corr)).toBe(1.25);
    expect(Math.round(parQuestion * 100) / 100).toBe(1.25);
  });
});
