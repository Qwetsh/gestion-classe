/**
 * Ce que l'application sait d'un cours et que Pronote ignore (lot 3 de PLAN_accueil_v2.md) :
 * la séance enregistrée sur le créneau (sujet, bonus, malus, absences) et le dernier tableau
 * préparé utilisé avec la classe.
 */

import { supabase } from '../supabase';

export interface WeekSession {
  id: string;
  classId: string;
  groupId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  topic: string | null;
  pos: number;
  neg: number;
  abs: number;
}

export interface LastBoard {
  boardId: string;
  title: string;
  chapter: string | null;
  usedAt: Date;
}

/** Séances démarrées dans [from, to[, avec leurs compteurs d'événements. */
export async function fetchWeekSessions(userId: string, from: Date, to: Date): Promise<WeekSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, class_id, group_id, started_at, ended_at, topic')
    .eq('user_id', userId)
    .gte('started_at', from.toISOString())
    .lt('started_at', to.toISOString());
  if (error) throw error;
  const rows = data || [];
  if (rows.length === 0) return [];

  const { data: events, error: evError } = await supabase
    .from('events')
    .select('session_id, type')
    .in('session_id', rows.map(r => r.id));
  if (evError) throw evError;

  const counts = new Map<string, { pos: number; neg: number; abs: number }>();
  for (const e of events || []) {
    const c = counts.get(e.session_id) ?? { pos: 0, neg: 0, abs: 0 };
    if (e.type === 'participation') c.pos++;
    else if (e.type === 'bavardage') c.neg++;
    else if (e.type === 'absence') c.abs++;
    counts.set(e.session_id, c);
  }

  return rows.map(r => ({
    id: r.id,
    classId: r.class_id,
    groupId: r.group_id ?? null,
    startedAt: new Date(r.started_at),
    endedAt: r.ended_at ? new Date(r.ended_at) : null,
    topic: r.topic?.trim() || null,
    ...(counts.get(r.id) ?? { pos: 0, neg: 0, abs: 0 }),
  }));
}

/**
 * Dernier tableau préparé projeté avec chaque classe (via session_boards).
 * Table absente ou erreur : map vide, l'accueil s'en passe.
 */
export async function fetchLastBoardByClass(userId: string): Promise<Map<string, LastBoard>> {
  const out = new Map<string, LastBoard>();
  const { data, error } = await supabase
    .from('session_boards')
    .select('board_id, linked_at, sessions(class_id), boards(title, chapter)')
    .eq('user_id', userId)
    .order('linked_at', { ascending: false })
    .limit(300);
  if (error || !data) return out;

  type Row = {
    board_id: string;
    linked_at: string;
    sessions: { class_id: string } | { class_id: string }[] | null;
    boards: { title: string; chapter: string | null } | { title: string; chapter: string | null }[] | null;
  };
  for (const row of data as unknown as Row[]) {
    const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    const board = Array.isArray(row.boards) ? row.boards[0] : row.boards;
    if (!session?.class_id || !board || out.has(session.class_id)) continue;
    out.set(session.class_id, {
      boardId: row.board_id,
      title: board.title,
      chapter: board.chapter,
      usedAt: new Date(row.linked_at),
    });
  }
  return out;
}
