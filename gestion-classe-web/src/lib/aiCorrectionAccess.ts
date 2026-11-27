import { supabase } from './supabase';

/**
 * Le compte connecté peut-il lancer « Corriger avec Claude » ? (migration 101 : la liste reste
 * invisible, la base répond oui ou non pour ce compte). En cas d'erreur : non, le bouton reste caché.
 */
export async function canUseAiCorrection(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_use_ai_correction');
  return !error && data === true;
}
