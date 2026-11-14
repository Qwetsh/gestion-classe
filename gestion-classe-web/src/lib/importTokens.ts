/**
 * Jetons d'import personnels (migration 075, Edge Function `depot-cours`).
 *
 * Un jeton permet à Claude, depuis l'ordinateur du professeur, de déposer dans l'application des
 * images, des cours et des écrans. Il est créé ici, montré une seule fois, et révocable. La base
 * n'en garde que l'empreinte : on ne peut pas le relire.
 */
import { supabase } from './supabase';

export interface ImportToken {
  id: string;
  label: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** Vrai tant que le jeton peut servir. */
export const tokenIsLive = (t: ImportToken, now = new Date()) => !t.revokedAt && t.expiresAt.getTime() > now.getTime();

type Row = { id: string; label: string; created_at: string; expires_at: string; last_used_at: string | null; revoked_at: string | null };

const fromRow = (r: Row): ImportToken => ({
  id: r.id,
  label: r.label,
  createdAt: new Date(r.created_at),
  expiresAt: new Date(r.expires_at),
  lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
  revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
});

/** Erreur « la migration 075 n'est pas appliquée ». */
export class ImportTokensUnavailable extends Error {
  constructor() { super('Les jetons d’import demandent la migration 075'); }
}

const isMissingTable = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === '42P01' || /import_tokens/i.test(error.message ?? ''));

/** Jetons du professeur, du plus récent au plus ancien (jamais l'empreinte). */
export async function listImportTokens(): Promise<ImportToken[]> {
  const { data, error } = await supabase
    .from('import_tokens')
    .select('id, label, created_at, expires_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false });
  if (isMissingTable(error)) throw new ImportTokensUnavailable();
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

const MESSAGES: Record<string, string> = {
  unauthorized: 'Session expirée : reconnectez-vous.',
  too_many_tokens: 'Cinq jetons sont déjà actifs : révoquez-en un d’abord.',
  token_failed: 'Le jeton n’a pas pu être créé.',
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('depot-cours', { body });
  if (error) {
    let code = 'unknown';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { code = ((await ctx.json()) as { error?: string }).error ?? code; } catch { /* corps non JSON */ }
    }
    throw new Error(MESSAGES[code] ?? 'La fonction de dépôt ne répond pas (est-elle déployée ?).');
  }
  return data as T;
}

/** Crée un jeton : sa valeur n'est rendue qu'ici, une seule fois. */
export async function createImportToken(label: string): Promise<{ id: string; token: string; expiresAt: Date }> {
  const r = await invoke<{ id: string; token: string; expires_at: string }>({ action: 'create', label });
  return { id: r.id, token: r.token, expiresAt: new Date(r.expires_at) };
}

/** Révoque un jeton : il cesse de servir tout de suite. */
export async function revokeImportToken(id: string): Promise<void> {
  await invoke<{ ok: boolean }>({ action: 'revoke', id });
}
