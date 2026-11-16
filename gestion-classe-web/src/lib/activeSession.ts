/**
 * Séance en cours : la plus récente non terminée de l'enseignant, démarrée il y a moins de 6 h.
 * Des séances jamais terminées (téléphone éteint en cours, synchro perdue) traînent en base :
 * sans cette borne, on prendrait pour « en cours » une séance d'il y a trois semaines.
 *
 * Sert à l'écran de classe (`/classe`) et au mode essai d'un cours, qui prévient quand une séance
 * tourne sur le téléphone sans que l'écran de classe soit ouvert.
 */
import { supabase } from './supabase';

export const MAX_ACTIVE_SESSION_MS = 6 * 60 * 60 * 1000;

export interface ActiveSession {
  id: string;
  class_id: string;
  room_id: string;
  group_id?: string | null;
  topic: string | null;
  started_at: string;
  ended_at: string | null;
}

/** Séance en cours de l'enseignant, ou null. Lève l'erreur de lecture. */
export async function fetchActiveSession(userId: string): Promise<ActiveSession | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, class_id, room_id, group_id, topic, started_at, ended_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .gte('started_at', new Date(Date.now() - MAX_ACTIVE_SESSION_MS).toISOString())
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as ActiveSession | undefined) ?? null;
}

/** Adresse de l'écran de classe ; `boardId` : le tableau du cours à y afficher quand la séance démarre. */
export const classroomUrl = (boardId?: string | null) => (boardId ? `/classe?board=${encodeURIComponent(boardId)}` : '/classe');
