import { supabase } from './supabase';
import { fetchMemberIds } from './classGroupQueries';
import { questionsDuCarnet, type QuestionCarnet } from './liveCarnet';
import { MAX_LIVE_SESSION_MS, choisirSeance, listeDeClasse, type EvenementLike } from './liveClass';

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
  /** Ajoutés le 17/11 (absents des fiches plus anciennes) : les questions répondues, par identifiant
   *  (celui de definition.questions) ; l'heure où la fiche du patient a été lue ; les live_messages fermés. */
  faites?: string[];
  ficheLue?: number | null;
  messagesLus?: string[];
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

/** Les fiches modifiées dans les `depuisMinutes` qui précèdent `maintenant`, avec leur résumé en direct. */
export async function fetchLiveWorks(depuisMinutes: number, maintenant = Date.now()): Promise<LiveWork[]> {
  const depuis = new Date(maintenant - depuisMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('student_works')
    .select('id,activity_id,student_id,class_id,group_key,group_pseudos,status,updated_at,classes(name),activities(title,key),students(pseudo),direct:content->_direct')
    .eq('is_deleted', false)
    .gte('updated_at', depuis)
    .lte('updated_at', new Date(maintenant).toISOString())
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as LiveWork[];
}

/** La séance du téléphone qui correspond au cours en cours (voir choisirSeance), ou null. */
export interface LiveSession {
  id: string;
  class_id: string;
  group_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export async function fetchLiveSession(userId: string, maintenant = Date.now()): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id,class_id,group_id,started_at,ended_at')
    .eq('user_id', userId)
    .lte('started_at', new Date(maintenant).toISOString())
    .gte('started_at', new Date(maintenant - MAX_LIVE_SESSION_MS).toISOString())
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return choisirSeance((data ?? []) as LiveSession[], maintenant);
}

export interface LiveStudent {
  id: string;
  pseudo: string;
}

/** Les élèves de la classe (sans les élèves supprimés ni les témoins), ou du seul demi-groupe de la séance. */
export async function fetchLiveRoster(classId: string, groupId: string | null): Promise<LiveStudent[]> {
  const [eleves, membres] = await Promise.all([
    supabase.from('students').select('id,pseudo,is_deleted,is_witness').eq('class_id', classId).order('pseudo'),
    groupId ? fetchMemberIds(groupId) : Promise.resolve(null),
  ]);
  if (eleves.error) throw eleves.error;
  return listeDeClasse((eleves.data ?? []) as (LiveStudent & { is_deleted: boolean | null; is_witness: boolean | null })[], groupId, membres);
}

/** Absences, sorties et retours notés dans la séance. */
export async function fetchPresenceEvents(sessionId: string): Promise<EvenementLike[]> {
  const { data, error } = await supabase
    .from('events')
    .select('student_id,type,subtype,timestamp')
    .eq('session_id', sessionId)
    .in('type', ['absence', 'sortie', 'retour']);
  if (error) throw error;
  return (data ?? []) as EvenementLike[];
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

/** Tous les points donnés pour ces activités (sans limite de durée) : le total de chaque groupe. */
export async function fetchActivitiesPoints(activityIds: string[]): Promise<LiveMessage[]> {
  if (activityIds.length === 0) return [];
  const { data, error } = await supabase
    .from('live_messages')
    .select('id,activity_id,class_id,student_ids,texte,style,signe,points,created_at')
    .in('activity_id', activityIds)
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

/** Les questions du carnet de ces activités (definition.questions), par activité. */
export async function fetchQuestionsCarnet(activityIds: string[]): Promise<Record<string, QuestionCarnet[]>> {
  if (activityIds.length === 0) return {};
  const { data, error } = await supabase.from('activities').select('id,questions:definition->questions').in('id', activityIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((a) => [a.id as string, questionsDuCarnet(a.questions)]));
}

/**
 * Les réponses du carnet d'une fiche, question par question, et l'ordonnance : seulement ces clés du contenu,
 * jamais `journal` ni `_hopital`, qui sont lourds. Une réponse est un texte (les cases cochées arrivent en texte).
 */
export async function fetchReponsesCarnet(workId: string, questions: QuestionCarnet[]): Promise<{ reponses: Record<string, string>; ordonnance: string }> {
  const champs = questions.map((q, i) => `q${i}:content->>"${q.id.replace(/"/g, '')}"`);
  const { data, error } = await supabase
    .from('student_works')
    .select(['ordonnance:content->>ordonnance', ...champs].join(','))
    .eq('id', workId)
    .maybeSingle();
  if (error) throw error;
  const ligne = (data ?? {}) as unknown as Record<string, string | null>;
  const reponses: Record<string, string> = {};
  questions.forEach((q, i) => {
    const r = ligne[`q${i}`];
    if (typeof r === 'string' && r.trim()) reponses[q.id] = r.trim();
  });
  return { reponses, ordonnance: (ligne.ordonnance ?? '').trim() };
}
