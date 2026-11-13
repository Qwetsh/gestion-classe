/**
 * Historique des versions d'un cours rédigé (AUDIT_editeur_texte.md, lot T6 ; migration 072,
 * table `board_doc_versions`).
 *
 * L'éditeur prend un instantané du document à l'ouverture, toutes les 10 minutes de travail,
 * avant une restauration et à la demande (« Enregistrer une version »). Après chaque ajout, le
 * ménage : les 30 dernières versions, puis une par jour sur 30 jours ; les versions nommées à la
 * main ne sont jamais effacées. Les dessins des encarts (board_pages) ne sont pas versionnés.
 *
 * Table absente (migration non appliquée) : l'historique est simplement indisponible.
 */
import type { JSONContent } from '@tiptap/core';
import { supabase } from '../supabase';
import type { CourseDoc } from './courseDoc';

export type VersionKind = 'auto' | 'manual' | 'restore' | 'import' | 'conflict';

export interface CourseVersion {
  id: string;
  kind: VersionKind;
  label: string | null;
  words: number | null;
  created_at: string;
}

export const VERSION_KIND_LABELS: Record<VersionKind, string> = {
  auto: 'Automatique',
  manual: 'Version nommée',
  restore: 'Avant restauration',
  import: 'Avant import',
  conflict: 'Autre onglet ou appareil',
};

/** Combien de versions récentes on garde quoi qu'il arrive, puis une par jour sur combien de jours. */
const KEEP_RECENT = 30;
const KEEP_DAYS = 30;

let tableMissing = false;

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || (msg.includes('board_doc_versions') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Vrai si la migration 072 n'est pas appliquée (détecté au premier appel). */
export const versionsUnavailable = () => tableMissing;

/** Nombre de mots d'un document TipTap. */
export function countWords(content: JSONContent | undefined): number {
  let n = 0;
  const walk = (node: JSONContent | undefined) => {
    if (!node) return;
    if (node.text) n += node.text.split(/\s+/).filter(Boolean).length;
    node.content?.forEach(walk);
  };
  walk(content);
  return n;
}

/** Versions d'un cours, les plus récentes d'abord (sans les documents). Null si indisponible. */
export async function listVersions(boardId: string): Promise<CourseVersion[] | null> {
  if (tableMissing) return null;
  const { data, error } = await supabase
    .from('board_doc_versions')
    .select('id, kind, label, words, created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (isMissingTable(error)) { tableMissing = true; return null; }
  if (error) throw error;
  return (data ?? []) as CourseVersion[];
}

/** Date de la dernière version du cours (0 s'il n'y en a pas, null si indisponible). */
export async function lastVersionAt(boardId: string): Promise<number | null> {
  if (tableMissing) return null;
  const { data, error } = await supabase
    .from('board_doc_versions')
    .select('created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (isMissingTable(error)) { tableMissing = true; return null; }
  if (error) throw error;
  const row = (data ?? [])[0] as { created_at: string } | undefined;
  return row ? new Date(row.created_at).getTime() : 0;
}

export async function fetchVersionDoc(id: string): Promise<CourseDoc> {
  const { data, error } = await supabase.from('board_doc_versions').select('doc').eq('id', id).single();
  if (error) throw error;
  return (data as { doc: CourseDoc }).doc;
}

/** Ajoute une version puis fait le ménage. Renvoie false si l'historique est indisponible. */
export async function createVersion(userId: string, boardId: string, doc: CourseDoc, kind: VersionKind, label: string | null = null): Promise<boolean> {
  if (tableMissing) return false;
  const snapshot: CourseDoc = { ...doc };
  delete snapshot.rev;
  const { error } = await supabase
    .from('board_doc_versions')
    .insert({ user_id: userId, board_id: boardId, doc: snapshot, kind, label: label?.trim() || null, words: countWords(doc.content) });
  if (isMissingTable(error)) { tableMissing = true; return false; }
  if (error) throw error;
  void pruneVersions(boardId).catch((err: unknown) => console.warn('[courseVersions] ménage :', err));
  return true;
}

export async function renameVersion(id: string, label: string): Promise<void> {
  const t = label.trim();
  // Nommer une version la protège du ménage, comme dans Word
  const { error } = await supabase.from('board_doc_versions').update(t ? { label: t, kind: 'manual' } : { label: null }).eq('id', id);
  if (error) throw error;
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('board_doc_versions').delete().eq('id', id);
  if (error) throw error;
}

/** Versions à effacer : au-delà des 30 dernières, on garde la plus récente de chaque jour sur 30 jours. */
export function versionsToPrune(versions: CourseVersion[], now = Date.now()): string[] {
  const sorted = [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const days = new Set<string>();
  const drop: string[] = [];
  sorted.forEach((v, i) => {
    const t = new Date(v.created_at);
    const day = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
    const firstOfDay = !days.has(day);
    days.add(day);
    if (v.kind === 'manual' || i < KEEP_RECENT) return;
    if (firstOfDay && now - t.getTime() < KEEP_DAYS * 86400000) return;
    drop.push(v.id);
  });
  return drop;
}

async function pruneVersions(boardId: string): Promise<void> {
  const list = await listVersions(boardId);
  if (!list) return;
  const drop = versionsToPrune(list);
  if (drop.length === 0) return;
  const { error } = await supabase.from('board_doc_versions').delete().in('id', drop);
  if (error) throw error;
}
