import { describe, expect, it } from 'vitest';
import {
  computeClassStats,
  computeGenderStats,
  computeSeriesComparison,
  computeStudentRows,
  computeTimeline,
  pearson,
  type AnalyticsAssessment,
  type AnalyticsGrade,
  type AnalyticsStudent,
  type GradeAnalyticsData,
} from '../gradeAnalytics';

/**
 * Ces calculs alimentent l'onglet Analyses avant un conseil de classe : une moyenne
 * fausse y a l'air parfaitement normale. D'où des cas d'école explicites.
 */

const assessment = (
  over: Partial<AnalyticsAssessment> & { id: string; classId: string },
): AnalyticsAssessment => ({
  className: over.classId.toUpperCase(),
  name: 'Éval',
  date: '2026-09-01',
  createdAt: '2026-09-01T08:00:00Z',
  period: 1,
  coefficient: 1,
  countsInAverage: true,
  seriesId: null,
  seriesName: null,
  ...over,
});

const grade = (
  assessmentId: string,
  studentId: string,
  value: number | null,
  status: AnalyticsGrade['status'] = 'noted',
): AnalyticsGrade => ({ assessmentId, studentId, grade: value, status });

const students: AnalyticsStudent[] = [
  { id: 's1', pseudo: 'Alice D.', classId: 'a', gender: 'F' },
  { id: 's2', pseudo: 'Bob M.', classId: 'a', gender: 'M' },
  { id: 's3', pseudo: 'Chloé R.', classId: 'b', gender: 'F' },
];

describe('computeClassStats', () => {
  it('moyenne de classe = moyenne des moyennes d’élèves, pas moyenne des notes', () => {
    // Alice a deux notes (10 et 10), Bob une seule (20). La moyenne des notes vaut
    // 13,33 ; celle des élèves vaut 15 — c'est celle du bulletin.
    const data: GradeAnalyticsData = {
      assessments: [assessment({ id: 'e1', classId: 'a' }), assessment({ id: 'e2', classId: 'a' })],
      grades: [grade('e1', 's1', 10), grade('e2', 's1', 10), grade('e1', 's2', 20)],
    };
    const [classA] = computeClassStats(data, students);
    expect(classA.classAverage).toBeCloseTo(15, 5);
    expect(classA.stats.mean).toBeCloseTo(40 / 3, 5);
    expect(classA.studentCount).toBe(2);
    expect(classA.assessmentCount).toBe(2);
  });

  it('respecte les coefficients et les évals hors moyenne', () => {
    const data: GradeAnalyticsData = {
      assessments: [
        assessment({ id: 'e1', classId: 'a', coefficient: 3 }),
        assessment({ id: 'e2', classId: 'a', coefficient: 1 }),
        assessment({ id: 'e3', classId: 'a', countsInAverage: false }),
      ],
      grades: [grade('e1', 's1', 16), grade('e2', 's1', 8), grade('e3', 's1', 0)],
    };
    const [classA] = computeClassStats(data, [students[0]]);
    expect(classA.classAverage).toBeCloseTo((16 * 3 + 8) / 4, 5);
  });

  it('exclut les absents du dénominateur, mais compte les non rendus sanctionnés', () => {
    const data: GradeAnalyticsData = {
      assessments: [assessment({ id: 'e1', classId: 'a' }), assessment({ id: 'e2', classId: 'a' })],
      grades: [grade('e1', 's1', null, 'absent'), grade('e2', 's1', null, 'non_rendu_zero')],
    };
    const [classA] = computeClassStats(data, [students[0]]);
    expect(classA.classAverage).toBe(0);
    expect(classA.stats.count).toBe(1);
  });
});

describe('computeTimeline', () => {
  it('replie une série en un seul point et garde l’ordre chronologique', () => {
    const data: GradeAnalyticsData = {
      assessments: [
        assessment({ id: 'e2', classId: 'a', name: 'Contrôle 2', date: '2026-10-05' }),
        assessment({
          id: 'e1a', classId: 'a', name: 'Contrôle 1', date: '2026-09-10',
          seriesId: 'S1', seriesName: 'Contrôle 1',
        }),
        assessment({
          id: 'e1b', classId: 'b', name: 'Contrôle 1', date: '2026-09-12',
          seriesId: 'S1', seriesName: 'Contrôle 1',
        }),
      ],
      grades: [
        grade('e1a', 's1', 12), grade('e1a', 's2', 8),
        grade('e1b', 's3', 16),
        grade('e2', 's1', 14),
      ],
    };
    const points = computeTimeline(data);
    expect(points.map((p) => p.label)).toEqual(['Contrôle 1', 'Contrôle 2']);
    expect(points[0].byClass).toEqual({ a: 10, b: 16 });
    expect(points[0].overall).toBeCloseTo(12, 5);
    expect(points[0].date).toBe('2026-09-10');
  });
});

describe('computeSeriesComparison', () => {
  it('donne l’écart entre la meilleure et la moins bonne classe', () => {
    const data: GradeAnalyticsData = {
      assessments: [
        assessment({ id: 'e1a', classId: 'a', seriesId: 'S1', seriesName: 'DS commun' }),
        assessment({ id: 'e1b', classId: 'b', seriesId: 'S1', seriesName: 'DS commun' }),
      ],
      grades: [grade('e1a', 's1', 9), grade('e1b', 's3', 15)],
    };
    const [row] = computeSeriesComparison(data);
    expect(row.name).toBe('DS commun');
    expect(row.spread).toBeCloseTo(6, 5);
    expect(row.best).toBe('b');
    expect(row.worst).toBe('a');
  });

  it('ignore une éval qu’une seule classe a passée', () => {
    const data: GradeAnalyticsData = {
      assessments: [assessment({ id: 'e1', classId: 'a', seriesId: 'S1', seriesName: 'Seul' })],
      grades: [grade('e1', 's1', 12)],
    };
    expect(computeSeriesComparison(data)).toEqual([]);
  });
});

describe('computeStudentRows', () => {
  const chronological: GradeAnalyticsData = {
    assessments: [
      assessment({ id: 'e1', classId: 'a', date: '2026-09-01' }),
      assessment({ id: 'e2', classId: 'a', date: '2026-09-15' }),
      assessment({ id: 'e3', classId: 'a', date: '2026-10-01' }),
      assessment({ id: 'e4', classId: 'a', date: '2026-10-15' }),
    ],
    grades: [
      grade('e1', 's1', 16), grade('e2', 's1', 8), grade('e3', 's1', 8), grade('e4', 's1', 8),
      grade('e1', 's2', 10),
    ],
  };

  it('mesure la tendance sur les trois dernières notes', () => {
    const rows = computeStudentRows(chronological, students);
    const alice = rows.find((r) => r.studentId === 's1')!;
    expect(alice.count).toBe(4);
    expect(alice.trend).toBeCloseTo(8 - 16, 5);
  });

  it('ne conclut pas sur une tendance avec moins de quatre notes', () => {
    const rows = computeStudentRows(chronological, students);
    expect(rows.find((r) => r.studentId === 's2')!.trend).toBeNull();
  });

  it('situe l’élève par rapport à sa classe et écarte ceux sans note', () => {
    const rows = computeStudentRows(chronological, students);
    expect(rows.some((r) => r.studentId === 's3')).toBe(false);
    const alice = rows.find((r) => r.studentId === 's1')!;
    const bob = rows.find((r) => r.studentId === 's2')!;
    // Moyennes : Alice 10, Bob 10 → moyenne de classe 10, écarts nuls.
    expect(alice.gap).toBeCloseTo(0, 5);
    expect(bob.gap).toBeCloseTo(0, 5);
  });
});

describe('computeGenderStats', () => {
  it('ignore les élèves sans genre renseigné', () => {
    const data: GradeAnalyticsData = {
      assessments: [assessment({ id: 'e1', classId: 'a' })],
      grades: [grade('e1', 's1', 14), grade('e1', 's2', 6), grade('e1', 's4', 20)],
    };
    const withUnknown: AnalyticsStudent[] = [
      ...students,
      { id: 's4', pseudo: 'Inconnu', classId: 'a', gender: null },
    ];
    const rows = computeStudentRows(data, withUnknown);
    const stats = computeGenderStats(rows, withUnknown);
    expect(stats.filles).toEqual({ average: 14, count: 1 });
    expect(stats.garcons).toEqual({ average: 6, count: 1 });
  });
});

describe('pearson', () => {
  it('vaut 1 sur une droite croissante et -1 sur une droite décroissante', () => {
    expect(pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])).toBeCloseTo(1, 10);
    expect(pearson([{ x: 1, y: 6 }, { x: 2, y: 4 }, { x: 3, y: 2 }])).toBeCloseTo(-1, 10);
  });

  it('refuse de conclure sur trop peu de points ou une série constante', () => {
    expect(pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }])).toBeNull();
    expect(pearson([{ x: 5, y: 2 }, { x: 5, y: 4 }, { x: 5, y: 6 }])).toBeNull();
  });
});
