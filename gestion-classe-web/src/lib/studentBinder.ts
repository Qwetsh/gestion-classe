/**
 * Classeur des élèves (PLAN_classeur_eleves.md, lot 2) : lecture du classeur d'une classe par un
 * visiteur sans compte, à travers l'Edge Function `classeur-eleve`. Le serveur ne rend que ce que
 * le professeur a ouvert à la classe ; rien n'est lu directement en base ni dans le stockage.
 */
import { supabase } from './supabase';
import type { Board } from './boardsQueries';
import { seedSignedUrls } from './boardMedia';
import type { OpenEntry } from './binderRelease';
import type { CourseDoc } from './course/courseDoc';

/**
 * Ce qui ouvre le classeur : le jeton du lien de la classe (Pronote), ou le code à 6 chiffres de
 * l'élève (onglet de l'espace élève ; `studentId` lève le doute quand un code désigne plusieurs
 * fiches).
 */
export type BinderKey = { token: string } | { code: string; studentId?: string };

/** Repère d'un accès : deux clés de même repère ouvrent le même classeur. */
export const binderKeyId = (key: BinderKey): string => ('token' in key ? `t:${key.token}` : `c:${key.code}:${key.studentId ?? ''}`);

export interface StudentToc {
  className: string;
  entries: OpenEntry[];
  /** Cours cités par les éléments ouverts, par identifiant. */
  boards: Map<string, Board>;
}

/** `forbidden` : lien inconnu, coupé ou remplacé, ou onglet fermé pour la classe ; `network` : pas de réponse ; `server` : le reste. */
export class StudentBinderError extends Error {
  kind: 'forbidden' | 'not_found' | 'network' | 'server';
  constructor(kind: StudentBinderError['kind']) {
    super(kind);
    this.kind = kind;
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('classeur-eleve', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new StudentBinderError(status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status ? 'server' : 'network');
  }
  if (!data) throw new StudentBinderError('server');
  return data;
}

interface TocResponse {
  className?: unknown;
  items?: unknown;
  boards?: unknown;
}

/** L'onglet « Classeur » est-il ouvert à cet élève ? (le serveur répond à sa place : rien d'autre n'est lu) */
export async function studentBinderOpen(key: BinderKey): Promise<boolean> {
  try {
    // Question légère : le serveur répond oui ou non, sans erreur ni contenu
    const res = await call<{ open?: unknown }>({ action: 'open', ...key });
    return res.open === true;
  } catch {
    return false;
  }
}

/** Sommaire du classeur de la classe : ses éléments ouverts et les cours qu'ils citent. */
export async function fetchStudentToc(key: BinderKey): Promise<StudentToc> {
  const res = await call<TocResponse>({ action: 'toc', ...key });
  const boards = new Map<string, Board>();
  for (const b of Array.isArray(res.boards) ? res.boards : []) {
    if (!b || typeof b !== 'object') continue;
    const { id, title, updated_at } = b as { id?: unknown; title?: unknown; updated_at?: unknown };
    if (typeof id !== 'string' || typeof title !== 'string') continue;
    const at = typeof updated_at === 'string' ? updated_at : '';
    boards.set(id, { id, title, class_id: null, level: null, chapter: null, created_at: at, updated_at: at, is_course: true, category: null });
  }
  const entries = (Array.isArray(res.items) ? res.items : []).flatMap((i): OpenEntry[] => {
    if (!i || typeof i !== 'object') return [];
    const { anchor, correction, released } = i as { anchor?: unknown; correction?: unknown; released?: unknown };
    return typeof anchor === 'string' ? [{ anchor, correction: correction === true, released }] : [];
  });
  return { className: typeof res.className === 'string' ? res.className : '', entries, boards };
}

interface DocResponse {
  doc?: CourseDoc;
  images?: Record<string, string>;
}

/**
 * Lecteur des fiches pour un classeur ouvert par `key` : chaque fiche est demandée au serveur quand
 * elle s'affiche, et gardée. Les adresses de ses images, signées par le serveur, sont posées là où
 * le rendu des cours les cherche.
 */
export function studentDocLoader(key: BinderKey): (board: Board) => Promise<CourseDoc | null> {
  const cache = new Map<string, Promise<CourseDoc | null>>();
  return (board) => {
    const id = `${board.id}|${board.updated_at}`;
    let pending = cache.get(id);
    if (!pending) {
      pending = call<DocResponse>({ action: 'doc', ...key, boardId: board.id }).then((res) => {
        if (res.images && typeof res.images === 'object') seedSignedUrls(res.images);
        return res.doc && typeof res.doc === 'object' ? res.doc : null;
      });
      pending.catch(() => cache.delete(id));
      cache.set(id, pending);
    }
    return pending;
  };
}
