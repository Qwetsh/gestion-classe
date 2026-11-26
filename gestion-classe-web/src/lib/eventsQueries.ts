import { supabase } from './supabase';
import { fetchAllPages, type PageResult } from './evaluationQueries';

/** Un événement de séance, avec la classe de sa séance. */
export interface TeacherEvent {
  id: string;
  type: string;
  student_id: string;
  session_id: string;
  class_id: string;
}

interface RawEventRow {
  id: string;
  type: string;
  student_id: string;
  session_id: string;
  sessions: { class_id: string } | { class_id: string }[] | null;
}

/**
 * Tous les événements d'un enseignant, ou d'une seule de ses classes, page par page.
 *
 * Une lecture d'un seul tenant s'arrête à 1 000 lignes **sans erreur** : les notes de participation
 * de l'accueil et les bilans de fin de trimestre et de fin d'année étaient alors calculés sur une
 * partie des événements (constaté à l'audit du 26/11/2026 : un compte à 6 211 événements, quatre
 * classes au-delà de 1 400). Le tri par identifiant rend les pages stables d'une requête à l'autre.
 *
 * Lève l'erreur de la base plutôt que de rendre une liste partielle.
 */
export async function fetchTeacherEvents(userId: string, classId?: string): Promise<TeacherEvent[]> {
  const rows = await fetchAllPages<RawEventRow>(async (from, to) => {
    let query = supabase
      .from('events')
      .select('id, type, student_id, session_id, sessions!inner(class_id, user_id)')
      .eq('sessions.user_id', userId);
    if (classId) query = query.eq('sessions.class_id', classId);
    const page = await query.order('id').range(from, to);
    return page as unknown as PageResult<RawEventRow>;
  });

  return rows.map((row) => {
    const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    return {
      id: row.id,
      type: row.type,
      student_id: row.student_id,
      session_id: row.session_id,
      class_id: session?.class_id ?? '',
    };
  });
}
