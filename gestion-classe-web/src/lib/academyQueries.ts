import { supabase } from './supabase';

// ============================================================
// Academy Module — Queries Supabase
// ============================================================

export interface AcademyConfig {
  id: string;
  class_id: string;
  user_id: string;
  enabled: boolean;
}

export interface AcademyAssignment {
  id: string;
  student_id: string;
  class_id: string;
  house: HouseId;
  assigned_by: string;
  override: boolean;
  assigned_at: string;
}

export interface AcademyHouseBonus {
  id: string;
  class_id: string;
  user_id: string;
  house: HouseId;
  points: number;
  label: string;
  visible: boolean;
  created_at: string;
  revealed_at: string | null;
}

export interface AcademyQuestion {
  id: string;
  question_order: number;
  question_text: string;
}

export interface AcademyAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  display_order: number;
  salamandre_weight: number;
  vouivre_weight: number;
  zephyr_weight: number;
  taisson_weight: number;
}

export type HouseId = 'salamandre' | 'vouivre' | 'zephyr' | 'taisson';

export const HOUSES: readonly HouseId[] = ['salamandre', 'vouivre', 'zephyr', 'taisson'] as const;

// --- Config ---

export async function fetchAcademyConfig(classId: string): Promise<AcademyConfig | null> {
  const { data } = await supabase
    .from('academy_config')
    .select('*')
    .eq('class_id', classId)
    .maybeSingle();
  return data;
}

export async function fetchAllAcademyConfigs(userId: string): Promise<AcademyConfig[]> {
  const { data } = await supabase
    .from('academy_config')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true);
  return data || [];
}

export async function toggleAcademyModule(classId: string, userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('academy_config')
    .upsert({
      class_id: classId,
      user_id: userId,
      enabled,
    }, { onConflict: 'class_id' });
  if (error) throw error;
}

// --- Assignments ---

export async function fetchAssignments(classId: string): Promise<AcademyAssignment[]> {
  const { data } = await supabase
    .from('academy_assignments')
    .select('*')
    .eq('class_id', classId);
  return data || [];
}

export async function saveAssignment(
  studentId: string,
  classId: string,
  house: HouseId,
  override = true
): Promise<void> {
  const { error } = await supabase
    .from('academy_assignments')
    .upsert({
      student_id: studentId,
      class_id: classId,
      house,
      assigned_by: override ? 'manual' : 'algorithm',
      override,
      assigned_at: new Date().toISOString(),
    }, { onConflict: 'student_id,class_id' });
  if (error) throw error;
}

// --- Bonuses ---

export async function fetchBonuses(classId: string): Promise<AcademyHouseBonus[]> {
  const { data } = await supabase
    .from('academy_house_bonuses')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function saveBonus(
  classId: string,
  userId: string,
  house: HouseId,
  points: number,
  label: string,
  visible: boolean
): Promise<void> {
  const { error } = await supabase
    .from('academy_house_bonuses')
    .insert({
      class_id: classId,
      user_id: userId,
      house,
      points,
      label,
      visible,
    });
  if (error) throw error;
}

export async function revealBonuses(classId: string): Promise<void> {
  const { error } = await supabase
    .from('academy_house_bonuses')
    .update({ visible: true, revealed_at: new Date().toISOString() })
    .eq('class_id', classId)
    .eq('visible', false);
  if (error) throw error;
}

// --- Coefficients ---

export async function saveCoefficient(groupSessionId: string, coefficient: number): Promise<void> {
  const { error } = await supabase
    .from('academy_session_coefficients')
    .upsert({
      group_session_id: groupSessionId,
      coefficient,
    }, { onConflict: 'group_session_id' });
  if (error) throw error;
}

// --- Questions & Responses ---

export async function fetchQuestions(): Promise<(AcademyQuestion & { answers: AcademyAnswer[] })[]> {
  const { data: questions } = await supabase
    .from('academy_questions')
    .select('*')
    .order('question_order');

  const { data: answers } = await supabase
    .from('academy_answers')
    .select('*')
    .order('display_order');

  if (!questions) return [];

  return questions.map(q => ({
    ...q,
    answers: (answers || []).filter(a => a.question_id === q.id),
  }));
}

export async function fetchTestResponses(classId: string) {
  // Get all students in this class
  const { data: students } = await supabase
    .from('students')
    .select('id, pseudo')
    .eq('class_id', classId);

  if (!students || students.length === 0) return [];

  const studentIds = students.map(s => s.id);

  // Get responses
  const { data: responses } = await supabase
    .from('academy_responses')
    .select('*, academy_answers(*)')
    .in('student_id', studentIds);

  // Get preferences
  const { data: preferences } = await supabase
    .from('academy_preferences')
    .select('*')
    .in('student_id', studentIds);

  return students.map(s => ({
    student: s,
    responses: (responses || []).filter(r => r.student_id === s.id),
    preferences: (preferences || []).filter(p => p.student_id === s.id).sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank),
    hasCompleted: (responses || []).some(r => r.student_id === s.id),
  }));
}

// --- House Points Calculation ---

export interface HousePoints {
  house: HouseId;
  total_points: number;
  grade_points: number;
  bonus_points: number;
}

export async function calculateHousePoints(classId: string): Promise<HousePoints[]> {
  // Get assignments
  const assignments = await fetchAssignments(classId);

  // Get all group sessions for this class
  const { data: groupSessions } = await supabase
    .from('group_sessions')
    .select('id, status')
    .eq('class_id', classId)
    .eq('status', 'completed');

  // Get coefficients
  const sessionIds = (groupSessions || []).map(gs => gs.id);
  const { data: coefficients } = sessionIds.length > 0
    ? await supabase
        .from('academy_session_coefficients')
        .select('*')
        .in('group_session_id', sessionIds)
    : { data: [] };

  const coeffMap = new Map((coefficients || []).map(c => [c.group_session_id, c.coefficient]));

  // Get group grades for sessions
  let gradePointsByHouse: Record<HouseId, number> = { salamandre: 0, vouivre: 0, zephyr: 0, taisson: 0 };

  if (sessionIds.length > 0) {
    // Get session_groups with their names (house names)
    const { data: sessionGroups } = await supabase
      .from('session_groups')
      .select('id, session_id, name, conduct_malus')
      .in('session_id', sessionIds);

    for (const sg of sessionGroups || []) {
      const houseName = sg.name.toLowerCase() as HouseId;
      if (!HOUSES.includes(houseName)) continue;

      const { data: grades } = await supabase
        .from('group_grades')
        .select('points_awarded')
        .eq('group_id', sg.id);

      const totalGrade = (grades || []).reduce((sum, g) => sum + g.points_awarded, 0) - (sg.conduct_malus || 0);
      const coeff = coeffMap.get(sg.session_id) || 1.0;
      gradePointsByHouse[houseName] += totalGrade * coeff;
    }
  }

  // Get visible bonuses
  const bonuses = await fetchBonuses(classId);
  const bonusPointsByHouse: Record<HouseId, number> = { salamandre: 0, vouivre: 0, zephyr: 0, taisson: 0 };
  for (const b of bonuses) {
    if (b.visible && HOUSES.includes(b.house)) {
      bonusPointsByHouse[b.house] += b.points;
    }
  }

  return HOUSES.map(house => ({
    house,
    total_points: gradePointsByHouse[house] + bonusPointsByHouse[house],
    grade_points: gradePointsByHouse[house],
    bonus_points: bonusPointsByHouse[house],
  }));
}
