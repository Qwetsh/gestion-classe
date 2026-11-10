import { supabase } from './supabase';

/**
 * Suivi en direct d'une activité numérique (Hôpital virtuel) pendant le cours.
 * Le jeu écrit, dans chaque brouillon qu'il sauvegarde (au moins une fois par minute tant que l'élève joue),
 * un petit résumé `content._direct` : on ne lit que lui, pour qu'un téléphone tienne la page à jour sans
 * télécharger les carnets entiers. Lecture seule, filtrée par la RLS du prof.
 */

export interface LiveMorel { t: number; q: string; compris: string | null; niveau: number }

export interface LiveSummary {
  v: number;
  t: number;
  patient?: string;
  equipe?: string[];
  lieu?: string;
  mode?: 'direct' | 'guide' | 'autonome';
  hypothese?: boolean;
  reponses?: number;
  sur?: number;
  conclusion?: boolean;
  envoye?: boolean;
  examens?: string[];
  questionsPatient?: number;
  dernierRefus?: string | null;
  morel?: LiveMorel[];
  morelIncomprises?: number;
}

export interface LiveWork {
  id: string;
  activity_id: string;
  class_id: string | null;
  group_key: string | null;
  group_pseudos: string[] | null;
  status: string;
  updated_at: string;
  classes: { name: string } | null;
  activities: { title: string; key: string } | null;
  students: { pseudo: string } | null;
  direct: LiveSummary | null;
}

/** Les fiches modifiées depuis `depuisMinutes`, avec leur résumé en direct. */
export async function fetchLiveWorks(depuisMinutes: number): Promise<LiveWork[]> {
  const depuis = new Date(Date.now() - depuisMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('student_works')
    .select('id,activity_id,class_id,group_key,group_pseudos,status,updated_at,classes(name),activities(title,key),students(pseudo),direct:content->_direct')
    .eq('is_deleted', false)
    .gte('updated_at', depuis)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as LiveWork[];
}
