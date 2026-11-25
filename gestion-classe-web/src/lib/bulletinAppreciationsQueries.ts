/**
 * Appréciations de bulletin (migration 091) : une par élève, année scolaire et trimestre.
 * Pronote n'a pas d'API professeur : l'application garde la copie, l'enseignant la recopie.
 */
import { supabase } from './supabase';

/** Limite du champ « Appréciation » de Pronote (et de la colonne en base). */
export const APPRECIATION_MAX_LENGTH = 300;

export interface BulletinAppreciation {
  id: string;
  student_id: string;
  class_id: string | null;
  class_name: string | null;
  school_year: string;
  trimester: number;
  content: string;
  copied_at: string | null;
  source: 'claude' | 'manual' | 'import';
  updated_at: string;
}

const COLUMNS = 'id, student_id, class_id, class_name, school_year, trimester, content, copied_at, source, updated_at';

/** Appréciations d'un trimestre pour une liste d'élèves (par élève, pas par classe : un élève
 *  qui a changé de classe garde son appréciation). */
export async function fetchAppreciationsForStudents(
  studentIds: string[],
  schoolYear: string,
  trimester: number,
): Promise<Map<string, BulletinAppreciation>> {
  const map = new Map<string, BulletinAppreciation>();
  if (studentIds.length === 0) return map;
  const { data, error } = await supabase
    .from('bulletin_appreciations')
    .select(COLUMNS)
    .in('student_id', studentIds)
    .eq('school_year', schoolYear)
    .eq('trimester', trimester);
  if (error) throw error;
  for (const row of (data ?? []) as BulletinAppreciation[]) map.set(row.student_id, row);
  return map;
}

/** Toutes les appréciations d'un élève, de la plus récente à la plus ancienne. */
export async function fetchStudentAppreciations(studentId: string): Promise<BulletinAppreciation[]> {
  const { data, error } = await supabase
    .from('bulletin_appreciations')
    .select(COLUMNS)
    .eq('student_id', studentId)
    .order('school_year', { ascending: false })
    .order('trimester', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BulletinAppreciation[];
}

/** Enregistre (ou remplace) l'appréciation ; un texte vide la supprime. Retourne la ligne,
 *  ou null si elle a été supprimée. Modifier le texte remet « à recopier ». */
export async function saveAppreciation(params: {
  userId: string;
  studentId: string;
  classId: string | null;
  className: string | null;
  schoolYear: string;
  trimester: number;
  content: string;
}): Promise<BulletinAppreciation | null> {
  const content = params.content.trim();
  if (!content) {
    const { error } = await supabase
      .from('bulletin_appreciations')
      .delete()
      .eq('student_id', params.studentId)
      .eq('school_year', params.schoolYear)
      .eq('trimester', params.trimester);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase
    .from('bulletin_appreciations')
    .upsert(
      {
        user_id: params.userId,
        student_id: params.studentId,
        class_id: params.classId,
        class_name: params.className,
        school_year: params.schoolYear,
        trimester: params.trimester,
        content: content.slice(0, APPRECIATION_MAX_LENGTH),
        copied_at: null,
        source: 'manual',
      },
      { onConflict: 'student_id,school_year,trimester' },
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as BulletinAppreciation;
}

/** Marque l'appréciation comme recopiée dans Pronote (bouton « Copier »). */
export async function markAppreciationCopied(id: string): Promise<string> {
  const copiedAt = new Date().toISOString();
  const { error } = await supabase.from('bulletin_appreciations').update({ copied_at: copiedAt }).eq('id', id);
  if (error) throw error;
  return copiedAt;
}
