import { supabase } from './supabase';

// Buckets (memes noms que cote mobile / migrations)
const COPIES_BUCKET = 'assessment-copies';
const DOCS_BUCKET = 'assessment-docs';

export type AssessmentDocKind = 'subject' | 'correction';

export interface AssessmentRow {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  subject: string | null;
  date: string | null;
  bareme_total: number | null;
  subject_path: string | null;
  correction_path: string | null;
  created_at: string;
  is_deleted: boolean;
  classes?: { name: string } | null;
}

export interface CopyPageRow {
  id: string;
  assessment_id: string;
  student_id: string;
  page_order: number;
  storage_path: string;
  students?: { pseudo: string } | null;
}

export interface GradeRow {
  id: string;
  assessment_id: string;
  student_id: string;
  grade: number | null;
  grade_raw: number | null;
  comment: string | null;
  is_validated: boolean;
  validated_at: string | null;
  students?: { pseudo: string } | null;
}

export interface ClassRow {
  id: string;
  name: string;
}

/** Classes de l'utilisateur (pour le selecteur de creation d'eval). */
export async function fetchClasses(userId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return (data || []) as ClassRow[];
}

export interface CreateAssessmentInput {
  userId: string;
  classId: string;
  name: string;
  subject?: string | null;
  date?: string | null;
  baremeTotal?: number;
}

/** Cree une evaluation depuis le web. Renvoie la ligne creee. */
export async function createAssessment(input: CreateAssessmentInput): Promise<AssessmentRow> {
  const { data, error } = await supabase
    .from('written_assessments')
    .insert({
      user_id: input.userId,
      class_id: input.classId,
      name: input.name,
      subject: input.subject ?? null,
      date: input.date ?? null,
      bareme_total: input.baremeTotal ?? 20,
    })
    .select('*, classes(name)')
    .single();
  if (error) throw error;
  return data as AssessmentRow;
}

/** Liste des evals (non supprimees) de l'utilisateur, classe incluse, recentes d'abord. */
export async function fetchAssessments(userId: string): Promise<AssessmentRow[]> {
  const { data, error } = await supabase
    .from('written_assessments')
    .select('*, classes(name)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AssessmentRow[];
}

/** Pages de copies d'une eval, avec le pseudo de l'eleve, triees par eleve puis page. */
export async function fetchAssessmentCopies(assessmentId: string): Promise<CopyPageRow[]> {
  const { data, error } = await supabase
    .from('assessment_copy_pages')
    .select('id, assessment_id, student_id, page_order, storage_path, students(pseudo)')
    .eq('assessment_id', assessmentId)
    .order('student_id')
    .order('page_order');
  if (error) throw error;
  return (data || []) as unknown as CopyPageRow[];
}

/** Notes d'une eval (brouillon + validees), avec le pseudo. */
export async function fetchAssessmentGrades(assessmentId: string): Promise<GradeRow[]> {
  const { data, error } = await supabase
    .from('assessment_grades')
    .select('id, assessment_id, student_id, grade, grade_raw, comment, is_validated, validated_at, students(pseudo)')
    .eq('assessment_id', assessmentId);
  if (error) throw error;
  return (data || []) as unknown as GradeRow[];
}

/** Signed URL d'une page de copie (bucket prive assessment-copies). */
export async function getCopyUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(COPIES_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** Signed URL d'un document (sujet/correction, bucket prive assessment-docs). */
export async function getDocUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

function extOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === 'application/pdf' ? 'pdf' : 'jpg';
}

/**
 * Upload du sujet ou de la correction depuis le web. Remplace l'ancien fichier si present
 * (chemin different -> on supprime l'orphelin), met a jour la colonne subject_path/correction_path.
 * Renvoie le storage_path enregistre.
 */
export async function uploadAssessmentDoc(
  userId: string,
  assessmentId: string,
  kind: AssessmentDocKind,
  file: File,
  previousPath: string | null,
): Promise<string> {
  const path = `${userId}/${assessmentId}/${kind}.${extOf(file)}`;

  const { error: upErr } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) throw upErr;

  // Nettoie l'ancien fichier si l'extension a change (chemin different)
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(DOCS_BUCKET).remove([previousPath]);
  }

  const column = kind === 'subject' ? 'subject_path' : 'correction_path';
  const { error: updErr } = await supabase
    .from('written_assessments')
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (updErr) throw updErr;

  return path;
}

/** Supprime un document (sujet/correction) : fichier Storage + colonne remise a null. */
export async function deleteAssessmentDoc(
  assessmentId: string,
  kind: AssessmentDocKind,
  path: string,
): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([path]);
  const column = kind === 'subject' ? 'subject_path' : 'correction_path';
  const { error } = await supabase
    .from('written_assessments')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (error) throw error;
}

export interface StudentValidatedGrade {
  id: string;
  assessment_id: string;
  grade: number | null;
  grade_raw: number | null;
  comment: string | null;
  validated_at: string | null;
  written_assessments?: {
    name: string;
    subject: string | null;
    date: string | null;
    bareme_total: number | null;
  } | null;
}

/** Notes d'eval VALIDEES d'un eleve (pour la fiche eleve), eval incluse, recentes d'abord. */
export async function fetchStudentValidatedGrades(studentId: string): Promise<StudentValidatedGrade[]> {
  const { data, error } = await supabase
    .from('assessment_grades')
    .select('id, assessment_id, grade, grade_raw, comment, validated_at, written_assessments(name, subject, date, bareme_total)')
    .eq('student_id', studentId)
    .eq('is_validated', true)
    .order('validated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as StudentValidatedGrade[];
}

/** Valide une note (is_validated = true). */
export async function validateGrade(gradeId: string): Promise<void> {
  const { error } = await supabase
    .from('assessment_grades')
    .update({ is_validated: true, validated_at: new Date().toISOString() })
    .eq('id', gradeId);
  if (error) throw error;
}
