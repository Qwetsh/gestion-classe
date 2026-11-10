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
  student_id: string;
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
    .select('id,activity_id,student_id,class_id,group_key,group_pseudos,status,updated_at,classes(name),activities(title,key),students(pseudo),direct:content->_direct')
    .eq('is_deleted', false)
    .gte('updated_at', depuis)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as LiveWork[];
}

/**
 * Messages du prof aux élèves (table live_messages, migration 068) : le jeu les affiche en grand, signés par un
 * personnage de l'hôpital. Portée : l'activité, une classe (facultative), des élèves (facultatifs). Vivent 20 min.
 */
export type LiveMessageStyle = 'alerte' | 'info' | 'bravo';
export interface LiveMessage {
  id: string;
  activity_id: string | null;
  class_id: string | null;
  student_ids: string[] | null;
  texte: string;
  style: LiveMessageStyle;
  signe: string;
  /** Points en plus (> 0) ou en moins (< 0) pour chaque élève visé (migration 069), null pour un simple message. */
  points: number | null;
  created_at: string;
}

export async function sendLiveMessage(m: { activity_id: string; class_id?: string | null; student_ids?: string[] | null; texte: string; style: LiveMessageStyle; signe: string; points?: number | null }) {
  const { error } = await supabase.from('live_messages').insert({
    activity_id: m.activity_id,
    class_id: m.class_id ?? null,
    student_ids: m.student_ids?.length ? m.student_ids : null,
    texte: m.texte.trim().slice(0, 300),
    style: m.style,
    signe: m.signe,
    points: m.points ? m.points : null,
  });
  if (error) throw error;
}

/** Les messages envoyés depuis `depuisMinutes` (les plus récents d'abord). */
export async function fetchSentMessages(depuisMinutes = 60): Promise<LiveMessage[]> {
  const depuis = new Date(Date.now() - depuisMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('live_messages')
    .select('id,activity_id,class_id,student_ids,texte,style,signe,points,created_at')
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as LiveMessage[];
}

/** Tous les points donnés pour une activité (sans limite de durée) : le total de chaque groupe. */
export async function fetchActivityPoints(activityId: string): Promise<LiveMessage[]> {
  const { data, error } = await supabase
    .from('live_messages')
    .select('id,activity_id,class_id,student_ids,texte,style,signe,points,created_at')
    .eq('activity_id', activityId)
    .not('points', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiveMessage[];
}

/** Les points qui reviennent à ces élèves (d'une classe) parmi `points`. */
export function pointsDe(points: LiveMessage[], eleves: string[], classId: string | null): number {
  const s = points
    .filter((p) => (p.student_ids ? p.student_ids.some((id) => eleves.includes(id)) : !p.class_id || p.class_id === classId))
    .reduce((a, p) => a + Number(p.points ?? 0), 0);
  return Math.round(s * 10) / 10;
}

export const ecrirePoints = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${String(Math.abs(n)).replace('.', ',')} pt${Math.abs(n) > 1 ? 's' : ''}`;
