import { supabase } from './supabase';

/**
 * Collèges partagés (migration 043) : un élève a un seul code, et chaque prof du collège
 * qui l'a dans une classe possède sa propre ligne `students` rattachée à la même identité.
 *
 * Tout passe par des RPC SECURITY DEFINER : les tables collège ne sont pas écrivables
 * directement, et un prof ne lit jamais les lignes élèves d'un collègue.
 */

export interface SchoolSummary {
  id: string;
  name: string;
  city: string | null;
  uai: string | null;
  member_count: number;
}

export interface SchoolMember {
  user_id: string;
  display_name: string;
  subject: string | null;
  role: 'admin' | 'member';
  joined_at: string;
  is_me: boolean;
}

export interface MySchool {
  id: string;
  name: string;
  city: string | null;
  uai: string | null;
  my_role: 'admin' | 'member';
  my_display_name: string;
  my_subject: string | null;
  members: SchoolMember[];
}

export interface SchoolClass {
  id: string;
  name: string;
  school_year: string;
  student_count: number;
  teachers: string[] | null;
  /** J'ai déjà une classe rattachée à celle-ci. */
  mine: boolean;
}

export interface SchoolClassStudent {
  identity_id: string;
  pseudo: string;
  gender: 'M' | 'F' | null;
  has_pap: boolean;
  has_ppre: boolean;
  has_pai: boolean;
  already_mine: boolean;
}

/** Messages lisibles pour les erreurs levées par les RPC. */
const ERROR_LABELS: Record<string, string> = {
  already_member: 'Vous êtes déjà rattaché à un collège.',
  uai_taken: 'Ce numéro UAI est déjà utilisé : le collège existe sans doute déjà, cherchez-le.',
  school_not_found: 'Collège introuvable.',
  not_member: "Rattachez-vous d'abord à un collège (Réglages → Etablissement).",
  class_not_found: 'Classe introuvable.',
  school_class_not_found: 'Classe du collège introuvable.',
  forbidden: 'Action réservée au créateur du collège.',
};

export function schoolErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  const key = Object.keys(ERROR_LABELS).find((k) => msg.includes(k));
  return key ? ERROR_LABELS[key] : 'Une erreur est survenue.';
}

export async function searchSchools(query: string): Promise<SchoolSummary[]> {
  const { data, error } = await supabase.rpc('search_schools', { p_query: query });
  if (error) throw error;
  return (data ?? []) as SchoolSummary[];
}

export async function getMySchool(): Promise<MySchool | null> {
  const { data, error } = await supabase.rpc('get_my_school');
  if (error) throw error;
  return (data as MySchool | null) ?? null;
}

export async function createSchool(input: {
  name: string; city: string; uai: string; displayName: string; subject: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_school', {
    p_name: input.name,
    p_city: input.city,
    p_uai: input.uai,
    p_display_name: input.displayName,
    p_subject: input.subject,
  });
  if (error) throw error;
  return data as string;
}

export async function joinSchool(schoolId: string, displayName: string, subject: string): Promise<void> {
  const { error } = await supabase.rpc('join_school', {
    p_school_id: schoolId,
    p_display_name: displayName,
    p_subject: subject,
  });
  if (error) throw error;
}

export async function updateMySchoolProfile(displayName: string, subject: string): Promise<void> {
  const { error } = await supabase.rpc('update_my_school_profile', {
    p_display_name: displayName,
    p_subject: subject,
  });
  if (error) throw error;
}

/** Sans argument : quitter le collège. Avec un user_id : retirer ce membre (admin). */
export async function removeSchoolMember(userId?: string): Promise<void> {
  const { error } = await supabase.rpc('remove_school_member', { p_user_id: userId ?? null });
  if (error) throw error;
}

export async function listSchoolClasses(): Promise<SchoolClass[]> {
  const { data, error } = await supabase.rpc('list_school_classes', {});
  if (error) throw error;
  return (data ?? []) as SchoolClass[];
}

/**
 * Rattache une de mes classes à une classe du collège : existante (`schoolClassId`)
 * ou créée à partir de son nom (`newName`). Les deux absents = détacher.
 */
export async function linkClassToSchoolClass(
  classId: string,
  target: { schoolClassId?: string | null; newName?: string | null },
): Promise<string | null> {
  const { data, error } = await supabase.rpc('link_class_to_school_class', {
    p_class_id: classId,
    p_school_class_id: target.schoolClassId ?? null,
    p_new_name: target.newName ?? null,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function listSchoolClassStudents(schoolClassId: string): Promise<SchoolClassStudent[]> {
  const { data, error } = await supabase.rpc('list_school_class_students', {
    p_school_class_id: schoolClassId,
  });
  if (error) throw error;
  return ((data ?? []) as SchoolClassStudent[]).sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
}

export async function importSchoolStudents(
  targetClassId: string,
  identityIds: string[],
): Promise<{ imported: number; skipped: number }> {
  const { data, error } = await supabase.rpc('import_school_students', {
    p_target_class_id: targetClassId,
    p_identity_ids: identityIds,
  });
  if (error) throw error;
  return data as { imported: number; skipped: number };
}
