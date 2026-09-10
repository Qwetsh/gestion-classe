/**
 * Tableaux nommés hors séance (table `boards`, migration add_boards.sql).
 * Tant que la migration n'est pas appliquée, la liste est vide et la création échoue
 * proprement : l'accueil garde son tableau libre local.
 */
import { supabase } from './supabase';

export interface Board {
  id: string;
  title: string;
  class_id: string | null;
  created_at: string;
  updated_at: string;
}

let tableMissing = false;

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || (msg.includes('boards') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Vrai si la table n'existe pas encore (détecté au premier appel). */
export const boardsUnavailable = () => tableMissing;

export async function listBoards(userId: string): Promise<Board[]> {
  if (tableMissing) return [];
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, class_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (isMissingTable(error)) {
    tableMissing = true;
    console.warn('[boardsQueries] table « boards » absente : migration add_boards.sql à appliquer');
    return [];
  }
  if (error) throw error;
  return (data || []) as Board[];
}

export async function createBoard(userId: string, title: string, classId: string | null = null): Promise<Board> {
  const { data, error } = await supabase
    .from('boards')
    .insert({ user_id: userId, title, class_id: classId })
    .select('id, title, class_id, created_at, updated_at')
    .single();
  if (isMissingTable(error)) { tableMissing = true; throw new Error('Les tableaux nommés demandent la migration add_boards.sql'); }
  if (error) throw error;
  return data as Board;
}

export async function renameBoard(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('boards').update({ title, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function touchBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.warn('[boardsQueries] touch :', error);
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id);
  if (error) throw error;
}
