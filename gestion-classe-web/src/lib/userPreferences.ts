/**
 * Préférences par compte (clé -> JSON), stockées dans Supabase et doublées en localStorage.
 *
 * Le cache local sert à deux choses : afficher immédiatement au chargement, et rester
 * utilisable hors ligne. Supabase fait autorité dès que la réponse arrive.
 * Tant que la table `user_preferences` n'existe pas en base, tout continue de fonctionner
 * en local — la synchronisation reprend d'elle-même une fois la migration 042 appliquée.
 */

import { supabase } from './supabase';

const CACHE_PREFIX = 'gc_pref_';

/** La table manque encore en base : on cesse de la solliciter pour la session en cours. */
let remoteUnavailable = false;

function cacheKey(key: string): string {
  return CACHE_PREFIX + key;
}

export function readCachedPreference<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCachedPreference<T>(key: string, value: T): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(value));
  } catch {
    // quota plein ou stockage bloqué : la préférence vivra en mémoire pour cette session
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42P01 = undefined_table (PostgREST le remonte aussi en PGRST205)
  return error.code === '42P01' || error.code === 'PGRST205' || /user_preferences/.test(error.message ?? '');
}

/** Lit la préférence distante ; renvoie null si absente, hors ligne, ou table non déployée. */
export async function fetchPreference<T>(userId: string, key: string): Promise<T | null> {
  if (remoteUnavailable) return null;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) remoteUnavailable = true;
    else console.error('Lecture de préférence impossible:', error);
    return null;
  }

  if (!data) return null;
  writeCachedPreference(key, data.value as T);
  return data.value as T;
}

/** Écrit la préférence (cache local immédiat, base ensuite). */
export async function savePreference<T>(userId: string, key: string, value: T): Promise<void> {
  writeCachedPreference(key, value);
  if (remoteUnavailable) return;

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });

  if (error) {
    if (isMissingTable(error)) remoteUnavailable = true;
    else console.error('Enregistrement de préférence impossible:', error);
  }
}

/** Supprime la préférence (retour aux défauts). */
export async function clearPreference(userId: string, key: string): Promise<void> {
  try { localStorage.removeItem(cacheKey(key)); } catch { /* ignore */ }
  if (remoteUnavailable) return;

  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('key', key);

  if (error && !isMissingTable(error)) console.error('Suppression de préférence impossible:', error);
  else if (error) remoteUnavailable = true;
}
