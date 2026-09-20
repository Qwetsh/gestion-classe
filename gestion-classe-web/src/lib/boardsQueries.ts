/**
 * Tableaux nommés hors séance (table `boards`, migrations add_boards.sql puis add_board_library.sql).
 *
 * Un tableau préparé se range par **niveau** (6e, 5e, 4e, 3e, Autre) et **chapitre** (texte libre).
 * En classe, ses pages sont copiées dans le tableau de la séance — l'original reste intact — et la
 * table `session_boards` garde la trace de l'origine (une séance part d'au plus un tableau).
 *
 * Tant que la migration add_boards.sql n'est pas appliquée, la liste est vide et la création échoue
 * proprement : l'accueil garde son tableau libre local.
 */
import { supabase } from './supabase';
import { fetchBoardPages, upsertBoardPages } from './boardQueries';
import { importFilesToPages, type ImportProgress } from './boardImport';
import type { BoardPage } from './boardRender';

export interface Board {
  id: string;
  title: string;
  class_id: string | null;
  level: string | null;
  chapter: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardMeta {
  title: string;
  level: string | null;
  chapter: string | null;
}

/** Niveaux du collège, dans l'ordre d'affichage ; « Autre » pour le reste (AP, club, remédiation…). */
export const BOARD_LEVELS = ['6e', '5e', '4e', '3e', 'Autre'] as const;
export const NO_LEVEL = 'Sans niveau';

/** Niveau déduit du nom d'une classe : « 6e A », « 5ème 3 », « 3E2 » → 6e, 5e, 3e ; sinon null. */
export function levelFromClassName(name: string | null | undefined): string | null {
  const m = (name ?? '').match(/(?:^|[^\d])([6543])\s*(?:e|è|ème|eme|E)\b/) ?? (name ?? '').match(/^\s*([6543])/);
  return m ? `${m[1]}e` : null;
}

/** Ordre de tri des niveaux : 6e, 5e, 4e, 3e, Autre, puis sans niveau. */
export function levelRank(level: string | null): number {
  const i = (BOARD_LEVELS as readonly string[]).indexOf(level ?? '');
  return i === -1 ? BOARD_LEVELS.length : i;
}

const COLUMNS = 'id, title, class_id, level, chapter, created_at, updated_at';

let tableMissing = false;

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || (msg.includes('boards') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Vrai si la table n'existe pas encore (détecté au premier appel). */
export const boardsUnavailable = () => tableMissing;

const clean = (s: string | null | undefined) => { const t = (s ?? '').trim(); return t ? t : null; };

export async function listBoards(userId: string): Promise<Board[]> {
  if (tableMissing) return [];
  const { data, error } = await supabase
    .from('boards')
    .select(COLUMNS)
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

export async function createBoard(userId: string, meta: BoardMeta, classId: string | null = null): Promise<Board> {
  const { data, error } = await supabase
    .from('boards')
    .insert({ user_id: userId, title: meta.title.trim(), level: clean(meta.level), chapter: clean(meta.chapter), class_id: classId })
    .select(COLUMNS)
    .single();
  if (isMissingTable(error)) { tableMissing = true; throw new Error('Les tableaux nommés demandent la migration add_boards.sql'); }
  if (error) throw error;
  return data as Board;
}

/** Titre, niveau et chapitre d'un tableau. */
export async function updateBoard(id: string, meta: Partial<BoardMeta>): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (meta.title !== undefined) patch.title = meta.title.trim();
  if (meta.level !== undefined) patch.level = clean(meta.level);
  if (meta.chapter !== undefined) patch.chapter = clean(meta.chapter);
  const { error } = await supabase.from('boards').update(patch).eq('id', id);
  if (error) throw error;
}

export async function renameBoard(id: string, title: string): Promise<void> {
  await updateBoard(id, { title });
}

export async function touchBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.warn('[boardsQueries] touch :', error);
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Copies de pages
// ---------------------------------------------------------------------------------------------

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Copie profonde des pages avec de nouveaux identifiants (les fichiers du bucket sont partagés, pas dupliqués). */
export function clonePages(pages: BoardPage[]): BoardPage[] {
  return pages.map((p) => ({ ...(JSON.parse(JSON.stringify(p)) as BoardPage), id: newId() }));
}

/** Pages d'un tableau préparé, prêtes à être insérées ailleurs (nouveaux identifiants). */
export async function copyBoardPages(boardId: string): Promise<BoardPage[]> {
  const { pages } = await fetchBoardPages({ boardId });
  return clonePages(pages);
}

/**
 * Nouveau tableau nommé à partir de pages existantes (tableau d'une séance, brouillon…).
 * Les pages sont copiées : la séance garde les siennes.
 */
export async function createBoardFromPages(userId: string, meta: BoardMeta, pages: BoardPage[]): Promise<Board> {
  const board = await createBoard(userId, meta);
  const copies = clonePages(pages);
  await upsertBoardPages(userId, { boardId: board.id }, copies.map((page, position) => ({ page, position })));
  return board;
}

/**
 * Nouveau tableau nommé dont les pages viennent d'un document (PDF : une page du tableau par page,
 * image : une page). Titre = nom du fichier. Les images de page sont rangées sous `board:<id>`,
 * l'identifiant de stockage de l'onglet du tableau (voir `boardTab` dans boardTabs.ts).
 * Si l'import échoue, le tableau vide est supprimé.
 */
export async function createBoardFromFile(userId: string, file: File, onProgress: (p: ImportProgress) => void): Promise<Board> {
  const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Document';
  const board = await createBoard(userId, { title, level: null, chapter: null });
  try {
    const pages = await importFilesToPages([file], userId, `board:${board.id}`, onProgress);
    if (pages.length === 0) throw new Error('Aucune page importable dans ce fichier (PDF ou image attendu)');
    await upsertBoardPages(userId, { boardId: board.id }, pages.map((page, position) => ({ page, position })));
    return board;
  } catch (err) {
    await deleteBoard(board.id).catch(() => { /* le tableau vide restera dans la liste */ });
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Lien séance → tableau préparé (table session_boards)
// ---------------------------------------------------------------------------------------------

let linksMissing = false;

function isMissingLinks(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || (msg.includes('session_boards') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** La séance est partie de ce tableau (remplace un lien précédent). Échec silencieux : le lien est un confort. */
export async function linkSessionBoard(userId: string, sessionId: string, boardId: string): Promise<void> {
  if (linksMissing) return;
  const { error } = await supabase
    .from('session_boards')
    .upsert({ session_id: sessionId, board_id: boardId, user_id: userId, linked_at: new Date().toISOString() }, { onConflict: 'session_id' });
  if (isMissingLinks(error)) { linksMissing = true; console.warn('[boardsQueries] table « session_boards » absente : migration add_board_library.sql à appliquer'); return; }
  if (error) console.warn('[boardsQueries] lien séance → tableau :', error);
}

/** Tableau préparé dont une séance est partie, ou null. */
export async function fetchSessionSourceBoard(sessionId: string): Promise<Board | null> {
  if (linksMissing) return null;
  const { data, error } = await supabase
    .from('session_boards')
    .select(`board_id, boards(${COLUMNS})`)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (isMissingLinks(error)) { linksMissing = true; return null; }
  if (error || !data) return null;
  const row = data as unknown as { boards: Board | Board[] | null };
  const b = Array.isArray(row.boards) ? row.boards[0] : row.boards;
  return b ?? null;
}

export interface BoardUsage {
  session_id: string;
  linked_at: string;
  class_name: string;
  started_at: string;
}

/** Séances parties de chaque tableau de l'utilisateur, par id de tableau (les plus récentes d'abord). */
export async function fetchBoardUsages(userId: string): Promise<Map<string, BoardUsage[]>> {
  const out = new Map<string, BoardUsage[]>();
  if (linksMissing) return out;
  const { data, error } = await supabase
    .from('session_boards')
    .select('board_id, session_id, linked_at, sessions(started_at, classes(name))')
    .eq('user_id', userId)
    .order('linked_at', { ascending: false });
  if (isMissingLinks(error)) { linksMissing = true; return out; }
  if (error || !data) return out;
  for (const raw of data as unknown as { board_id: string; session_id: string; linked_at: string; sessions: { started_at: string; classes: { name: string } | { name: string }[] | null } | null }[]) {
    const s = raw.sessions;
    const cls = s?.classes;
    const className = (Array.isArray(cls) ? cls[0]?.name : cls?.name) ?? '';
    const list = out.get(raw.board_id) ?? [];
    list.push({ session_id: raw.session_id, linked_at: raw.linked_at, class_name: className, started_at: s?.started_at ?? raw.linked_at });
    out.set(raw.board_id, list);
  }
  return out;
}
