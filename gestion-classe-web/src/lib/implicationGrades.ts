/**
 * Note d'implication d'un élève sur le trimestre en cours (page « Suivi élèves »).
 *
 * Calcul sorti de `pages/Students.tsx` pour être testé sans écran. Deux modes, selon le réglage
 * de la classe :
 *  - « objectif » : note = participations / objectif × 20, l'objectif baissant avec les absences ;
 *  - « note de base » : note = base + participations (− bavardages si la pénalité est active).
 * La note est bornée entre 0 et 20 ; ce qui dépasse 20 devient un bonus.
 */

export interface ImplicationStudent {
  id: string;
  pseudo: string;
  /** Vide de classe (`null`) pour un ancien élève pas encore réaffecté. */
  class_id: string | null;
  class_name: string;
  created_at: string;
  gender: 'M' | 'F';
  student_code?: string;
  is_witness: boolean;
  has_pap: boolean;
  has_ppre: boolean;
  has_pai: boolean;
}

export interface ImplicationEvent {
  id: string;
  student_id: string;
  session_id: string;
  type: string;
  subtype: string | null;
  note: string | null;
  photo_path: string | null;
  timestamp: string;
  session_date: string;
  class_name: string;
}

export interface TrimesterSettings {
  current_trimester: number;
  school_year: string;
}

export interface ClassConfig {
  class_id: string;
  target_participations: number;
  total_sessions_expected: number;
  bavardage_penalty: boolean;
  base_grade: number | null;
}

export interface ArchivedGrade {
  trimester: number;
  school_year: string;
  class_name: string | null;
  participations: number;
  absences: number;
  target_participations: number;
  adjusted_target: number;
  grade: number;
  bonus: number;
  archived_at: string | null;
}

export interface OralEvaluation {
  id: string;
  student_id: string;
  class_id: string;
  user_id: string;
  trimester: number;
  school_year: string;
  grade: number;
  evaluated_at: string | null;
}

export interface ManualParticipation {
  id: string;
  student_id: string;
  trimester: number;
  school_year: string;
  count: number;
  reason: string | null;
  created_at: string | null;
}

export interface StudentGrade {
  student: ImplicationStudent;
  participations: number;
  manualParticipations: number;
  totalParticipations: number;
  malus: number;
  effectiveParticipations: number;
  absences: number;
  targetParticipations: number;
  totalSessionsExpected: number;
  adjustedTarget: number;
  malusPenalty: boolean;
  baseGrade: number | null;
  grade: number;
  bonus: number;
  events: ImplicationEvent[];
  manualParticipationsList: ManualParticipation[];
  archivedGrades: ArchivedGrade[];
  oralEvaluation: OralEvaluation | null;
}

// ─── Lignes telles que la base les rend ──────────────────────────────────────

export interface StudentRow {
  id: string;
  pseudo: string;
  class_id: string | null;
  created_at: string;
  gender: string | null;
  student_code: string | null;
  is_witness: boolean | null;
  has_pap: boolean | null;
  has_ppre: boolean | null;
  has_pai: boolean | null;
  classes: { name: string } | null;
}

export interface EventRow {
  id: string;
  student_id: string;
  session_id: string;
  type: string;
  subtype: string | null;
  note: string | null;
  timestamp: string;
}

export interface ArchivedGradeRow {
  student_id: string;
  trimester: number;
  school_year: string;
  class_name: string | null;
  participations: number;
  absences: number;
  target_participations: number;
  adjusted_target: number | string;
  grade: number | string;
  bonus: number | string;
  archived_at: string | null;
}

/** Réglages appliqués à une classe qui n'en a pas enregistré. */
export const DEFAULT_TARGET_PARTICIPATIONS = 15;
export const DEFAULT_TOTAL_SESSIONS_EXPECTED = 60;

export interface ImplicationGrade {
  targetParticipations: number;
  totalSessionsExpected: number;
  malusPenalty: boolean;
  baseGrade: number | null;
  effectiveParticipations: number;
  adjustedTarget: number;
  grade: number;
  bonus: number;
}

/** La note d'implication, à partir des compteurs du trimestre et du réglage de la classe. */
export function computeImplicationGrade(
  counts: { totalParticipations: number; malus: number; absences: number },
  config: ClassConfig | undefined,
): ImplicationGrade {
  const { totalParticipations, malus, absences } = counts;
  const targetParticipations = config?.target_participations || DEFAULT_TARGET_PARTICIPATIONS;
  const totalSessionsExpected = config?.total_sessions_expected || DEFAULT_TOTAL_SESSIONS_EXPECTED;
  const malusPenalty = config?.bavardage_penalty ?? false;
  const baseGrade = config?.base_grade ?? null;

  const effectiveParticipations = malusPenalty
    ? Math.max(0, totalParticipations - malus)
    : totalParticipations;

  const reductionPerAbsence = targetParticipations / totalSessionsExpected;
  const adjustedTarget = Math.max(1, targetParticipations - (absences * reductionPerAbsence));

  let rawGrade: number;
  let bonus: number;
  if (baseGrade !== null && baseGrade > 0) {
    // Mode « note de base » : note = base + participations − bavardages (si pénalité active)
    const modifier = malusPenalty ? totalParticipations - malus : totalParticipations;
    rawGrade = baseGrade + modifier;
    bonus = rawGrade > 20 ? rawGrade - 20 : 0;
  } else {
    // Mode « objectif » : note = (participations / objectif) × 20
    rawGrade = (effectiveParticipations / adjustedTarget) * 20;
    bonus = rawGrade > 20 ? effectiveParticipations - adjustedTarget : 0;
  }
  const grade = Math.min(20, Math.max(0, rawGrade));

  return { targetParticipations, totalSessionsExpected, malusPenalty, baseGrade, effectiveParticipations, adjustedTarget, grade, bonus };
}

function groupByStudent<T extends { student_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const byStudent = new Map<string, T[]>();
  for (const row of rows) {
    const list = byStudent.get(row.student_id);
    if (list) list.push(row);
    else byStudent.set(row.student_id, [row]);
  }
  return byStudent;
}

export interface StudentGradesInput {
  students: readonly StudentRow[];
  /** Événements du trimestre en cours, du plus récent au plus ancien pour chaque élève. */
  events: readonly EventRow[];
  manualParticipations: readonly ManualParticipation[];
  archivedGrades: readonly ArchivedGradeRow[];
  oralEvaluations: readonly OralEvaluation[];
  classConfigs: ReadonlyMap<string, ClassConfig>;
}

/** Une ligne par élève : ses compteurs du trimestre, sa note, son historique. */
export function buildStudentGrades(input: StudentGradesInput): StudentGrade[] {
  const eventsByStudent = groupByStudent(input.events);
  const manualByStudent = groupByStudent(input.manualParticipations);
  const archivedByStudent = groupByStudent(input.archivedGrades);
  const oralByStudent = groupByStudent(input.oralEvaluations);

  return input.students.map((student) => {
    const rawEvents = eventsByStudent.get(student.id) ?? [];
    const events: ImplicationEvent[] = rawEvents.map((e) => ({
      id: e.id,
      student_id: e.student_id,
      session_id: e.session_id,
      type: e.type,
      subtype: e.subtype,
      note: e.note,
      photo_path: null,
      timestamp: e.timestamp,
      session_date: e.timestamp,
      class_name: '',
    }));

    const participations = rawEvents.filter((e) => e.type === 'participation').length;
    const malus = rawEvents.filter((e) => e.type === 'bavardage').length;
    const absences = rawEvents.filter((e) => e.type === 'absence').length;

    const manualParticipationsList = manualByStudent.get(student.id) ?? [];
    const manualParticipations = manualParticipationsList.reduce((sum, mp) => sum + mp.count, 0);
    const totalParticipations = participations + manualParticipations;

    const config = student.class_id ? input.classConfigs.get(student.class_id) : undefined;
    const computed = computeImplicationGrade({ totalParticipations, malus, absences }, config);

    const archivedGrades: ArchivedGrade[] = (archivedByStudent.get(student.id) ?? []).map((g) => ({
      trimester: g.trimester,
      school_year: g.school_year,
      class_name: g.class_name ?? null,
      participations: g.participations,
      absences: g.absences,
      target_participations: g.target_participations,
      adjusted_target: Number(g.adjusted_target),
      grade: Number(g.grade),
      bonus: Number(g.bonus),
      archived_at: g.archived_at,
    }));

    return {
      student: {
        id: student.id,
        pseudo: student.pseudo,
        class_id: student.class_id,
        class_name: student.classes?.name || 'Classe inconnue',
        created_at: student.created_at,
        gender: student.gender === 'F' ? 'F' : 'M',
        student_code: student.student_code || undefined,
        is_witness: student.is_witness ?? false,
        has_pap: !!student.has_pap,
        has_ppre: !!student.has_ppre,
        has_pai: !!student.has_pai,
      },
      participations,
      manualParticipations,
      totalParticipations,
      malus,
      absences,
      ...computed,
      events,
      manualParticipationsList,
      archivedGrades,
      oralEvaluation: oralByStudent.get(student.id)?.[0] ?? null,
    };
  });
}
