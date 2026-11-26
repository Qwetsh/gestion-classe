/**
 * Ce que le plan de classe affiche sur la place de chaque élève (page « Classes ») : sa note
 * d'implication du trimestre, la petite courbe de ses dix dernières séances et sa tendance.
 *
 * Sorti de `pages/Classes.tsx`. La note vient de `computeImplicationGrade`, la même formule que
 * la page « Suivi élèves » : la page en tenait jusque-là une seconde copie.
 */
import { computeImplicationGrade, type GradeRules } from './implicationGrades';

export interface SeatGrade {
  studentId: string;
  /** Participations du trimestre, saisies manuelles comprises. */
  participations: number;
  malus: number;
  absences: number;
  grade: number;
  /** Dix cases, la plus récente à droite ; `null` quand l'élève a moins de dix séances. */
  sparkHistory: (number | null)[];
  trend: 'up' | 'down' | 'flat';
  trendDelta: number;
}

export interface SeatEventRow {
  student_id: string;
  type: string;
  session_id: string | null;
}

/** Nombre de séances montrées par la courbe. */
export const SPARK_SESSIONS = 10;
/** Écart de moyenne, entre la première et la seconde moitié de la courbe, à partir duquel la tendance n'est plus « stable ». */
export const TREND_THRESHOLD = 0.15;

/**
 * La courbe et la tendance d'un élève. `events` : ses événements du trimestre, du plus ancien au
 * plus récent. Chaque séance vaut participations − bavardages, borné entre −2 et 2.
 */
export function sessionSparkline(events: readonly SeatEventRow[]): Pick<SeatGrade, 'sparkHistory' | 'trend' | 'trendDelta'> {
  const bySession = new Map<string, { pos: number; neg: number }>();
  for (const e of events) {
    if (!e.session_id) continue;
    let counts = bySession.get(e.session_id);
    if (!counts) {
      counts = { pos: 0, neg: 0 };
      bySession.set(e.session_id, counts);
    }
    if (e.type === 'participation') counts.pos++;
    else if (e.type === 'bavardage') counts.neg++;
  }
  const scores = [...bySession.values()].map((g) => Math.max(-2, Math.min(2, g.pos - g.neg)));
  const last = scores.slice(-SPARK_SESSIONS);
  const sparkHistory: (number | null)[] = Array(SPARK_SESSIONS).fill(null);
  last.forEach((v, i) => { sparkHistory[SPARK_SESSIONS - last.length + i] = v; });

  let trendDelta = 0;
  if (last.length >= 2) {
    const mid = Math.floor(last.length / 2);
    const first = last.slice(0, mid);
    const second = last.slice(mid);
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    trendDelta = average(second) - average(first);
  }
  const trend = trendDelta > TREND_THRESHOLD ? 'up' : trendDelta < -TREND_THRESHOLD ? 'down' : 'flat';
  return { sparkHistory, trend, trendDelta };
}

/**
 * Une entrée par élève de la classe.
 * `events` : événements du trimestre, du plus ancien au plus récent pour chaque élève.
 */
export function buildSeatGrades(
  studentIds: readonly string[],
  events: readonly SeatEventRow[],
  manualParticipations: readonly { student_id: string; count: number }[],
  rules: GradeRules | undefined,
): Map<string, SeatGrade> {
  const eventsByStudent = new Map<string, SeatEventRow[]>();
  for (const e of events) {
    const list = eventsByStudent.get(e.student_id);
    if (list) list.push(e);
    else eventsByStudent.set(e.student_id, [e]);
  }
  const manualByStudent = new Map<string, number>();
  for (const m of manualParticipations) manualByStudent.set(m.student_id, (manualByStudent.get(m.student_id) ?? 0) + m.count);

  const grades = new Map<string, SeatGrade>();
  for (const studentId of studentIds) {
    const studentEvents = eventsByStudent.get(studentId) ?? [];
    const malus = studentEvents.filter((e) => e.type === 'bavardage').length;
    const absences = studentEvents.filter((e) => e.type === 'absence').length;
    const participations = studentEvents.filter((e) => e.type === 'participation').length + (manualByStudent.get(studentId) ?? 0);
    const { grade } = computeImplicationGrade({ totalParticipations: participations, malus, absences }, rules);
    grades.set(studentId, { studentId, participations, malus, absences, grade, ...sessionSparkline(studentEvents) });
  }
  return grades;
}
