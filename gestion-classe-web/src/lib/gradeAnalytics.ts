/**
 * Onglet Analyses — agrégation des notes du carnet.
 *
 * `gradeStats.ts` décrit **une** évaluation ; ce module croise **toutes** les
 * évaluations d'une période : moyennes par classe, évolution dans le temps, comparaison
 * des classes sur une même série, élèves en difficulté, croisement avec le comportement.
 *
 * Module pur pour tout ce qui calcule (une seule fonction touche le réseau), parce que
 * ce sont ces chiffres-là qu'on regarde avant un conseil de classe.
 */

import { supabase } from './supabase';
import { fetchAllPages, type PageResult } from './evaluationQueries';
import {
  describeGrades,
  effectiveGrade,
  mean,
  studentAverage,
  toNumber,
  type GradeEntry,
  type GradeStats,
  type GradeStatus,
} from './gradeStats';

// ============================================================
// Types
// ============================================================

export interface AnalyticsAssessment {
  id: string;
  classId: string;
  className: string;
  name: string;
  /** Date passée par le prof ; `created_at` sert de repli pour l'ordre chronologique. */
  date: string | null;
  createdAt: string;
  period: number | null;
  coefficient: number;
  countsInAverage: boolean;
  seriesId: string | null;
  /** Nom de la série quand l'éval en fait partie : c'est lui qui titre le point de courbe. */
  seriesName: string | null;
}

export interface AnalyticsGrade {
  assessmentId: string;
  studentId: string;
  /** Déjà ramenée sur 20 à la saisie (`saveGrade`). */
  grade: number | null;
  status: GradeStatus;
}

export interface GradeAnalyticsData {
  assessments: AnalyticsAssessment[];
  grades: AnalyticsGrade[];
}

/** L'élève tel que l'onglet Analyses le connaît déjà. */
export interface AnalyticsStudent {
  id: string;
  pseudo: string;
  classId: string;
  gender?: 'M' | 'F' | null;
}

// ============================================================
// Chargement
// ============================================================

interface RawAssessment {
  id: string;
  class_id: string;
  name: string;
  date: string | null;
  created_at: string;
  period: number | null;
  coefficient: number | string | null;
  counts_in_average: boolean;
  series_id: string | null;
  classes?: { name: string } | null;
  assessment_series?: { name: string } | null;
}

/**
 * Évaluations et notes d'une sélection de classes.
 *
 * Tout est paginé : au-delà de 1000 lignes, PostgREST tronque **sans erreur** — une
 * moyenne calculée sur une classe amputée est fausse et a l'air normale.
 *
 * @param period - trimestre, ou `null` pour toute l'année scolaire.
 */
export async function fetchGradeAnalytics(
  userId: string,
  classIds: readonly string[],
  schoolYear: string,
  period: number | null,
): Promise<GradeAnalyticsData> {
  if (classIds.length === 0) return { assessments: [], grades: [] };

  const rawAssessments = await fetchAllPages<RawAssessment>(async (from, to) => {
    let q = supabase
      .from('written_assessments')
      .select(
        'id, class_id, name, date, created_at, period, coefficient, counts_in_average, series_id,' +
        ' classes(name), assessment_series(name)',
      )
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('school_year', schoolYear)
      .in('class_id', classIds as string[]);
    if (period !== null) q = q.eq('period', period);
    const r = await q.range(from, to);
    return r as unknown as PageResult<RawAssessment>;
  });

  const assessments: AnalyticsAssessment[] = rawAssessments.map((a) => ({
    id: a.id,
    classId: a.class_id,
    className: a.classes?.name ?? '—',
    name: a.name,
    date: a.date,
    createdAt: a.created_at,
    period: a.period,
    coefficient: toNumber(a.coefficient) ?? 1,
    countsInAverage: a.counts_in_average,
    seriesId: a.series_id,
    seriesName: a.assessment_series?.name ?? null,
  }));

  if (assessments.length === 0) return { assessments, grades: [] };

  // Filtré côté client sur l'ensemble des évals retenues : une liste de plusieurs
  // centaines d'UUID dans un `in(...)` produit une URL que le serveur peut refuser.
  const keep = new Set(assessments.map((a) => a.id));
  const rawGrades = await fetchAllPages<{
    assessment_id: string; student_id: string; grade: number | string | null; status: GradeStatus;
  }>(async (from, to) => {
    const r = await supabase
      .from('assessment_grades')
      .select('assessment_id, student_id, grade, status')
      .eq('user_id', userId)
      .range(from, to);
    return r as unknown as PageResult<{
      assessment_id: string; student_id: string; grade: number | string | null; status: GradeStatus;
    }>;
  });

  const grades: AnalyticsGrade[] = rawGrades
    .filter((g) => keep.has(g.assessment_id))
    .map((g) => ({
      assessmentId: g.assessment_id,
      studentId: g.student_id,
      grade: toNumber(g.grade),
      status: g.status ?? 'noted',
    }));

  return { assessments, grades };
}

// ============================================================
// Helpers internes
// ============================================================

const entryOf = (g: AnalyticsGrade): GradeEntry => ({
  studentId: g.studentId,
  grade: g.grade,
  status: g.status,
});

function groupGradesByAssessment(grades: readonly AnalyticsGrade[]): Map<string, AnalyticsGrade[]> {
  const map = new Map<string, AnalyticsGrade[]>();
  for (const g of grades) {
    const list = map.get(g.assessmentId);
    if (list) list.push(g);
    else map.set(g.assessmentId, [g]);
  }
  return map;
}

/** Ordre chronologique : la date saisie fait foi, `created_at` départage le reste. */
function chronoKey(a: AnalyticsAssessment): string {
  return a.date ?? a.createdAt;
}

// ============================================================
// Moyennes par classe
// ============================================================

export interface ClassGradeStats {
  classId: string;
  className: string;
  /** Indicateurs sur les notes brutes (médiane, écart-type, histogramme…). */
  stats: GradeStats;
  /**
   * Moyenne de la classe au sens du bulletin : moyenne des moyennes pondérées des élèves,
   * et non moyenne de toutes les notes. Un élève absent à deux devoirs ne pèse pas moins.
   */
  classAverage: number | null;
  assessmentCount: number;
  /** Élèves ayant au moins une note exploitable. */
  studentCount: number;
}

export function computeClassStats(
  data: GradeAnalyticsData,
  students: readonly AnalyticsStudent[],
): ClassGradeStats[] {
  const byAssessment = groupGradesByAssessment(data.grades);
  const assessmentById = new Map(data.assessments.map((a) => [a.id, a]));
  const byClass = new Map<string, { className: string; entries: GradeEntry[]; assessments: Set<string> }>();

  for (const a of data.assessments) {
    if (!byClass.has(a.classId)) {
      byClass.set(a.classId, { className: a.className, entries: [], assessments: new Set() });
    }
    const bucket = byClass.get(a.classId)!;
    bucket.assessments.add(a.id);
    for (const g of byAssessment.get(a.id) ?? []) bucket.entries.push(entryOf(g));
  }

  const averages = computeStudentAverages(data, assessmentById);

  return [...byClass.entries()]
    .map(([classId, bucket]) => {
      const classStudents = students.filter((s) => s.classId === classId);
      const values = classStudents
        .map((s) => averages.get(s.id)?.average ?? null)
        .filter((v): v is number => v !== null);
      return {
        classId,
        className: bucket.className,
        stats: describeGrades(bucket.entries),
        classAverage: mean(values),
        assessmentCount: bucket.assessments.size,
        studentCount: values.length,
      };
    })
    .sort((x, y) => (y.classAverage ?? -1) - (x.classAverage ?? -1));
}

// ============================================================
// Moyennes par élève
// ============================================================

export interface StudentAverage {
  average: number | null;
  /** Nombre de notes exploitables (les absences et dispenses n'y sont pas). */
  count: number;
  /**
   * Écart entre les trois dernières notes et les précédentes, en points /20.
   * `null` tant qu'il n'y a pas au moins quatre notes : sinon on lit du bruit.
   */
  trend: number | null;
}

function computeStudentAverages(
  data: GradeAnalyticsData,
  assessmentById: Map<string, AnalyticsAssessment>,
): Map<string, StudentAverage> {
  const byStudent = new Map<string, { assessment: AnalyticsAssessment; grade: AnalyticsGrade }[]>();
  for (const g of data.grades) {
    const a = assessmentById.get(g.assessmentId);
    if (!a) continue;
    const list = byStudent.get(g.studentId);
    if (list) list.push({ assessment: a, grade: g });
    else byStudent.set(g.studentId, [{ assessment: a, grade: g }]);
  }

  const out = new Map<string, StudentAverage>();
  for (const [studentId, rows] of byStudent) {
    const average = studentAverage(
      rows.map((r) => ({
        entry: entryOf(r.grade),
        assessment: { coefficient: r.assessment.coefficient, countsInAverage: r.assessment.countsInAverage },
      })),
    );

    const chrono = rows
      .slice()
      .sort((x, y) => chronoKey(x.assessment).localeCompare(chronoKey(y.assessment)))
      .map((r) => effectiveGrade(entryOf(r.grade)))
      .filter((v): v is number => v !== null);

    let trend: number | null = null;
    if (chrono.length >= 4) {
      const recent = chrono.slice(-3);
      const before = chrono.slice(0, -3);
      const m1 = mean(recent);
      const m0 = mean(before);
      if (m1 !== null && m0 !== null) trend = m1 - m0;
    }

    out.set(studentId, { average, count: chrono.length, trend });
  }
  return out;
}

export interface StudentGradeRow extends StudentAverage {
  studentId: string;
  pseudo: string;
  classId: string;
  className: string;
  /** Écart à la moyenne de sa classe, en points. */
  gap: number | null;
}

export function computeStudentRows(
  data: GradeAnalyticsData,
  students: readonly AnalyticsStudent[],
): StudentGradeRow[] {
  const assessmentById = new Map(data.assessments.map((a) => [a.id, a]));
  const averages = computeStudentAverages(data, assessmentById);
  const classNames = new Map(data.assessments.map((a) => [a.classId, a.className]));

  const classAverage = new Map<string, number | null>();
  for (const classId of new Set(students.map((s) => s.classId))) {
    const values = students
      .filter((s) => s.classId === classId)
      .map((s) => averages.get(s.id)?.average ?? null)
      .filter((v): v is number => v !== null);
    classAverage.set(classId, mean(values));
  }

  return students
    .map((s) => {
      const avg = averages.get(s.id) ?? { average: null, count: 0, trend: null };
      const ref = classAverage.get(s.classId) ?? null;
      return {
        studentId: s.id,
        pseudo: s.pseudo,
        classId: s.classId,
        className: classNames.get(s.classId) ?? '—',
        ...avg,
        gap: avg.average !== null && ref !== null ? avg.average - ref : null,
      };
    })
    .filter((r) => r.count > 0)
    .sort((x, y) => (x.average ?? 99) - (y.average ?? 99));
}

// ============================================================
// Évolution dans le temps
// ============================================================

export interface TimelinePoint {
  key: string;
  label: string;
  /** Date affichable (celle de la première classe qui a passé l'éval). */
  date: string | null;
  /** Moyenne par classe, indexée par `classId`. Une classe absente vaut `null`. */
  byClass: Record<string, number | null>;
  /** Moyenne toutes classes confondues sur ce devoir. */
  overall: number | null;
}

/**
 * Une évaluation = un point. Les lignes d'une même série sont repliées en un seul point :
 * c'est le même devoir, et le comparer d'une classe à l'autre est justement l'intérêt.
 */
export function computeTimeline(data: GradeAnalyticsData): TimelinePoint[] {
  const byAssessment = groupGradesByAssessment(data.grades);
  const points = new Map<string, {
    label: string; date: string | null; chrono: string;
    byClass: Record<string, number | null>; values: number[];
  }>();

  for (const a of data.assessments) {
    const key = a.seriesId ? `series:${a.seriesId}` : `solo:${a.id}`;
    if (!points.has(key)) {
      points.set(key, {
        label: a.seriesName ?? a.name,
        date: a.date,
        chrono: chronoKey(a),
        byClass: {},
        values: [],
      });
    }
    const p = points.get(key)!;
    if (chronoKey(a) < p.chrono) {
      p.chrono = chronoKey(a);
      p.date = a.date;
    }
    const values = (byAssessment.get(a.id) ?? [])
      .map((g) => effectiveGrade(entryOf(g)))
      .filter((v): v is number => v !== null);
    p.byClass[a.classId] = mean(values);
    p.values.push(...values);
  }

  return [...points.entries()]
    .sort((x, y) => x[1].chrono.localeCompare(y[1].chrono))
    .map(([key, p]) => ({
      key,
      label: p.label,
      date: p.date,
      byClass: p.byClass,
      overall: mean(p.values),
    }));
}

// ============================================================
// Comparaison des classes sur une même évaluation (série)
// ============================================================

export interface SeriesComparisonRow {
  seriesId: string;
  name: string;
  byClass: Record<string, number | null>;
  /** Écart entre la meilleure et la moins bonne classe, en points. */
  spread: number | null;
  best: string | null;
  worst: string | null;
}

export function computeSeriesComparison(data: GradeAnalyticsData): SeriesComparisonRow[] {
  const timeline = computeTimeline(data);
  const nameById = new Map<string, string>();
  for (const a of data.assessments) {
    if (a.seriesId) nameById.set(a.seriesId, a.seriesName ?? a.name);
  }

  return timeline
    .filter((p) => p.key.startsWith('series:'))
    .map((p) => {
      const seriesId = p.key.slice('series:'.length);
      const entries = Object.entries(p.byClass).filter(
        (e): e is [string, number] => e[1] !== null,
      );
      const sorted = entries.slice().sort((x, y) => y[1] - x[1]);
      return {
        seriesId,
        name: nameById.get(seriesId) ?? p.label,
        byClass: p.byClass,
        spread: sorted.length >= 2 ? sorted[0][1] - sorted[sorted.length - 1][1] : null,
        best: sorted.length >= 2 ? sorted[0][0] : null,
        worst: sorted.length >= 2 ? sorted[sorted.length - 1][0] : null,
      };
    })
    .filter((r) => Object.keys(r.byClass).length >= 2);
}

// ============================================================
// Distribution globale
// ============================================================

export function computeGlobalStats(data: GradeAnalyticsData): GradeStats {
  return describeGrades(data.grades.map(entryOf));
}

// ============================================================
// Filles / garçons
// ============================================================

export interface GenderGradeStats {
  filles: { average: number | null; count: number };
  garcons: { average: number | null; count: number };
}

export function computeGenderStats(rows: readonly StudentGradeRow[], students: readonly AnalyticsStudent[]): GenderGradeStats {
  const genderById = new Map(students.map((s) => [s.id, s.gender ?? null]));
  const f: number[] = [];
  const m: number[] = [];
  for (const r of rows) {
    if (r.average === null) continue;
    const g = genderById.get(r.studentId);
    if (g === 'F') f.push(r.average);
    else if (g === 'M') m.push(r.average);
  }
  return {
    filles: { average: mean(f), count: f.length },
    garcons: { average: mean(m), count: m.length },
  };
}

// ============================================================
// Croisement notes × comportement
// ============================================================

/**
 * Coefficient de corrélation linéaire de Pearson, entre -1 et 1.
 *
 * `null` s'il y a moins de trois points ou si l'une des deux séries est constante :
 * afficher « 0 » dans ces cas-là ferait passer une absence de données pour une absence
 * de lien. Et une corrélation n'est pas une cause : c'est une piste, pas un verdict.
 */
export function pearson(pairs: readonly { x: number; y: number }[]): number | null {
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map((p) => p.x));
  const my = mean(pairs.map((p) => p.y));
  if (mx === null || my === null) return null;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const p of pairs) {
    const a = p.x - mx;
    const b = p.y - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Lecture en français d'un coefficient : le chiffre seul ne parle à personne. */
export function describeCorrelation(r: number | null): string {
  if (r === null) return 'Pas assez de données pour conclure';
  const a = Math.abs(r);
  const strength = a < 0.2 ? 'négligeable' : a < 0.4 ? 'faible' : a < 0.6 ? 'modéré' : a < 0.8 ? 'fort' : 'très fort';
  if (a < 0.2) return `Lien ${strength} (r = ${r.toFixed(2)})`;
  return `Lien ${strength}, ${r > 0 ? 'positif' : 'négatif'} (r = ${r.toFixed(2)})`;
}
