/**
 * Classeur ouvert aux classes (PLAN_classeur_eleves.md, lot 1) : lecture et écriture des réglages
 * d'une classe (table `class_binder_items`, migration 085). La décision de ce qui sort est dans
 * lib/binderRelease.ts ; ici, seulement la base.
 */
import { supabase } from './supabase';
import { levelFromClassName } from './boardsQueries';
import type { BinderItemRow } from './binderRelease';

export interface BinderClass {
  id: string;
  name: string;
}

const COLUMNS = 'id, class_id, anchor_board_id, visible, correction_visible, released';

let tableMissing = false;

/** Migration 085 pas encore appliquée : le classeur reste celui du professeur seul. */
export const binderReleaseUnavailable = () => tableMissing;

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || (msg.includes('class_binder_items') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Classes du professeur dont le nom porte ce niveau (« 4A », « 4e B » → 4e), par ordre de nom. */
export async function fetchBinderClasses(userId: string, level: string): Promise<BinderClass[]> {
  const { data, error } = await supabase.from('classes').select('id, name').eq('user_id', userId).eq('is_deleted', false).order('name');
  if (error) throw error;
  return ((data ?? []) as BinderClass[])
    .filter((c) => levelFromClassName(c.name) === level)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
}

/** Réglages d'une classe. Table absente : aucun réglage (et `binderReleaseUnavailable()` devient vrai). */
export async function fetchBinderItems(classId: string): Promise<BinderItemRow[]> {
  if (tableMissing) return [];
  const { data, error } = await supabase.from('class_binder_items').select(COLUMNS).eq('class_id', classId);
  if (isMissingTable(error)) { tableMissing = true; return []; }
  if (error) throw error;
  return (data ?? []) as BinderItemRow[];
}

/** Enregistre des lignes (une par classe et par cours d'ancrage) et rend celles de la base. */
export async function saveBinderItems(userId: string, rows: BinderItemRow[]): Promise<BinderItemRow[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('class_binder_items')
    .upsert(
      rows.map(({ class_id, anchor_board_id, visible, correction_visible, released }) => ({ user_id: userId, class_id, anchor_board_id, visible, correction_visible, released, updated_at: now })),
      { onConflict: 'class_id,anchor_board_id' },
    )
    .select(COLUMNS);
  if (error) throw error;
  return (data ?? []) as BinderItemRow[];
}

/** Retire les lignes dont le cours n'est plus dans le classeur. */
export async function deleteBinderItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('class_binder_items').delete().in('id', ids);
  if (error) throw error;
}
