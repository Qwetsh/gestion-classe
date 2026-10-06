import { describe, expect, it } from 'vitest';
import { buildClaudeExport, correctionFromEntry, parseClaudeCorrection } from '../productionsExport';
import type { ActivityRow, WorkRow } from '../productionsQueries';

const activity = {
  id: 'a1', key: '4e-s2-a1', title: 'Aux frontières des plaques', level: '4e', sequence: 'Séquence 2', bareme_total: 10,
  expected_answers: 'Q3 : 600 km = 60 000 000 cm.',
  definition: {
    competences: [{ id: 'demarches', nom: 'Démarches' }],
    lignes_q1: [{ id: 'l1', choix: ['islande'] }],
    colonnes_q1: [{ id: 'finalisee', nom: 'Mission finalisée', points: 0.5, champs: [{ id: 'ok', bool: true, nom: 'finalisée' }] }],
    attendu_q1: { islande: { type: 'divergence', indices: [] } },
    questions: [
      { id: 'q1', num: '1', points: 0.5, type: 'tableau', titre: 'Missions', consigne: 'c1', auto: true, criteres: [{ id: 'l1_finalisee', nom: 'finalisée', points: 0.5, auto: { ligne: 'l1', colonne: 'finalisee' } }] },
      { id: 'q3', num: '3', points: 1, type: 'texte', titre: 'Calcul', consigne: 'c3', criteres: [{ id: 'conversion', nom: 'Conversion', points: 0.5 }, { id: 'resultat', nom: 'Résultat', points: 0.5 }] },
    ],
  },
} as unknown as ActivityRow;

const work = {
  id: 'w-1', version: 1, group_pseudos: ['Test Un'], status: 'submitted', students: { pseudo: 'Test Un' },
  content: { q1: { l1: { zone: 'islande', ok: true } }, q3: '600 km = 60 000 000 cm ; 60 000 000 / 6,4 = 9 375 000 ans' },
} as unknown as WorkRow;

describe('export et import de la correction Claude', () => {
  it('produit un document lisible avec consignes, barème, corrigé et copies', () => {
    const md = buildClaudeExport(activity, [work], '4A');
    expect(md).toContain('# Correction de copies — Aux frontières des plaques · classe 4A');
    expect(md).toContain('"work_id": "w-1"');
    expect(md).toContain('`conversion` (0,5 pt)');
    expect(md).toContain('corrigée automatiquement, ne pas renvoyer');
    expect(md).toContain('Q3 : 600 km = 60 000 000 cm.');
    expect(md).toContain('### Copie 1 — Test Un — work_id `w-1`');
    expect(md).toContain('question 1 (auto) : 0,5 / 0,5');
    expect(md).toContain('9 375 000 ans');
  });

  it('lit le JSON brut ou un bloc ```json dans un texte', () => {
    const json = '[{"work_id":"w-1","questions":{"q3":{"criteres":{"conversion":true,"resultat":"true"},"remarque":" ok "}},"skills":{"demarches":3},"advice":"Continue."}]';
    expect(parseClaudeCorrection(json)).toHaveLength(1);
    expect(parseClaudeCorrection('Voici la correction :\n```json\n' + json + '\n```\nBonne journée.')).toHaveLength(1);
    expect(() => parseClaudeCorrection('pas du json')).toThrow();
    expect(parseClaudeCorrection('[{"sans_id": true}]')).toHaveLength(0);
  });

  it('ne garde que les questions ouvertes et des booléens stricts', () => {
    const entry = parseClaudeCorrection('[{"work_id":"w-1","questions":{"q1":{"criteres":{"l1_finalisee":false}},"q3":{"criteres":{"conversion":true,"resultat":"non","autre":true},"remarque":" Pense à l’unité. "}}}]')[0];
    const corr = correctionFromEntry(activity.definition, entry);
    expect(corr.questions.q1).toBeUndefined();
    expect(corr.questions.q3).toEqual({ criteres: { conversion: true, resultat: false }, points: null, remarque: 'Pense à l’unité.' });
  });
});
