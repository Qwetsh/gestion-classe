/**
 * Clés et réglages d'intégrations (YouTube, Unsplash, base Notion, Google Drive) : gardés dans
 * le navigateur pour un accès immédiat, et copiés dans le compte (`user_api_keys`) pour suivre
 * l'enseignant sur tous ses appareils. Au démarrage du tableau, le compte alimente le navigateur ;
 * à chaque enregistrement, le navigateur alimente le compte.
 */
import { supabase } from './supabase';

/** Entrées localStorage synchronisées, et leur nom dans la colonne `keys`. */
const SYNCED: { storage: string; field: string; json: boolean }[] = [
  { storage: 'classroom-board-api-keys', field: 'search', json: true },
  { storage: 'classroom-board-notion-db', field: 'notionDb', json: false },
  { storage: 'classroom-board-drive-keys', field: 'drive', json: true },
];

let owner: string | null = null;
let tableMissing = false;

export function setKeysOwner(userId: string | null) {
  owner = userId || null;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || ((error.message || '').includes('user_api_keys') && (error.message || '').includes('schema cache'));
}

/** Compte → navigateur. Silencieux si la table manque ou hors ligne. */
export async function pullKeys(): Promise<void> {
  if (!owner || tableMissing) return;
  const { data, error } = await supabase.from('user_api_keys').select('keys').eq('user_id', owner).maybeSingle();
  if (error) { if (isMissingTable(error)) tableMissing = true; else console.warn('[userKeys] lecture :', error); return; }
  const keys = (data?.keys ?? {}) as Record<string, unknown>;
  for (const { storage, field, json } of SYNCED) {
    const v = keys[field];
    if (v === undefined || v === null) continue;
    try { localStorage.setItem(storage, json ? JSON.stringify(v) : String(v)); } catch { /* stockage indisponible */ }
  }
}

/** Navigateur → compte (appelé après chaque enregistrement dans un panneau). */
export async function pushKeys(): Promise<void> {
  if (!owner || tableMissing) return;
  const keys: Record<string, unknown> = {};
  for (const { storage, field, json } of SYNCED) {
    try {
      const raw = localStorage.getItem(storage);
      if (raw === null) continue;
      keys[field] = json ? JSON.parse(raw) : raw;
    } catch { /* entrée illisible : ignorée */ }
  }
  const { error } = await supabase.from('user_api_keys').upsert({ user_id: owner, keys, updated_at: new Date().toISOString() });
  if (error) { if (isMissingTable(error)) tableMissing = true; else console.warn('[userKeys] enregistrement :', error); }
}
