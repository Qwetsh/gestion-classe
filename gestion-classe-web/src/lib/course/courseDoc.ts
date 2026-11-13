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
import { fetchBoardPages, upsertBoardPages } from '../boardQueries';

export const COURSE_DOC_VERSION = 1;

/** Numérotation automatique des titres (Titre 2 → Titre 3). Le Titre 1 est le titre du cours. */
export type HeadingNumbering = 'none' | 'roman' | 'alpha' | 'decimal';

export const HEADING_NUMBERING_LABELS: Record<HeadingNumbering, string> = {
  none: 'Sans numéros',
  roman: 'I. puis 1.',
  alpha: '1. puis a.',
  decimal: '1. puis 1.1',
};

/** Réglages du document entier (absents dans les cours enregistrés avant le lot T2). */
export interface CourseSettings {
  numbering?: HeadingNumbering;
  /** Coupure des mots en fin de ligne. */
  hyphens?: boolean;
}

export interface CourseDoc {
  version: number;
  content: JSONContent;
  settings?: CourseSettings;
  /**
   * Numéro d'enregistrement, changé à chaque écriture de l'éditeur (lot T6) : un enregistrement
   * ne passe que si le cours n'a pas été réécrit entre-temps par un autre onglet ou appareil.
   */
  rev?: string;
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
export interface FetchedCourse {
  doc: CourseDoc | null;
  title: string;
  level: string | null;
  chapter: string | null;
  updatedAt: number;
  /** Numéro d'enregistrement du document en base (null : document antérieur au lot T6). */
  rev: string | null;
}

export async function fetchCourse(boardId: string): Promise<FetchedCourse> {
  if (columnMissing) throw new Error('Les cours rédigés demandent la migration 071');
  const { data, error } = await supabase.from('boards').select('doc, title, level, chapter, updated_at').eq('id', boardId).single();
  if (isMissingColumn(error)) { columnMissing = true; throw new Error('Les cours rédigés demandent la migration 071'); }
  if (error) throw error;
  const row = data as { doc: unknown; title: string; level: string | null; chapter: string | null; updated_at: string };
  const doc = isCourseDoc(row.doc) ? row.doc : null;
  return { doc, title: row.title, level: row.level, chapter: row.chapter, updatedAt: new Date(row.updated_at).getTime(), rev: doc?.rev ?? null };
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

const newRev = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export type GuardedSave = { ok: true; rev: string } | { ok: false };

/**
 * Enregistrement de l'éditeur : n'écrit que si le document en base porte encore le numéro
 * `expectedRev` (null = document enregistré avant le lot T6, sans numéro). Sinon, un autre onglet
 * ou appareil l'a réécrit : rien n'est écrit et `{ ok: false }` est renvoyé.
 * `expectedRev` undefined : écriture sans condition (on garde sa version, en connaissance de cause).
 */
export async function saveCourseDocGuarded(boardId: string, doc: CourseDoc, expectedRev: string | null | undefined): Promise<GuardedSave> {
  if (columnMissing) throw new Error('Les cours rédigés demandent la migration 071');
  const rev = newRev();
  let q = supabase
    .from('boards')
    .update({ doc: { ...doc, rev }, updated_at: new Date().toISOString() })
    .eq('id', boardId);
  if (expectedRev === null) q = q.is('doc->rev', null);
  else if (expectedRev !== undefined) q = q.eq('doc->>rev', expectedRev);
  const { data, error } = await q.select('id');
  if (isMissingColumn(error)) { columnMissing = true; throw new Error('Les cours rédigés demandent la migration 071'); }
  if (error) throw error;
  return (data ?? []).length > 0 ? { ok: true, rev } : { ok: false };
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
// Dupliquer un cours, modèles (lot T6, colonne boards.is_template de la migration 072)
// ---------------------------------------------------------------------------------------------

/**
 * Copie d'un cours : document et pages des encarts (gardées sous le même identifiant, unique par
 * tableau seulement : les encarts du document y renvoient). Les copies sont indépendantes.
 * `asTemplate` : la copie est rangée parmi les modèles.
 */
export async function duplicateCourse(userId: string, sourceBoardId: string, meta: BoardMeta, asTemplate = false): Promise<Board> {
  const doc = await fetchCourseDoc(sourceBoardId);
  if (!doc) throw new Error('Ce cours est introuvable');
  const copy: CourseDoc = { ...doc };
  delete copy.rev;
  const board = await createBoard(userId, meta);
  try {
    const { pages } = await fetchBoardPages({ boardId: sourceBoardId });
    if (pages.length > 0) await upsertBoardPages(userId, { boardId: board.id }, pages.map((page, position) => ({ page: JSON.parse(JSON.stringify(page)) as typeof page, position })));
    await saveCourseDoc(board.id, copy);
    if (asTemplate) await setTemplate(board.id, true);
    return { ...board, is_course: true };
  } catch (err) {
    await deleteBoard(board.id).catch(() => { /* copie incomplète : supprimée si possible */ });
    throw err;
  }
}

let templateColumnMissing = false;

const isMissingTemplateColumn = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === '42703' || /is_template/i.test(error.message ?? ''));

/** Vrai si la migration 072 n'est pas appliquée (pas de modèles personnels). */
export const templatesUnavailable = () => templateColumnMissing;

export async function setTemplate(boardId: string, isTemplate: boolean): Promise<void> {
  if (templateColumnMissing) throw new Error('Les modèles demandent la migration 072');
  const { error } = await supabase.from('boards').update({ is_template: isTemplate }).eq('id', boardId);
  if (isMissingTemplateColumn(error)) { templateColumnMissing = true; throw new Error('Les modèles demandent la migration 072'); }
  if (error) throw error;
}

export interface CourseTemplateRow {
  id: string;
  title: string;
  level: string | null;
  chapter: string | null;
  updated_at: string;
}

/** Modèles personnels (cours marqués « modèle »), les plus récents d'abord. */
export async function listTemplates(userId: string): Promise<CourseTemplateRow[]> {
  if (templateColumnMissing || columnMissing) return [];
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, level, chapter, updated_at')
    .eq('user_id', userId)
    .eq('is_template', true)
    .order('updated_at', { ascending: false });
  if (isMissingTemplateColumn(error)) { templateColumnMissing = true; return []; }
  if (error) throw error;
  return (data ?? []) as CourseTemplateRow[];
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
