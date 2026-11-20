import { describe, expect, it } from 'vitest';
import { flapRows, toSheet, turnDirection } from '../binderFlaps';

describe('flapRows', () => {
  it('repère les lignes question · réponse · volet, pas l’en-tête ni les autres tableaux', () => {
    const rows = [
      ['FICHE DE MÉMORISATION', '4ᵉ   Nom : ……'],
      ['QUESTIONS  (essais : ☐ ☐ ☐)', 'RÉPONSES', '✂ VOLETS — à découper puis rabattre ←'],
      ['1. Qu’est-ce que le magma ?   ☐ ☐ ☐', 'Roche fondue avec des gaz.', '⟵ plie'],
      ['2. Qu’est-ce que la viscosité ?', 'Sa difficulté à s’écouler.', '⟵ Plie'],
      ['3. Question sans réponse', '   ', '⟵ plie'],
      ['Critère', 'Insuffisant', 'Fragile', 'Satisfaisant'],
    ];
    expect(flapRows(rows)).toEqual([2, 3]);
  });
});

describe('toSheet', () => {
  it('ramène un rectangle de l’écran au repère de la feuille, quelle que soit l’échelle', () => {
    const box = { left: 100, top: 50, width: 400, height: 566 }; // feuille de 800 px montrée à moitié
    expect(toSheet({ left: 300, top: 150, width: 120, height: 20 }, box, 800)).toEqual({ x: 400, y: 200, w: 240, h: 40 });
    // Feuille déplacée (page 2 d'une fiche) : seul l'écart au conteneur compte
    expect(toSheet({ left: 300, top: -850, width: 120, height: 20 }, { ...box, top: -950 }, 800)).toEqual({ x: 400, y: 200, w: 240, h: 40 });
  });
});

describe('turnDirection', () => {
  it('donne le sens de la page qui se tourne', () => {
    expect(turnDirection(2, 3)).toBe(1);
    expect(turnDirection(5, 1)).toBe(-1);
    expect(turnDirection(4, 4)).toBe(0);
  });
});
