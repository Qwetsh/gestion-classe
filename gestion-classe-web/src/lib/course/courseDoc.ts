/**
 * Cours rédigés (PLAN_cours_editeur.md, migration 071) : un cours est un tableau (`boards`)
 * qui porte un document `doc` = { version, content } au format TipTap (JSON ProseMirror).
 *
 * `doc` NULL = tableau classique (pages 16:9) : il s'ouvre toujours dans le tableau blanc.
 * Colonne absente (migration non appliquée) : les cours ne sont pas disponibles, rien ne casse.
 */
import type { JSONContent } from '@tiptap/core';
import { supabase } from '../supabase';
import { createBoard, deleteBoard, type Board, type BoardMeta } from '../boardsQueries';

export const COURSE_DOC_VERSION = 1;

export interface CourseDoc {
  version: number;
  content: JSONContent;
}

/** Document de départ : un titre à remplir et un premier paragraphe. */
export function emptyCourseDoc(): CourseDoc {
  return {
    version: COURSE_DOC_VERSION,
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'paragraph' },
      ],
    },
  };
}

let columnMissing = false;

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42703' || (msg.includes('doc') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Vrai si la migration 071 n'est pas appliquée (détecté au premier appel). */
export const coursesUnavailable = () => columnMissing;

function isCourseDoc(v: unknown): v is CourseDoc {
  return !!v && typeof v === 'object' && 'content' in (v as Record<string, unknown>);
}

/** Document d'un cours, ou null pour un tableau classique. */
export async function fetchCourseDoc(boardId: string): Promise<CourseDoc | null> {
  if (columnMissing) return null;
  const { data, error } = await supabase.from('boards').select('doc').eq('id', boardId).maybeSingle();
  if (isMissingColumn(error)) { columnMissing = true; return null; }
  if (error) throw error;
  const doc = (data as { doc: unknown } | null)?.doc;
  return isCourseDoc(doc) ? doc : null;
}

/** Document, titre et date de modification d'un cours (ouverture de l'éditeur). */
export async function fetchCourse(boardId: string): Promise<{ doc: CourseDoc | null; title: string; updatedAt: number }> {
  if (columnMissing) throw new Error('Les cours rédigés demandent la migration 071');
  const { data, error } = await supabase.from('boards').select('doc, title, updated_at').eq('id', boardId).single();
  if (isMissingColumn(error)) { columnMissing = true; throw new Error('Les cours rédigés demandent la migration 071'); }
  if (error) throw error;
  const row = data as { doc: unknown; title: string; updated_at: string };
  return { doc: isCourseDoc(row.doc) ? row.doc : null, title: row.title, updatedAt: new Date(row.updated_at).getTime() };
}

/** Le tableau est-il un cours rédigé ? (sert à choisir l'éditeur à ouvrir) */
export async function boardIsCourse(boardId: string): Promise<boolean> {
  if (columnMissing) return false;
  const { data, error } = await supabase.from('boards').select('version:doc->version').eq('id', boardId).maybeSingle();
  if (isMissingColumn(error)) { columnMissing = true; return false; }
  if (error) { console.warn('[courseDoc] type du tableau illisible :', error.message); return false; }
  return (data as { version: unknown } | null)?.version != null;
}

/** Enregistre le document (et la date de modification du tableau). */
export async function saveCourseDoc(boardId: string, doc: CourseDoc): Promise<void> {
  if (columnMissing) throw new Error('Les cours rédigés demandent la migration 071');
  const { error } = await supabase
    .from('boards')
    .update({ doc, updated_at: new Date().toISOString() })
    .eq('id', boardId);
  if (isMissingColumn(error)) { columnMissing = true; throw new Error('Les cours rédigés demandent la migration 071'); }
  if (error) throw error;
}

/** Nouveau cours rédigé (un tableau avec un document). Le tableau est supprimé si l'écriture échoue. */
export async function createCourse(userId: string, meta: BoardMeta, classId: string | null = null, doc: CourseDoc = emptyCourseDoc()): Promise<Board> {
  if (columnMissing) throw new Error('Les cours rédigés demandent la migration 071');
  const board = await createBoard(userId, meta, classId);
  try {
    await saveCourseDoc(board.id, doc);
    return board;
  } catch (err) {
    await deleteBoard(board.id).catch(() => { /* tableau vide sans document : s'ouvrira en tableau blanc */ });
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Copie de secours locale (réseau coupé, onglet fermé avant l'envoi)
// ---------------------------------------------------------------------------------------------

const LOCAL_PREFIX = 'course-doc:';

export function saveLocalCourse(boardId: string, doc: CourseDoc): void {
  try {
    localStorage.setItem(LOCAL_PREFIX + boardId, JSON.stringify({ savedAt: Date.now(), doc }));
  } catch { /* quota plein : la sauvegarde distante reste la référence */ }
}

export function loadLocalCourse(boardId: string): { savedAt: number; doc: CourseDoc } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_PREFIX + boardId) || 'null') as { savedAt: number; doc: CourseDoc } | null;
    return raw && isCourseDoc(raw.doc) ? raw : null;
  } catch { return null; }
}

export function clearLocalCourse(boardId: string): void {
  try { localStorage.removeItem(LOCAL_PREFIX + boardId); } catch { /* rien */ }
}
