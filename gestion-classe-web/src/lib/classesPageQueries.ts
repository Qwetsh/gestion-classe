/**
 * Chargement des données de la page « Classes » (pages/Classes.tsx) : classes et effectifs,
 * salles, élèves d'une classe, plan de classe, et notes affichées sur les places.
 *
 * Mêmes précautions que `studentsPageQueries.ts` : listes d'élèves par paquets, lectures
 * parcourues page par page, et une lecture en échec lève une erreur au lieu de laisser calculer
 * sur des données partielles.
 */
import type { Room, TableGroup } from '../components/RoomModal';
import { supabase } from './supabase';
import { toJson } from './dbJson';
import { fetchAllPages } from './paging';
import { STUDENT_CHUNK, chunk } from './studentsPageQueries';
import { buildSeatGrades, type SeatEventRow, type SeatGrade } from './seatGrades';
import type { GradeRules } from './implicationGrades';

export interface ClassWithCount {
  id: string;
  name: string;
  created_at: string;
  students_count: number;
}

export interface ClassStudent {
  id: string;
  pseudo: string;
  created_at: string;
  gender?: 'M' | 'F' | null;
  has_pap?: boolean;
  has_ppre?: boolean;
  has_pai?: boolean;
}

/** Positions du plan : « ligne-colonne » → identifiant d'élève (même format que l'app mobile). */
export type Positions = Record<string, string>;

export interface ClassRoomPlan {
  id: string;
  class_id: string;
  room_id: string;
  positions: Positions;
}

/** Les classes de l'enseignant, par nom, avec leur effectif. */
export async function fetchClassesWithCounts(userId: string): Promise<ClassWithCount[]> {
  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  if (!classes || classes.length === 0) return [];

  const classIds = classes.map((c) => c.id);
  const members = await fetchAllPages<{ class_id: string | null }>(async (from, to) => supabase
    .from('students')
    .select('class_id')
    .in('class_id', classIds)
    .order('id')
    .range(from, to));

  const countByClass = new Map<string, number>();
  for (const m of members) {
    if (m.class_id) countByClass.set(m.class_id, (countByClass.get(m.class_id) ?? 0) + 1);
  }
  return classes.map((c) => ({ ...c, students_count: countByClass.get(c.id) ?? 0 }));
}

/** Les salles de l'enseignant, par nom. */
export async function fetchRooms(userId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  // La ligne est rendue telle quelle, comme avant : la page relit ses autres colonnes. Les
  // colonnes JSON prennent leur forme applicative, que la base ne garantit pas.
  return (data ?? []).map((room) => ({
    ...room,
    disabled_cells: (room.disabled_cells as string[] | null) || [],
  })) as unknown as Room[];
}

/** Enregistre les liaisons entre tables d'une salle. Un échec est seulement journalisé, comme avant. */
export async function saveRoomTableGroups(roomId: string, groups: TableGroup[]): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ table_groups: toJson(groups), updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) console.warn('[classesPageQueries] liaisons de tables non enregistrées :', error.message);
}

/** Les élèves d'une classe, par pseudonyme. */
export async function fetchClassStudents(classId: string): Promise<ClassStudent[]> {
  const rows = await fetchAllPages(async (from, to) => supabase
    .from('students')
    .select('id, pseudo, created_at, gender, has_pap, has_ppre, has_pai')
    .eq('class_id', classId)
    .order('pseudo')
    .order('id')
    .range(from, to));
  return rows.map((s) => ({
    ...s,
    gender: s.gender === 'M' || s.gender === 'F' ? s.gender : null,
  }));
}

/** Le plan d'une classe dans une salle, s'il existe. */
export async function fetchClassRoomPlan(classId: string, roomId: string): Promise<ClassRoomPlan | null> {
  const { data, error } = await supabase
    .from('class_room_plans')
    .select('id, class_id, room_id, positions')
    .eq('class_id', classId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, positions: (data.positions as Positions | null) || {} };
}

/**
 * La note, la courbe et la tendance de chaque élève de la classe, pour le trimestre en cours de
 * l'enseignant. Sans réglage enregistré : trimestre 1 de `defaultSchoolYear`, et les réglages de
 * classe par défaut. Sans borne de début de trimestre : tout l'historique compte.
 */
export async function fetchSeatGrades(
  userId: string,
  classId: string,
  studentIds: readonly string[],
  defaultSchoolYear: string,
): Promise<Map<string, SeatGrade>> {
  if (studentIds.length === 0) return new Map();

  const [config, settings] = await Promise.all([
    supabase
      .from('class_trimester_config')
      .select('target_participations, total_sessions_expected, bavardage_penalty, base_grade')
      .eq('class_id', classId)
      .maybeSingle(),
    supabase
      .from('trimester_settings')
      .select('current_trimester, school_year')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (config.error) throw config.error;
  if (settings.error) throw settings.error;

  const rules: GradeRules | undefined = config.data
    ? {
      target_participations: config.data.target_participations,
      total_sessions_expected: config.data.total_sessions_expected,
      bavardage_penalty: config.data.bavardage_penalty ?? false,
      base_grade: config.data.base_grade ?? null,
    }
    : undefined;
  const trimester = settings.data?.current_trimester || 1;
  const schoolYear = settings.data?.school_year || defaultSchoolYear;

  const boundary = await supabase
    .from('trimester_boundaries')
    .select('started_at')
    .eq('user_id', userId)
    .eq('trimester', trimester)
    .eq('school_year', schoolYear)
    .maybeSingle();
  if (boundary.error) throw boundary.error;
  const trimesterStart = boundary.data?.started_at || new Date(0).toISOString();

  const perChunk = await Promise.all(chunk(studentIds, STUDENT_CHUNK).map(async (ids) => {
    const [events, manual] = await Promise.all([
      // Du plus ancien au plus récent : la courbe montre les dix dernières séances.
      fetchAllPages<SeatEventRow>(async (from, to) => supabase
        .from('events')
        .select('student_id, type, session_id')
        .in('student_id', ids)
        .gte('timestamp', trimesterStart)
        .order('timestamp')
        .order('id')
        .range(from, to)),
      fetchAllPages<{ student_id: string; count: number }>(async (from, to) => supabase
        .from('manual_participations')
        .select('student_id, count')
        .in('student_id', ids)
        .eq('trimester', trimester)
        .eq('school_year', schoolYear)
        .order('id')
        .range(from, to)),
    ]);
    return { events, manual };
  }));

  return buildSeatGrades(
    studentIds,
    perChunk.flatMap((c) => c.events),
    perChunk.flatMap((c) => c.manual),
    rules,
  );
}
