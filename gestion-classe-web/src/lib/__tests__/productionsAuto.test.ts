import { describe, expect, it } from 'vitest';
import { applyAuto, autoCorrection, autoPoints, checkQ1Cell, hasAuto, q1Label, type ActivityDefinition } from '../productionsQueries';

/** Extrait de la définition v2 envoyée par « Terre en mouvement » (question 1 à réponses fermées). */
const def: ActivityDefinition = {
  lignes_q1: [{ id: 'l1', choix: ['islande', 'atlantique'] }, { id: 'l2', choix: ['andes', 'java'] }],
  colonnes_q1: [
    { id: 'relief', nom: 'Relief', points: 0.25, champs: [{ id: 'relief', choix: true }] },
    { id: 'gps', nom: 'GPS', points: 0.25, champs: [{ id: 'gps_sens', choix: true }, { id: 'gps_vitesse', nom: 'à environ', unite: 'cm/an' }] },
    { id: 'indice', nom: 'Indice', points: 0.25, champs: [{ id: 'indice', choix: true }] },
  ],
  choix_q1: {
    relief: [{ id: 'relief_ocean', nom: 'Un relief au milieu de l’océan' }, { id: 'fosse', nom: 'Une fosse' }],
    gps_sens: [{ id: 'ecartent', nom: 'Les plaques s’écartent' }, { id: 'rapprochent', nom: 'Les plaques se rapprochent' }],
    indice: [{ id: 'gps_ecartent', nom: 'GPS : s’écartent' }, { id: 'seismes_surface', nom: 'Séismes peu profonds' }],
  },
  attendu_q1: {
    islande: { relief: 'relief_ocean', seismes: 'surface', volcans: 'effusif', gps_sens: 'ecartent', gps_vitesse: 1.9, type: 'divergence', indices: ['gps_ecartent'] },
    andes: { relief: 'fosse', seismes: 'profonds', volcans: 'explosif', gps_sens: 'rapprochent', gps_vitesse: 6.4, type: 'subduction', indices: ['seismes_profonds'] },
  },
  tolerance_vitesse: 0.5,
  questions: [
    {
      id: 'q1', num: '1', points: 1.5, type: 'tableau', titre: 'Tableau', consigne: '', auto: true,
      criteres: [
        { id: 'l1_relief', nom: 'L1 relief', points: 0.25, auto: { ligne: 'l1', colonne: 'relief' } },
        { id: 'l1_gps', nom: 'L1 gps', points: 0.25, auto: { ligne: 'l1', colonne: 'gps' } },
        { id: 'l1_indice', nom: 'L1 indice', points: 0.25, auto: { ligne: 'l1', colonne: 'indice' } },
        { id: 'l2_relief', nom: 'L2 relief', points: 0.25, auto: { ligne: 'l2', colonne: 'relief' } },
        { id: 'l2_gps', nom: 'L2 gps', points: 0.25, auto: { ligne: 'l2', colonne: 'gps' } },
        { id: 'l2_indice', nom: 'L2 indice', points: 0.25, auto: { ligne: 'l2', colonne: 'indice' } },
      ],
    },
    { id: 'q3', num: '3', points: 1, type: 'texte', titre: 'Calcul', consigne: '', criteres: [{ id: 'resultat', nom: 'Résultat', points: 1 }] },
  ],
};

const content = {
  q1: {
    l1: { zone: 'islande', relief: 'relief_ocean', gps_sens: 'ecartent', gps_vitesse: '2,1', indice: 'seismes_surface' },
    l2: { zone: 'andes', relief: 'fosse', gps_sens: 'rapprochent', gps_vitesse: '8', indice: '' },
  },
  q3: '9 millions d’années',
};

describe('correction automatique des réponses à choix', () => {
  it('vérifie chaque colonne d’après la zone choisie', () => {
    expect(checkQ1Cell(def, content.q1.l1, 'relief')).toBe(true);
    expect(checkQ1Cell(def, content.q1.l1, 'gps')).toBe(true);         // 2,1 (virgule) à ±0,5 de 1,9
    expect(checkQ1Cell(def, content.q1.l1, 'indice')).toBe(false);     // indice non décisif
    expect(checkQ1Cell(def, content.q1.l2, 'gps')).toBe(false);        // 8 trop loin de 6,4
    expect(checkQ1Cell(def, content.q1.l2, 'indice')).toBe(false);     // vide
    expect(checkQ1Cell(def, { zone: '' }, 'relief')).toBeNull();        // zone non choisie : pas vérifiable
    expect(checkQ1Cell(def, { zone: 'mars', relief: 'fosse' }, 'relief')).toBeNull();
  });

  it('ne touche qu’aux critères automatiques', () => {
    expect(hasAuto(def)).toBe(true);
    expect(autoCorrection(def, content)).toEqual({
      q1: { l1_relief: true, l1_gps: true, l1_indice: false, l2_relief: true, l2_gps: false, l2_indice: false },
    });
    expect(autoPoints(def, content)).toEqual({ points: 0.75, max: 1.5 });
    const corr = applyAuto(def, { questions: { q3: { criteres: { resultat: true } } } }, content);
    expect(corr.questions.q3).toEqual({ criteres: { resultat: true } });
    expect(corr.questions.q1?.criteres?.l1_gps).toBe(true);
    expect(corr.questions.q1?.points).toBeNull();
  });

  it('affiche les libellés des menus, ou la valeur brute d’une ancienne fiche', () => {
    expect(q1Label(def, { id: 'relief', choix: true }, 'fosse')).toBe('Une fosse');
    expect(q1Label(def, { id: 'gps_vitesse', unite: 'cm/an' }, '2,1')).toBe('2,1 cm/an');
    expect(q1Label(def, { id: 'relief' }, 'une île qui sort de l’eau')).toBe('une île qui sort de l’eau');
    expect(q1Label(def, { id: 'relief' }, undefined)).toBe('');
  });

  it('ignore les activités sans question fermée', () => {
    const sans: ActivityDefinition = { questions: [{ id: 'q3', num: '3', points: 1, type: 'texte', titre: '', consigne: '', criteres: [{ id: 'r', nom: '', points: 1 }] }] };
    expect(hasAuto(sans)).toBe(false);
    expect(autoCorrection(sans, content)).toBeNull();
    expect(autoPoints(sans, content)).toBeNull();
  });
});
