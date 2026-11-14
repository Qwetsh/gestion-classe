/**
 * Tableau préparé pour un cours de l'emploi du temps (migration 065, table lesson_boards).
 *
 * Le tableau est une ligne ordinaire de `boards` (pages dans board_pages) ; `lesson_boards`
 * le relie au cours par (user_id, starts_at, label), comme les notes de cours (044).
 * Dupliquer vers une autre classe = nouveau tableau dont les pages sont copiées : chaque
 * classe garde ensuite sa version.
 *
 * Table absente (migration non appliquée) : listes vides, création refusée avec un message.
 */
import { supabase } from '../supabase';
import { copyBoardPages, createBoard, deleteBoard, levelFromClassName } from '../boardsQueries';
import { fetchBoardPages, upsertBoardPages } from '../boardQueries';
import { lessonNoteKey } from './lessonNotesQueries';
import { emptyCourseDoc, fetchCourseDoc, saveCourseDoc } from '../course/courseDoc';
import type { TimetableLesson } from './weekView';

export interface LessonBoard {
  id: string;
  boardId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  label: string;
  classId: string | null;
  groupId: string | null;
  /** niveau du tableau (6e, 5e…), déduit du nom de la classe à la création */
  level: string | null;
  updatedAt: Date;
  /** Cours rédigé (boards.doc) plutôt que tableau blanc : ouvrable « En classe » depuis le calendrier. */
  isCourse: boolean;
}

/** Ce qu'il faut savoir d'un cours pour lui rattacher un tableau. */
export type LessonRef = Pick<TimetableLesson, 'start' | 'end' | 'label' | 'classId' | 'className' | 'groupId' | 'groupName'>;

type Row = {
  id: string;
  board_id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  class_id: string | null;
  group_id: string | null;
  boards: BoardCols | BoardCols[] | null;
};

type BoardCols = { title: string; level: string | null; updated_at: string; course?: unknown };

const SELECT = 'id, board_id, starts_at, ends_at, label, class_id, group_id, boards(title, level, updated_at, course:doc->version)';

function fromRow(r: Row): LessonBoard {
  const b = Array.isArray(r.boards) ? r.boards[0] : r.boards;
  return {
    id: r.id,
    boardId: r.board_id,
    title: b?.title ?? 'Tableau',
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    label: r.label,
    classId: r.class_id,
    groupId: r.group_id,
    level: b?.level ?? null,
    updatedAt: new Date(b?.updated_at ?? r.starts_at),
    isCourse: b?.course != null,
  };
}

let tableMissing = false;

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || (msg.includes('lesson_boards') && (msg.includes('does not exist') || msg.includes('schema cache')));
}

/** Vrai si la migration 065 n'est pas appliquée (détecté au premier appel). */
export const lessonBoardsUnavailable = () => tableMissing;

/** Début du cours à la minute : la clé doit être identique à chaque lecture (cf. lessonNoteKey). */
function minute(d: Date): Date {
  const t = new Date(d);
  t.setSeconds(0, 0);
  return t;
}

/** Tableaux des cours qui commencent dans [from, to[. */
export async function fetchLessonBoards(userId: string, from: Date, to: Date): Promise<LessonBoard[]> {
  if (tableMissing) return [];
  const { data, error } = await supabase
    .from('lesson_boards')
    .select(SELECT)
    .eq('user_id', userId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  if (isMissingTable(error)) {
    tableMissing = true;
    console.warn('[lessonBoards] table « lesson_boards » absente : migration 065 à appliquer');
    return [];
  }
  if (error) {
    console.warn('[lessonBoards] lecture impossible :', error.message);
    return [];
  }
  return ((data || []) as unknown as Row[]).map(fromRow);
}

/** Indexe par clé de cours (même clé que les notes : heure de début + libellé). */
export function indexLessonBoards(list: LessonBoard[]): Map<string, LessonBoard> {
  const map = new Map<string, LessonBoard>();
  for (const b of list) map.set(lessonNoteKey(b.startsAt, b.label), b);
  return map;
}

export function boardForLesson(boards: Map<string, LessonBoard>, lesson: Pick<TimetableLesson, 'start' | 'label'>): LessonBoard | null {
  return boards.get(lessonNoteKey(lesson.start, lesson.label)) ?? null;
}

/** Nom court d'un cours : « 5e B », « 5e B · G1 », sinon le libellé Pronote. */
export function lessonDisplayName(lesson: Pick<LessonRef, 'className' | 'groupName' | 'label'>): string {
  if (!lesson.className) return lesson.label;
  return lesson.groupName ? `${lesson.className} · ${lesson.groupName}` : lesson.className;
}

/** Titre par défaut d'un tableau de cours : « 5e B · mar. 10 nov. ». */
export function lessonBoardTitle(lesson: LessonRef): string {
  const day = lesson.start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${lessonDisplayName(lesson)} · ${day}`;
}

/**
 * Crée le tableau d'un cours : vide, ou copie d'un autre tableau (`sourceBoardId` : ses pages et,
 * s'il en a un, son cours rédigé). `kind` choisit, pour un tableau vide, entre un cours rédigé
 * (éditeur Texte, migration 071) et un tableau blanc classique.
 * Si le cours a déjà un tableau (autre onglet, double clic), le tableau créé est supprimé.
 */
export async function createLessonBoard(userId: string, lesson: LessonRef, sourceBoardId?: string, kind: 'course' | 'board' = 'board'): Promise<LessonBoard> {
  if (tableMissing) throw new Error('Les tableaux de cours demandent la migration 065');
  const level = levelFromClassName(lesson.className);
  const board = await createBoard(userId, { title: lessonBoardTitle(lesson), level, chapter: null }, lesson.classId ?? null);
  try {
    if (sourceBoardId) {
      // Cours rédigé : ses encarts pointent vers les pages par leur identifiant → on le garde
      // (unique par tableau seulement) ; tableau blanc : copie avec de nouveaux identifiants
      const doc = await fetchCourseDoc(sourceBoardId);
      const pages = doc
        ? (await fetchBoardPages({ boardId: sourceBoardId })).pages.map((p) => JSON.parse(JSON.stringify(p)) as typeof p)
        : await copyBoardPages(sourceBoardId);
      if (pages.length > 0) await upsertBoardPages(userId, { boardId: board.id }, pages.map((page, position) => ({ page, position })));
      if (doc) await saveCourseDoc(board.id, doc);
    } else if (kind === 'course') {
      await saveCourseDoc(board.id, emptyCourseDoc());
    }
    const { data, error } = await supabase
      .from('lesson_boards')
      .insert({
        user_id: userId,
        starts_at: minute(lesson.start).toISOString(),
        ends_at: new Date(lesson.end).toISOString(),
        label: lesson.label,
        class_id: lesson.classId ?? null,
        group_id: lesson.groupId ?? null,
        board_id: board.id,
      })
      .select(SELECT)
      .single();
    if (isMissingTable(error)) { tableMissing = true; throw new Error('Les tableaux de cours demandent la migration 065'); }
    if (error) throw error.code === '23505' ? new Error('Ce cours a déjà un tableau') : error;
    return fromRow(data as unknown as Row);
  } catch (err) {
    await deleteBoard(board.id).catch(() => { /* tableau orphelin : invisible, sans conséquence */ });
    throw err;
  }
}

/** Copie le tableau `source` vers chacun des cours `targets` (un nouveau tableau par cours). */
export async function duplicateLessonBoard(userId: string, source: LessonBoard, targets: LessonRef[]): Promise<{ created: LessonBoard[]; failed: string[] }> {
  const created: LessonBoard[] = [];
  const failed: string[] = [];
  for (const t of targets) {
    try {
      created.push(await createLessonBoard(userId, t, source.boardId));
    } catch (err) {
      console.warn('[lessonBoards] duplication :', err);
      failed.push(lessonDisplayName(t));
    }
  }
  return { created, failed };
}

/** Supprime le tableau du cours (le lien part avec lui). */
export async function removeLessonBoard(lb: LessonBoard): Promise<void> {
  await deleteBoard(lb.boardId);
}

/** Écart maximal entre le début du cours et le démarrage de la séance sur le téléphone. */
const MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Tableau du cours qui correspond à une séance démarrée (même classe, début le plus proche,
 * à moins de 3 h). Sert à l'écran /classe quand on n'est pas passé par « Lancer la séance ».
 */
export async function findLessonBoardForSession(userId: string, classId: string, startedAt: Date, groupId?: string | null): Promise<LessonBoard | null> {
  const list = await fetchLessonBoards(userId, new Date(startedAt.getTime() - MATCH_WINDOW_MS), new Date(startedAt.getTime() + MATCH_WINDOW_MS));
  const sameClass = list.filter((b) => b.classId === classId);
  // Demi-groupe : préférer le tableau du même groupe s'il existe
  const pool = groupId && sameClass.some((b) => b.groupId === groupId) ? sameClass.filter((b) => b.groupId === groupId) : sameClass;
  let best: LessonBoard | null = null;
  for (const b of pool) {
    if (!best || Math.abs(b.startsAt.getTime() - startedAt.getTime()) < Math.abs(best.startsAt.getTime() - startedAt.getTime())) best = b;
  }
  return best;
}

/** Tableau de cours par identifiant de tableau (lien « Lancer la séance »). */
export async function fetchLessonBoardByBoardId(boardId: string): Promise<LessonBoard | null> {
  if (tableMissing) return null;
  const { data, error } = await supabase.from('lesson_boards').select(SELECT).eq('board_id', boardId).maybeSingle();
  if (isMissingTable(error)) { tableMissing = true; return null; }
  if (error || !data) return null;
  return fromRow(data as unknown as Row);
}
