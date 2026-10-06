import { supabase } from './supabase';
import { createAssessment, saveGrade } from './evaluationQueries';
import { toTwenty } from './gradeStats';

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

/** Critère de correction d'une question (points attribués si coché).
 *  `auto` : le critère se vérifie tout seul d'après une réponse à choix (tableau de la question 1). */
export interface ActivityCriterion { id: string; nom: string; points: number; auto?: { ligne: string; colonne: string } }

export interface ActivityQuestion {
  id: string;
  num: string;
  points: number;
  bonus?: boolean;
  /** Question à réponses fermées : corrigée automatiquement, le prof garde la main. */
  auto?: boolean;
  type: 'tableau' | 'deductive' | 'texte';
  titre: string;
  consigne: string;
  aide?: string;
  competences?: string[];
  champs?: { id: string; nom: string; aide?: string }[];
  criteres: ActivityCriterion[];
}

/** Instantané envoyé par l'application avec chaque production. */
export interface ActivityColumnField { id: string; nom?: string; unite?: string; choix?: boolean; bool?: boolean }
/** v2-v3 : relief, seismes, volcans, gps_sens, gps_vitesse ; v4 (missions) : type, mouvement, indices. */
export interface ActivityExpectedQ1 { relief?: string; seismes?: string; volcans?: string; gps_sens?: string; gps_vitesse?: number; mouvement?: string; type: string; indices: string[] }
export interface ActivityDefinition {
  competences?: { id: string; nom: string }[];
  lignes_q1?: { id: string; choix: string[] }[];
  /** Depuis la définition v2 : chaque colonne liste ses cases (`champs`), menus ou nombre. */
  colonnes_q1?: { id: string; nom: string; aide?: string; points: number; champs?: ActivityColumnField[] }[];
  /** Libellés des menus de la question 1, par champ. */
  choix_q1?: Record<string, { id: string; nom: string }[]>;
  /** Réponses attendues de la question 1, par zone : sert à la correction automatique. */
  attendu_q1?: Record<string, ActivityExpectedQ1>;
  tolerance_vitesse?: number;
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

/* ---------- correction automatique (réponses à choix) ---------- */

export type Q1Row = Record<string, unknown>;

/** Libellé d'une valeur enregistrée : menu (id → nom), liste d'ids, booléen, nombre avec unité, ou valeur brute. */
export function q1Label(def: ActivityDefinition, field: ActivityColumnField, value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map((v) => q1Label(def, field, v)).filter(Boolean).join(', ');
  if (typeof value === 'boolean' || field.bool) return value ? (field.nom ?? 'oui') : `non ${field.nom ?? ''}`.trim();
  const s = String(value);
  const opt = def.choix_q1?.[field.id]?.find((o) => o.id === s);
  if (opt) return opt.nom;
  const texte = field.unite ? `${s} ${field.unite}` : s;
  return field.nom && !field.unite && typeof value === 'number' ? `${texte} ${field.nom}` : texte;
}

/**
 * Vérifie une colonne du tableau de la question 1 pour une ligne (zone choisie par l'élève).
 * null : pas vérifiable (zone absente ou définition sans corrigé). Même règle que `verifierQ1` dans l'application.
 */
export function checkQ1Cell(def: ActivityDefinition, row: Q1Row | undefined, colonne: string): boolean | null {
  const zone = typeof row?.zone === 'string' ? row.zone : '';
  const att = zone ? def.attendu_q1?.[zone] : undefined;
  if (!att || !row) return null;
  // v4 : la question 1 est la mission de l'application.
  if (colonne === 'finalisee') return row.ok === true;
  if (colonne === 'hypothese') return row.ok === true && Number(row.essais_hyp) <= 2;
  if (colonne === 'indice') return typeof row.indice === 'string' && !!row.indice && att.indices.includes(row.indice);
  if (colonne === 'type' && 'essais_type' in row) return row.ok === true && Number(row.essais_type) <= 1;
  // v2-v3 : réponses à choix.
  if (colonne === 'gps') {
    const v = parseFloat(String(row.gps_vitesse ?? '').replace(',', '.'));
    const tol = def.tolerance_vitesse ?? 0.5;
    return row.gps_sens === att.gps_sens && Number.isFinite(v) && att.gps_vitesse != null && Math.abs(v - att.gps_vitesse) <= tol;
  }
  const key = colonne as keyof ActivityExpectedQ1;
  return !!row[colonne] && row[colonne] === att[key];
}

/** L'activité a-t-elle des critères corrigés automatiquement ? */
export function hasAuto(def: ActivityDefinition): boolean {
  return def.questions.some((q) => q.criteres.some((c) => c.auto));
}

/**
 * Correction automatique : pour chaque critère `auto`, vrai/faux d'après la réponse de l'élève.
 * Ne renvoie que les questions qui ont au moins un critère automatique ; null si l'activité n'en a aucun.
 */
export function autoCorrection(def: ActivityDefinition, content: Record<string, unknown>): Record<string, Record<string, boolean>> | null {
  if (!hasAuto(def)) return null;
  const out: Record<string, Record<string, boolean>> = {};
  for (const q of def.questions) {
    const rows = (content[q.id] ?? {}) as Record<string, Q1Row>;
    for (const cr of q.criteres) {
      if (!cr.auto) continue;
      (out[q.id] ??= {})[cr.id] = checkQ1Cell(def, rows[cr.auto.ligne], cr.auto.colonne) === true;
    }
  }
  return out;
}

/** Points obtenus / possibles sur les seuls critères automatiques (aperçu avant correction). */
export function autoPoints(def: ActivityDefinition, content: Record<string, unknown>): { points: number; max: number } | null {
  const auto = autoCorrection(def, content);
  if (!auto) return null;
  let points = 0, max = 0;
  for (const q of def.questions) {
    if (q.bonus) continue;
    for (const cr of q.criteres) {
      if (!cr.auto) continue;
      max += cr.points;
      if (auto[q.id]?.[cr.id]) points += cr.points;
    }
  }
  return { points: Math.round(points * 100) / 100, max: Math.round(max * 100) / 100 };
}

/** Applique la correction automatique à une correction existante (les questions ouvertes ne sont pas touchées). */
export function applyAuto(def: ActivityDefinition, corr: WorkCorrection, content: Record<string, unknown>, onlyQuestion?: string): WorkCorrection {
  const auto = autoCorrection(def, content);
  if (!auto) return corr;
  const questions = { ...corr.questions };
  for (const [qid, criteres] of Object.entries(auto)) {
    if (onlyQuestion && qid !== onlyQuestion) continue;
    const q = questions[qid] ?? {};
    questions[qid] = { ...q, criteres: { ...(q.criteres ?? {}), ...criteres }, points: null };
  }
  return { questions };
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

/* ---------- envoi des notes dans le carnet ---------- */

/** Évaluation du carnet liée à une activité pour une classe (table activity_assessments). */
export interface ActivityAssessmentRow {
  activity_id: string;
  class_id: string;
  assessment_id: string;
  written_assessments: { name: string; is_deleted: boolean } | null;
}

export async function fetchActivityAssessments(activityId: string): Promise<ActivityAssessmentRow[]> {
  const { data, error } = await supabase
    .from('activity_assessments')
    .select('activity_id, class_id, assessment_id, written_assessments(name, is_deleted)')
    .eq('activity_id', activityId);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityAssessmentRow[];
}

/** Copies dont la note peut partir au carnet : corrigées ou validées, avec un total. */
export const gradableWorks = (works: WorkRow[]): WorkRow[] =>
  works.filter((w) => w.total_points != null && (w.status === 'corrected' || w.status === 'validated'));

/**
 * Envoie les notes des copies corrigées d'une classe dans le carnet.
 * L'évaluation du carnet (TP, coefficient 1, barème de l'activité) est créée au premier envoi et mémorisée
 * dans activity_assessments ; les envois suivants mettent les notes à jour sur la même évaluation.
 */
export async function sendGradesToCarnet(input: {
  userId: string;
  activity: ActivityRow;
  classId: string;
  works: WorkRow[];
}): Promise<{ assessmentId: string; created: boolean; sent: number }> {
  const bareme = Number(input.activity.bareme_total) || 10;
  const links = await fetchActivityAssessments(input.activity.id);
  const link = links.find((l) => l.class_id === input.classId);
  let assessmentId = link && !link.written_assessments?.is_deleted ? link.assessment_id : null;
  let created = false;
  if (!assessmentId) {
    const a = await createAssessment({
      userId: input.userId,
      classId: input.classId,
      name: input.activity.title,
      subject: 'SVT',
      date: new Date().toISOString().slice(0, 10),
      baremeTotal: bareme,
      coefficient: 1,
      kind: 'tp',
    });
    assessmentId = a.id;
    created = true;
    const { error } = await supabase
      .from('activity_assessments')
      .upsert({ activity_id: input.activity.id, class_id: input.classId, assessment_id: assessmentId, user_id: input.userId }, { onConflict: 'activity_id,class_id' });
    if (error) throw error;
  }
  let sent = 0;
  for (const w of gradableWorks(input.works)) {
    const raw = Number(w.total_points);
    const grade = toTwenty(raw, bareme);
    await saveGrade({
      userId: input.userId,
      assessmentId,
      studentId: w.student_id,
      raw,
      grade: grade == null ? null : Math.round(grade * 100) / 100,
      status: 'noted',
    });
    sent++;
  }
  return { assessmentId, created, sent };
}

export async function setWorkStatus(workId: string, status: WorkStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'validated') patch.validated_at = new Date().toISOString();
  if (status === 'corrected' || status === 'submitted') patch.validated_at = null;
  const { error } = await supabase.from('student_works').update(patch).eq('id', workId);
  if (error) throw error;
}
