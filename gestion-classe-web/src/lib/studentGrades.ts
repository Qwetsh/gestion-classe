import { supabase } from './supabase';
import type { GradeStatus } from './gradeStats';

/**
 * Espace élève — notes d'évaluation (migration 040).
 *
 * L'élève n'est pas authentifié : il présente un code à 6 chiffres. Tout passe donc par
 * une RPC `SECURITY DEFINER` qui ne lui rend que ses propres notes, et par une Edge
 * Function pour les PDF — le bucket `assessment-docs` reste privé.
 *
 * Deux verrous, tous deux vérifiés côté serveur : l'onglet « Notes » doit être activé
 * pour la classe, et l'évaluation doit avoir été publiée par l'enseignant.
 */

export interface StudentAssessment {
  id: string;
  name: string;
  subject: string | null;
  date: string | null;
  period: number | null;
  kind: string;
  coefficient: number;
  bareme_total: number | null;
  counts_in_average: boolean;
  grade: number | null;
  grade_raw: number | null;
  comment: string | null;
  status: GradeStatus;
  has_subject: boolean;
  has_correction: boolean;
}

export interface StudentGradesResult {
  /** `false` quand l'enseignant n'a pas ouvert l'onglet Notes à cette classe. */
  enabled: boolean;
  assessments: StudentAssessment[];
}

export async function fetchStudentGrades(code: string): Promise<StudentGradesResult> {
  const { data, error } = await supabase.rpc('get_student_grades', { p_code: code });
  if (error) throw error;
  const result = data as { enabled?: boolean; assessments?: StudentAssessment[]; error?: string } | null;
  if (!result || result.error) return { enabled: false, assessments: [] };
  return { enabled: !!result.enabled, assessments: result.assessments ?? [] };
}

export type StudentDocKind = 'subject' | 'correction';

/**
 * URL signée (courte durée) du sujet ou du corrigé d'une évaluation.
 *
 * Passe par l'Edge Function `student-doc` : elle seule détient la clé de service et
 * revérifie les deux verrous. Le client ne peut donc pas se signer un accès lui-même.
 */
export async function fetchStudentDocUrl(
  code: string,
  assessmentId: string,
  kind: StudentDocKind,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('student-doc', {
    body: { code, assessmentId, kind },
  });
  if (error) throw new Error('Document indisponible');
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('Document indisponible');
  return url;
}
