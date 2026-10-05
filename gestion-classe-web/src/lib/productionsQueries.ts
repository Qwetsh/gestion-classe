import { supabase } from './supabase';

/**
 * Productions numériques : fiches d'activité remplies par les élèves dans une application
 * (ex. « Terre en mouvement », SVT 4e) et envoyées ici avec leur code élève.
 * Tables : activities, student_works, student_work_versions, activity_assessments (migration 046).
 * Les écritures élèves passent par des RPC SECURITY DEFINER ; ici, tout est filtré par la RLS du prof.
 */

export type WorkStatus = 'draft' | 'submitted' | 'corrected' | 'validated';

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  corrected: 'Corrigée',
  validated: 'Validée',
};

/** Critère de correction d'une question (points attribués si coché). */
export interface ActivityCriterion { id: string; nom: string; points: number }

export interface ActivityQuestion {
  id: string;
  num: string;
  points: number;
  bonus?: boolean;
  type: 'tableau' | 'deductive' | 'texte';
  titre: string;
  consigne: string;
  aide?: string;
  competences?: string[];
  champs?: { id: string; nom: string; aide?: string }[];
  criteres: ActivityCriterion[];
}

/** Instantané envoyé par l'application avec chaque production. */
export interface ActivityDefinition {
  competences?: { id: string; nom: string }[];
  lignes_q1?: { id: string; choix: string[] }[];
  colonnes_q1?: { id: string; nom: string; aide?: string; points: number }[];
  questions: ActivityQuestion[];
}

export interface ActivityRow {
  id: string;
  user_id: string;
  key: string;
  title: string;
  level: string | null;
  sequence: string | null;
  bareme_total: number;
  definition: ActivityDefinition;
  definition_version: number;
  expected_answers: string | null;
  accepting_submissions: boolean;
  created_at: string;
  updated_at: string;
}

/** Correction d'une question : critères cochés, points (libres si pas de critère), remarque. */
export interface QuestionCorrection {
  criteres?: Record<string, boolean>;
  points?: number | null;
  remarque?: string;
}

export interface WorkCorrection {
  questions: Record<string, QuestionCorrection>;
}

export interface WorkRow {
  id: string;
  activity_id: string;
  student_id: string;
  class_id: string | null;
  group_key: string | null;
  group_pseudos: string[];
  content: Record<string, unknown>;
  status: WorkStatus;
  version: number;
  first_submitted_at: string | null;
  submitted_at: string | null;
  modified_after_correction: boolean;
  correction: WorkCorrection | null;
  advice: string | null;
  skills: Record<string, number> | null;
  total_points: number | null;
  corrected_by: 'claude' | 'prof' | null;
  corrected_at: string | null;
  validated_at: string | null;
  updated_at: string;
  students: { pseudo: string; class_id: string | null } | null;
  classes: { name: string } | null;
}

export interface WorkVersionRow {
  id: string;
  work_id: string;
  version: number;
  content: Record<string, unknown>;
  submitted_at: string;
}

const WORK_SELECT =
  'id, activity_id, student_id, class_id, group_key, group_pseudos, content, status, version,' +
  ' first_submitted_at, submitted_at, modified_after_correction, correction, advice, skills, total_points,' +
  ' corrected_by, corrected_at, validated_at, updated_at, students(pseudo, class_id), classes(name)';

export async function fetchActivities(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function updateActivity(
  id: string,
  patch: Partial<Pick<ActivityRow, 'title' | 'expected_answers' | 'accepting_submissions' | 'bareme_total'>>,
): Promise<void> {
  const { error } = await supabase.from('activities').update(patch).eq('id', id);
  if (error) throw error;
}

export async function fetchWorks(activityId: string): Promise<WorkRow[]> {
  const { data, error } = await supabase
    .from('student_works')
    .select(WORK_SELECT)
    .eq('activity_id', activityId)
    .eq('is_deleted', false)
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as WorkRow[];
}

export async function fetchWorkVersions(workId: string): Promise<WorkVersionRow[]> {
  const { data, error } = await supabase
    .from('student_work_versions')
    .select('*')
    .eq('work_id', workId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkVersionRow[];
}

/** Élèves d'une classe (pour lister ceux qui n'ont rien envoyé). */
export async function fetchClassStudents(classId: string): Promise<{ id: string; pseudo: string }[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, pseudo')
    .eq('class_id', classId)
    .eq('is_deleted', false)
    .order('pseudo');
  if (error) throw error;
  return data ?? [];
}

/** Total d'une correction d'après les critères cochés (ou les points libres), bonus exclu. */
export function computeTotal(def: ActivityDefinition, corr: WorkCorrection | null): number | null {
  if (!corr) return null;
  let total = 0;
  for (const q of def.questions) {
    if (q.bonus) continue;
    const c = corr.questions[q.id];
    if (!c) continue;
    if (typeof c.points === 'number') { total += c.points; continue; }
    for (const cr of q.criteres) if (c.criteres?.[cr.id]) total += cr.points;
  }
  return Math.round(total * 100) / 100;
}

export async function saveWorkCorrection(
  workId: string,
  input: { correction: WorkCorrection; advice: string | null; skills: Record<string, number> | null; totalPoints: number | null; correctedBy: 'claude' | 'prof' },
): Promise<void> {
  const { error } = await supabase
    .from('student_works')
    .update({
      correction: input.correction,
      advice: input.advice,
      skills: input.skills,
      total_points: input.totalPoints,
      corrected_by: input.correctedBy,
      corrected_at: new Date().toISOString(),
      status: 'corrected',
      modified_after_correction: false,
    })
    .eq('id', workId);
  if (error) throw error;
}

/**
 * Suppression définitive d'une production (et de son historique, en cascade).
 * Volontairement pas un soft delete : la RPC student_work_save retrouve la ligne par
 * (activity_id, student_id) et la réutiliserait en la laissant masquée. Après suppression,
 * le prochain envoi de l'élève repart proprement d'une nouvelle ligne (envoi n°1).
 */
export async function deleteWork(workId: string): Promise<void> {
  const { error } = await supabase.from('student_works').delete().eq('id', workId);
  if (error) throw error;
}

export async function setWorkStatus(workId: string, status: WorkStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'validated') patch.validated_at = new Date().toISOString();
  if (status === 'corrected' || status === 'submitted') patch.validated_at = null;
  const { error } = await supabase.from('student_works').update(patch).eq('id', workId);
  if (error) throw error;
}
