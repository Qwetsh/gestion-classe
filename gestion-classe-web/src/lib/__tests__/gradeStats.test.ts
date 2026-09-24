import { describe, expect, it } from 'vitest';
import {
  describeGrades,
  effectiveGrade,
  formatGrade,
  formatRate,
  histogram,
  mean,
  parseGradeCell,
  quantile,
  stdDev,
  studentAverage,
  toNumber,
  toTwenty,
  weightedAverage,
  type GradeEntry,
  type GradeStatus,
} from '../gradeStats';

const entry = (grade: number | null, status: GradeStatus = 'noted', studentId = 's'): GradeEntry =>
  ({ studentId, grade, status });

describe('effectiveGrade — ce qui pèse dans une moyenne', () => {
  it('retient une note saisie', () => {
    expect(effectiveGrade(entry(14.5))).toBe(14.5);
    expect(effectiveGrade(entry(0))).toBe(0);
  });

  it('exclut absent, dispensé et non rendu', () => {
    expect(effectiveGrade(entry(null, 'absent'))).toBeNull();
    expect(effectiveGrade(entry(null, 'dispense'))).toBeNull();
    expect(effectiveGrade(entry(null, 'non_rendu'))).toBeNull();
  });

  it('compte « non rendu (0) » comme un zéro', () => {
    expect(effectiveGrade(entry(null, 'non_rendu_zero'))).toBe(0);
  });

  it('ignore une note résiduelle sur un statut qui n’en porte pas', () => {
    // Un élève noté 12 puis marqué absent ne doit pas rapporter ses 12 points.
    expect(effectiveGrade(entry(12, 'absent'))).toBeNull();
    expect(effectiveGrade(entry(12, 'non_rendu_zero'))).toBe(0);
  });

  it('exclut une ligne notée mais pas encore corrigée', () => {
    expect(effectiveGrade(entry(null, 'noted'))).toBeNull();
    expect(effectiveGrade(entry(Number.NaN, 'noted'))).toBeNull();
  });
});

describe('critère A3 — un absent ne fait pas baisser la moyenne', () => {
  it('donne la même moyenne avec ou sans élève absent', () => {
    const sans = describeGrades([entry(12, 'noted', 'a'), entry(14, 'noted', 'b')]);
    const avec = describeGrades([
      entry(12, 'noted', 'a'),
      entry(14, 'noted', 'b'),
      entry(null, 'absent', 'c'),
      entry(null, 'dispense', 'd'),
      entry(null, 'non_rendu', 'e'),
    ]);
    expect(avec.mean).toBe(sans.mean);
    expect(avec.mean).toBe(13);
    expect(avec.count).toBe(2);
  });

  it('en revanche un « non rendu (0) » la fait bien baisser', () => {
    const s = describeGrades([entry(12, 'noted', 'a'), entry(14, 'noted', 'b'), entry(null, 'non_rendu_zero', 'c')]);
    expect(s.mean).toBeCloseTo(26 / 3, 10);
    expect(s.count).toBe(3);
  });
});

describe('toNumber — les numeric de Postgres peuvent revenir en chaîne', () => {
  it('accepte un nombre comme une chaîne numérique', () => {
    expect(toNumber(12)).toBe(12);
    expect(toNumber('12')).toBe(12);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(0)).toBe(0);
    expect(toNumber('0')).toBe(0);
  });

  it('rend null sur ce qui n’est pas exploitable', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('douze')).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });
});

describe('une note arrivée en chaîne compte quand même', () => {
  it('n’est pas silencieusement exclue de la moyenne', () => {
    // Number.isFinite('12') vaut false : sans toNumber, cette note disparaissait
    // du calcul sans la moindre trace.
    const asString = { studentId: 's', grade: '12' as unknown as number, status: 'noted' as const };
    expect(effectiveGrade(asString)).toBe(12);
    expect(describeGrades([asString, entry(16)]).mean).toBe(14);
  });

  it('vaut aussi pour un coefficient en chaîne', () => {
    const avg = studentAverage([
      { entry: entry(10), assessment: { coefficient: '3' as unknown as number, countsInAverage: true } },
      { entry: entry(20), assessment: { coefficient: 1, countsInAverage: true } },
    ]);
    expect(avg).toBeCloseTo(12.5, 10);
  });

  it('vaut aussi pour un barème en chaîne', () => {
    expect(toTwenty('14' as unknown as number, '28' as unknown as number)).toBe(10);
  });
});

describe('toTwenty', () => {
  it('ramène une note brute sur le barème', () => {
    expect(toTwenty(14, 28)).toBe(10);
    expect(toTwenty(28, 28)).toBe(20);
  });

  it('laisse la note intacte si le barème est absent ou absurde', () => {
    expect(toTwenty(14, 20)).toBe(14);
    expect(toTwenty(14, null)).toBe(14);
    expect(toTwenty(14, 0)).toBe(14);
    expect(toTwenty(14, -5)).toBe(14);
  });

  it('propage l’absence de note', () => {
    expect(toTwenty(null, 28)).toBeNull();
  });
});

describe('quantile (méthode R-7, comme PERCENTILE.INC d’Excel)', () => {
  it('interpole entre deux valeurs', () => {
    // h = (5-1) * 0.25 = 1 -> valeur exacte d'indice 1
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    // h = (4-1) * 0.25 = 0.75 -> 1 + 0.75 * (2-1)
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 10);
  });

  it('gère la médiane des effectifs pairs et impairs', () => {
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('gère les cas dégénérés', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([7], 0.5)).toBe(7);
    expect(quantile([1, 2, 3], 0)).toBe(1);
    expect(quantile([1, 2, 3], 1)).toBe(3);
  });
});

describe('mean et stdDev', () => {
  it('calcule un écart-type de population', () => {
    // moyenne 5, écarts ±3 et ±1 -> variance (9+1+1+9)/4 = 5
    expect(stdDev([2, 4, 6, 8])).toBeCloseTo(Math.sqrt(5), 10);
  });

  it('rend 0 pour une série constante et null pour une série vide', () => {
    expect(stdDev([10, 10, 10])).toBe(0);
    expect(stdDev([])).toBeNull();
    expect(mean([])).toBeNull();
  });
});

describe('histogram', () => {
  it('répartit en 10 tranches de 2 points', () => {
    const h = histogram([0, 1.9, 2, 9.5, 19.99]);
    expect(h).toHaveLength(10);
    expect(h[0].count).toBe(2); // 0 et 1,9
    expect(h[1].count).toBe(1); // 2
    expect(h[4].count).toBe(1); // 9,5
    expect(h[9].count).toBe(1); // 19,99
  });

  it('range 20/20 dans la dernière tranche et non hors tableau', () => {
    const h = histogram([20]);
    expect(h[9].count).toBe(1);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(1);
  });
});

describe('describeGrades', () => {
  it('décrit une classe complète', () => {
    const s = describeGrades([
      entry(8, 'noted', 'a'),
      entry(12, 'noted', 'b'),
      entry(16, 'noted', 'c'),
      entry(20, 'noted', 'd'),
    ]);
    expect(s.count).toBe(4);
    expect(s.mean).toBe(14);
    expect(s.median).toBe(14);
    expect(s.min).toBe(8);
    expect(s.max).toBe(20);
    expect(s.successRate).toBe(0.75);
  });

  it('compte les statuts et le reste à corriger', () => {
    const s = describeGrades([
      entry(10, 'noted', 'a'),
      entry(null, 'noted', 'b'), // pas encore corrigée
      entry(null, 'absent', 'c'),
      entry(null, 'non_rendu_zero', 'd'),
    ]);
    expect(s.statusCounts).toEqual({ noted: 2, absent: 1, dispense: 0, non_rendu: 0, non_rendu_zero: 1 });
    expect(s.pending).toBe(1);
    expect(s.count).toBe(2); // la note de 'a' et le zéro de 'd'
  });

  it('ne rend jamais NaN ni 0 quand il n’y a aucune note exploitable', () => {
    const s = describeGrades([entry(null, 'absent', 'a'), entry(null, 'noted', 'b')]);
    expect(s.count).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.median).toBeNull();
    expect(s.stdDev).toBeNull();
    expect(s.successRate).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
  });

  it('accepte une liste vide', () => {
    const s = describeGrades([]);
    expect(s.count).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.histogram).toHaveLength(10);
  });
});

describe('weightedAverage et studentAverage', () => {
  it('pondère par les coefficients', () => {
    expect(weightedAverage([{ value: 10, coefficient: 3 }, { value: 20, coefficient: 1 }]))
      .toBeCloseTo(12.5, 10);
  });

  it('ignore les coefficients nuls ou négatifs', () => {
    expect(weightedAverage([{ value: 10, coefficient: 1 }, { value: 0, coefficient: 0 }])).toBe(10);
    expect(weightedAverage([{ value: 10, coefficient: 0 }])).toBeNull();
    expect(weightedAverage([])).toBeNull();
  });

  it('écarte les évals hors moyenne et les statuts exclus', () => {
    const avg = studentAverage([
      { entry: entry(10), assessment: { coefficient: 2, countsInAverage: true } },
      { entry: entry(20), assessment: { coefficient: 1, countsInAverage: false } }, // informative
      { entry: entry(null, 'absent'), assessment: { coefficient: 5, countsInAverage: true } },
    ]);
    expect(avg).toBe(10);
  });

  it('rend null si rien ne compte', () => {
    expect(studentAverage([
      { entry: entry(null, 'absent'), assessment: { coefficient: 1, countsInAverage: true } },
    ])).toBeNull();
    expect(studentAverage([])).toBeNull();
  });

  it('fait bien peser un « non rendu (0) »', () => {
    const avg = studentAverage([
      { entry: entry(20), assessment: { coefficient: 1, countsInAverage: true } },
      { entry: entry(null, 'non_rendu_zero'), assessment: { coefficient: 1, countsInAverage: true } },
    ]);
    expect(avg).toBe(10);
  });
});

describe('parseGradeCell', () => {
  it('accepte la virgule comme séparateur décimal', () => {
    expect(parseGradeCell('14,5', 20)).toEqual({ status: 'noted', raw: 14.5 });
    expect(parseGradeCell('14.5', 20)).toEqual({ status: 'noted', raw: 14.5 });
    expect(parseGradeCell('  12 ', 20)).toEqual({ status: 'noted', raw: 12 });
  });

  it('reconnaît les raccourcis de statut', () => {
    expect(parseGradeCell('a', 20)).toEqual({ status: 'absent', raw: null });
    expect(parseGradeCell('D', 20)).toEqual({ status: 'dispense', raw: null });
    expect(parseGradeCell('n', 20)).toEqual({ status: 'non_rendu', raw: null });
    expect(parseGradeCell('z', 20)).toEqual({ status: 'non_rendu_zero', raw: null });
  });

  it('vide la cellule sans perdre la ligne', () => {
    expect(parseGradeCell('', 20)).toEqual({ status: 'noted', raw: null });
    expect(parseGradeCell('   ', 20)).toEqual({ status: 'noted', raw: null });
  });

  it('rejette ce qui sort du barème', () => {
    expect(parseGradeCell('21', 20)).toBeNull();
    expect(parseGradeCell('-1', 20)).toBeNull();
    expect(parseGradeCell('25', 28)).toEqual({ status: 'noted', raw: 25 }); // barème 28 : valide
    expect(parseGradeCell('29', 28)).toBeNull();
  });

  it('rejette le charabia', () => {
    expect(parseGradeCell('douze', 20)).toBeNull();
    expect(parseGradeCell('1,2,3', 20)).toBeNull();
  });

  it('retombe sur 20 quand le barème est absent', () => {
    expect(parseGradeCell('20', null)).toEqual({ status: 'noted', raw: 20 });
    expect(parseGradeCell('21', null)).toBeNull();
  });
});

describe('formatage', () => {
  it('affiche « — » plutôt que NaN ou 0', () => {
    expect(formatGrade(null)).toBe('—');
    expect(formatGrade(Number.NaN)).toBe('—');
    expect(formatRate(null)).toBe('—');
  });

  it('utilise la virgule décimale', () => {
    expect(formatGrade(12.55, 1)).toBe('12,6');
    expect(formatGrade(13, 2)).toBe('13,00');
    expect(formatRate(0.756)).toBe('76 %');
  });
});
