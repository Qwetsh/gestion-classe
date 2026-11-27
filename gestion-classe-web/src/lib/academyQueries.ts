import { supabase } from './supabase';
import { fromDb } from './dbJson';

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
  gryffondor_weight: number;
  serpentard_weight: number;
  serdaigle_weight: number;
  poufsouffle_weight: number;
}

export type HouseId = 'gryffondor' | 'serpentard' | 'serdaigle' | 'poufsouffle';

export const HOUSES: readonly HouseId[] = ['gryffondor', 'serpentard', 'serdaigle', 'poufsouffle'] as const;

// Lookup: nom de groupe (session_groups.name) → HouseId
// Supporte le nom exact (insensible à la casse)
export const HOUSE_NAME_TO_ID: Record<string, HouseId> = {
  gryffondor: 'gryffondor',
  serpentard: 'serpentard',
  serdaigle: 'serdaigle',
  poufsouffle: 'poufsouffle',
};

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
  return fromDb<AcademyAssignment[]>(data || []);
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
  return fromDb<AcademyHouseBonus[]>(data || []);
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

export async function deleteBonus(bonusId: string): Promise<void> {
  const { error } = await supabase
    .from('academy_house_bonuses')
    .delete()
    .eq('id', bonusId);
  if (error) throw error;
}

export async function resetAcademyForClass(classId: string): Promise<void> {
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId);
  const studentIds = (students || []).map(s => s.id);

  if (studentIds.length > 0) {
    await supabase.from('academy_responses').delete().in('student_id', studentIds);
    await supabase.from('academy_preferences').delete().in('student_id', studentIds);
  }

  await supabase.from('academy_assignments').delete().eq('class_id', classId);
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

export async function saveQuestion(
  questionId: string | null,
  questionOrder: number,
  questionText: string,
  answers: { id?: string; answer_text: string; display_order: number; gryffondor_weight: number; serpentard_weight: number; serdaigle_weight: number; poufsouffle_weight: number }[],
): Promise<string> {
  let qId = questionId;

  if (qId) {
    const { error } = await supabase
      .from('academy_questions')
      .update({ question_order: questionOrder, question_text: questionText })
      .eq('id', qId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('academy_questions')
      .insert({ question_order: questionOrder, question_text: questionText })
      .select('id')
      .single();
    if (error) throw error;
    qId = data.id;
  }

  // Les réponses possibles sont modifiées sur place : les effacer pour les
  // recréer supprimerait les réponses déjà données par les élèves (le
  // questionnaire est commun à tous les comptes).
  let existing: { id: string; display_order: number }[] = [];
  if (questionId) {
    const { data, error } = await supabase
      .from('academy_answers')
      .select('id, display_order')
      .eq('question_id', qId!)
      .order('display_order');
    if (error) throw error;
    existing = data || [];
  }

  const plan = planAnswerSync(existing, answers);
  for (const u of plan.updates) {
    const { error } = await supabase.from('academy_answers').update(answerFields(u.answer)).eq('id', u.id);
    if (error) throw error;
  }
  if (plan.inserts.length > 0) {
    const { error } = await supabase
      .from('academy_answers')
      .insert(plan.inserts.map(a => ({ question_id: qId!, ...answerFields(a) })));
    if (error) throw error;
  }
  if (plan.deleteIds.length > 0) {
    const { error } = await supabase.from('academy_answers').delete().in('id', plan.deleteIds);
    if (error) throw toQuestionnaireError(error, 'Des élèves ont déjà choisi une des réponses retirées : elle ne peut plus être supprimée.');
  }

  return qId!;
}

type AnswerInput = { answer_text: string; display_order: number; gryffondor_weight: number; serpentard_weight: number; serdaigle_weight: number; poufsouffle_weight: number };

function answerFields(a: AnswerInput): AnswerInput {
  return {
    answer_text: a.answer_text,
    display_order: a.display_order,
    gryffondor_weight: a.gryffondor_weight,
    serpentard_weight: a.serpentard_weight,
    serdaigle_weight: a.serdaigle_weight,
    poufsouffle_weight: a.poufsouffle_weight,
  };
}

/**
 * Répartit les réponses saisies entre réponses existantes (mises à jour sur
 * place, dans l'ordre d'affichage), réponses à créer et réponses en trop.
 */
export function planAnswerSync<A>(
  existing: { id: string; display_order: number }[],
  answers: A[],
): { updates: { id: string; answer: A }[]; inserts: A[]; deleteIds: string[] } {
  const sorted = [...existing].sort((a, b) => a.display_order - b.display_order);
  return {
    updates: answers.slice(0, sorted.length).map((answer, i) => ({ id: sorted[i].id, answer })),
    inserts: answers.slice(sorted.length),
    deleteIds: sorted.slice(answers.length).map(e => e.id),
  };
}

/** Une suppression refusée parce que des élèves ont déjà répondu (clé étrangère, code 23503). */
function toQuestionnaireError(error: { code?: string; message: string }, message: string): Error {
  return error.code === '23503' ? new Error(message) : new Error(error.message);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('academy_questions')
    .delete()
    .eq('id', questionId);
  if (error) throw toQuestionnaireError(error, 'Des élèves ont déjà répondu à cette question : elle ne peut plus être supprimée. Vous pouvez la modifier.');
}

export async function fetchTestResponses(classId: string) {
  const { data: students } = await supabase
    .from('students')
    .select('id, pseudo')
    .eq('class_id', classId);

  if (!students || students.length === 0) return [];

  const studentIds = students.map(s => s.id);

  const { data: responses } = await supabase
    .from('academy_responses')
    .select('*, academy_answers(*)')
    .in('student_id', studentIds);

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
  // Fetch sessions and bonuses in parallel
  const [{ data: groupSessions }, bonuses] = await Promise.all([
    supabase
      .from('group_sessions')
      .select('id, status')
      .eq('class_id', classId)
      .eq('status', 'completed'),
    fetchBonuses(classId),
  ]);

  const sessionIds = (groupSessions || []).map(gs => gs.id);

  let gradePointsByHouse: Record<HouseId, number> = { gryffondor: 0, serpentard: 0, serdaigle: 0, poufsouffle: 0 };

  if (sessionIds.length > 0) {
    // Fetch coefficients, session_groups, and all grades in parallel
    const [{ data: coefficients }, { data: sessionGroups }] = await Promise.all([
      supabase.from('academy_session_coefficients').select('*').in('group_session_id', sessionIds),
      supabase.from('session_groups').select('id, session_id, name, conduct_malus').in('session_id', sessionIds),
    ]);

    const coeffMap = new Map((coefficients || []).map(c => [c.group_session_id, c.coefficient]));
    const groupIds = (sessionGroups || []).map(sg => sg.id);

    // Batch fetch ALL grades at once instead of N+1
    let allGrades: any[] = [];
    if (groupIds.length > 0) {
      const { data: gradesData } = await supabase
        .from('group_grades')
        .select('group_id, points_awarded')
        .in('group_id', groupIds);
      allGrades = gradesData || [];
    }

    for (const sg of sessionGroups || []) {
      const houseId = HOUSE_NAME_TO_ID[(sg.name ?? '').toLowerCase()];
      if (!houseId) continue;

      const grades = allGrades.filter(g => g.group_id === sg.id);
      const totalGrade = grades.reduce((sum, g) => sum + g.points_awarded, 0) - (sg.conduct_malus || 0);
      const coeff = coeffMap.get(sg.session_id) || 1.0;
      gradePointsByHouse[houseId] += totalGrade * coeff;
    }
  }

  const bonusPointsByHouse: Record<HouseId, number> = { gryffondor: 0, serpentard: 0, serdaigle: 0, poufsouffle: 0 };
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
