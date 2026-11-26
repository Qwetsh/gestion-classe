/**
 * Chargement des données de la page « Suivi élèves » (pages/Students.tsx).
 *
 * Trois précautions par rapport à l'ancien chargement, écrit dans la page :
 *  - les listes d'élèves passent par paquets (`STUDENT_CHUNK`) : une requête qui porte les
 *    identifiants de 300 élèves fait une adresse de 12 000 caractères, proche de ce que le serveur
 *    accepte, et elle aurait échoué sans message avec quelques classes de plus ;
 *  - toutes les lectures sont parcourues page par page (la base rend 1 000 lignes au plus) ;
 *  - une lecture en échec arrête le chargement, et la page l'affiche, au lieu de calculer des
 *    notes sur des données partielles.
 */
import { supabase } from './supabase';
import { fetchAllPages } from './evaluationQueries';
import {
  buildStudentGrades,
  type ArchivedGradeRow,
  type ClassConfig,
  type EventRow,
  type ManualParticipation,
  type OralEvaluation,
  type StudentGrade,
  type StudentRow,
  type TrimesterSettings,
} from './implicationGrades';

/** Nombre d'identifiants d'élèves par requête. */
export const STUDENT_CHUNK = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface StudentsPageData {
  settings: TrimesterSettings;
  classes: { id: string; name: string }[];
  classConfigs: Map<string, ClassConfig>;
  studentGrades: StudentGrade[];
}

/** Le trimestre en cours de l'enseignant ; créé au premier passage (trimestre 1). */
async function fetchOrCreateTrimesterSettings(userId: string, defaultSchoolYear: string): Promise<TrimesterSettings> {
  const { data, error } = await supabase
    .from('trimester_settings')
    .select('current_trimester, school_year')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return { current_trimester: data.current_trimester, school_year: data.school_year };

  const settings = { current_trimester: 1, school_year: defaultSchoolYear };
  const { error: insertError } = await supabase.from('trimester_settings').insert({ user_id: userId, ...settings });
  // Comme avant : la page s'affiche sur le trimestre 1 même si l'enregistrement n'a pas pu se faire.
  if (insertError) console.warn('[studentsPageQueries] réglage du trimestre non enregistré :', insertError.message);
  return settings;
}

async function fetchStudentActivity(
  studentIds: readonly string[],
  settings: TrimesterSettings,
  trimesterStart: string,
): Promise<{ events: EventRow[]; manualParticipations: ManualParticipation[]; archivedGrades: ArchivedGradeRow[]; oralEvaluations: OralEvaluation[] }> {
  const perChunk = await Promise.all(chunk(studentIds, STUDENT_CHUNK).map(async (ids) => {
    const [events, manualParticipations, archivedGrades, oralEvaluations] = await Promise.all([
      fetchAllPages<EventRow>(async (from, to) => supabase
        .from('events')
        .select('id, student_id, session_id, type, subtype, note, timestamp')
        .in('student_id', ids)
        .gte('timestamp', trimesterStart)
        .order('timestamp', { ascending: false })
        .order('id')
        .range(from, to)),
      fetchAllPages<ManualParticipation>(async (from, to) => supabase
        .from('manual_participations')
        .select('id, student_id, trimester, school_year, count, reason, created_at')
        .in('student_id', ids)
        .eq('trimester', settings.current_trimester)
        .eq('school_year', settings.school_year)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)),
      fetchAllPages<ArchivedGradeRow>(async (from, to) => supabase
        .from('trimester_grades')
        .select('student_id, trimester, school_year, class_name, participations, absences, target_participations, adjusted_target, grade, bonus, archived_at')
        .in('student_id', ids)
        .order('school_year', { ascending: false })
        .order('id')
        .range(from, to)),
      fetchAllPages<OralEvaluation>(async (from, to) => supabase
        .from('oral_evaluations')
        .select('id, student_id, class_id, user_id, trimester, school_year, grade, evaluated_at')
        .in('student_id', ids)
        .eq('trimester', settings.current_trimester)
        .eq('school_year', settings.school_year)
        .order('id')
        .range(from, to)),
    ]);
    return { events, manualParticipations, archivedGrades, oralEvaluations };
  }));

  return {
    events: perChunk.flatMap((c) => c.events),
    manualParticipations: perChunk.flatMap((c) => c.manualParticipations),
    archivedGrades: perChunk.flatMap((c) => c.archivedGrades),
    oralEvaluations: perChunk.flatMap((c) => c.oralEvaluations),
  };
}

/**
 * Tout ce que la page affiche à l'ouverture : trimestre en cours, classes, réglages par classe,
 * et une ligne par élève avec sa note d'implication.
 */
export async function loadStudentsPage(userId: string, defaultSchoolYear: string): Promise<StudentsPageData> {
  const settings = await fetchOrCreateTrimesterSettings(userId, defaultSchoolYear);

  const [boundaries, classes, configs, students] = await Promise.all([
    supabase
      .from('trimester_boundaries')
      .select('trimester, school_year, started_at')
      .eq('user_id', userId)
      .eq('school_year', settings.school_year)
      .order('trimester'),
    supabase
      .from('classes')
      .select('id, name')
      .eq('user_id', userId)
      .order('name'),
    // Pas de filtre : la sécurité par ligne ne rend que les réglages des classes de l'enseignant.
    supabase
      .from('class_trimester_config')
      .select('class_id, target_participations, total_sessions_expected, bavardage_penalty, base_grade'),
    fetchAllPages<StudentRow>(async (from, to) => supabase
      .from('students')
      .select('id, pseudo, class_id, created_at, gender, student_code, is_witness, has_pap, has_ppre, has_pai, classes (name)')
      .eq('user_id', userId)
      .order('pseudo')
      .order('id')
      .range(from, to)),
  ]);
  if (boundaries.error) throw boundaries.error;
  if (classes.error) throw classes.error;
  if (configs.error) throw configs.error;

  const classConfigs = new Map<string, ClassConfig>();
  for (const c of configs.data ?? []) {
    classConfigs.set(c.class_id, {
      class_id: c.class_id,
      target_participations: c.target_participations,
      total_sessions_expected: c.total_sessions_expected,
      bavardage_penalty: c.bavardage_penalty ?? false,
      base_grade: c.base_grade ?? null,
    });
  }

  const base = { settings, classes: classes.data ?? [], classConfigs };
  if (students.length === 0) return { ...base, studentGrades: [] };

  // Début du trimestre en cours. Sans borne enregistrée, tout l'historique compte : c'est le cas
  // d'un enseignant qui n'est jamais « passé au trimestre suivant ». On ne crée pas la borne ici :
  // datée d'aujourd'hui, elle sortirait du calcul tous les événements déjà enregistrés.
  const boundary = (boundaries.data ?? []).find(
    (b) => b.trimester === settings.current_trimester && b.school_year === settings.school_year,
  );
  const trimesterStart = boundary?.started_at || new Date(0).toISOString();

  const activity = await fetchStudentActivity(students.map((s) => s.id), settings, trimesterStart);
  return { ...base, studentGrades: buildStudentGrades({ students, ...activity, classConfigs }) };
}
